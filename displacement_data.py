"""Read-only adapter for the supplied AI displacement patch dataset."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import numpy as np
from scipy.interpolate import griddata

DATASET_ROOT = Path(__file__).resolve().parent / "AI_Displacement_Dataset"
PATCH_PATTERN = re.compile(r"patch_\d+_r(\d+)_c(\d+)\.npy$")


def resolve_dataset(requested: str | None = None) -> Path | None:
    root = Path(requested).expanduser() if requested else DATASET_ROOT
    if (root / "metadata.json").exists() and (root / "train_images").is_dir():
        return root
    return None


def load_metadata(dataset_root: Path) -> dict[str, Any]:
    try:
        return json.loads((dataset_root / "metadata.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _patches(dataset_root: Path) -> list[tuple[int, int, Path]]:
    result = []
    for path in sorted((dataset_root / "train_images").glob("*.npy")):
        match = PATCH_PATTERN.match(path.name)
        if match:
            result.append((int(match.group(1)), int(match.group(2)), path))
    return result


def read_overview(dataset_root: Path, max_dimension: int = 220) -> dict[str, Any]:
    metadata = load_metadata(dataset_root)
    patches = _patches(dataset_root)
    if not patches:
        raise ValueError("AI displacement dataset has no readable train_images patches.")
    shape_metadata = metadata.get("shape", {})
    if isinstance(shape_metadata, dict):
        source_shape = (int(shape_metadata.get("rows", 9570)), int(shape_metadata.get("columns", 26710)))
    else:
        source_shape = tuple(shape_metadata)
    scale = max(source_shape) / max_dimension
    height = max(2, int(source_shape[0] / scale))
    width = max(2, int(source_shape[1] / scale))
    bbox = metadata.get("bbox_latlon", {})
    extent = (float(bbox.get("min_longitude", 0)), float(bbox.get("max_longitude", width)), float(bbox.get("min_latitude", 0)), float(bbox.get("max_latitude", height)))
    normalization = metadata.get("normalization", {})
    min_cm = float(normalization.get("min_cm", metadata.get("global_valid_min_cm", 0.0)))
    max_cm = float(normalization.get("max_cm", metadata.get("global_valid_max_cm", 1.0)))
    points = []
    patch_values = []
    for row, column, path in patches:
        patch = np.load(path, mmap_mode="r")
        center_x = (column + patch.shape[1] / 2) / source_shape[1]
        center_y = (row + patch.shape[0] / 2) / source_shape[0]
        points.append((extent[0] + center_x * (extent[1] - extent[0]), extent[3] - center_y * (extent[3] - extent[2])))
        patch_values.append(min_cm + float(np.nanmean(patch)) * (max_cm - min_cm))
    longitude = np.linspace(extent[0], extent[1], width)
    latitude = np.linspace(extent[3], extent[2], height)
    grid_longitude, grid_latitude = np.meshgrid(longitude, latitude)
    array = griddata(np.asarray(points), np.asarray(patch_values), (grid_longitude, grid_latitude), method="linear")
    nearest = griddata(np.asarray(points), np.asarray(patch_values), (grid_longitude, grid_latitude), method="nearest")
    array = np.where(np.isfinite(array), array, nearest).astype(np.float32)
    if not np.isfinite(array).any():
        raise ValueError("AI displacement patches contain no valid values.")
    finite = array[np.isfinite(array)]
    low, high = np.percentile(finite, [2, 98])
    return {"values": array, "lon": longitude, "lat": latitude, "extent": extent, "min_cm": float(np.nanmin(array)), "max_cm": float(np.nanmax(array)), "p02_cm": float(low), "p98_cm": float(high), "valid_pixels": int(finite.size), "shape": source_shape, "patch_count": len(patches), "metadata": metadata, "patches": patches}


def sample_pixel(dataset_root: Path, longitude: float, latitude: float, overview: dict[str, Any]) -> dict[str, Any]:
    min_lon, max_lon, min_lat, max_lat = overview["extent"]
    if not (min_lon <= longitude <= max_lon and min_lat <= latitude <= max_lat):
        raise ValueError("Selected coordinate is outside the AI displacement dataset extent.")
    source_rows, source_columns = overview["shape"]
    requested_row = (max_lat - latitude) / (max_lat - min_lat) * source_rows
    requested_column = (longitude - min_lon) / (max_lon - min_lon) * source_columns
    patches = overview["patches"]
    nearest_row, nearest_column, nearest_path = min(patches, key=lambda item: (item[0] - requested_row) ** 2 + (item[1] - requested_column) ** 2)
    patch = np.load(nearest_path, mmap_mode="r")
    normalized_value = float(np.nanmean(patch))
    normalization = overview["metadata"].get("normalization", {})
    min_cm = float(normalization.get("min_cm", overview["metadata"].get("global_valid_min_cm", 0.0)))
    max_cm = float(normalization.get("max_cm", overview["metadata"].get("global_valid_max_cm", 1.0)))
    value = min_cm + normalized_value * (max_cm - min_cm)
    return {"longitude": longitude, "latitude": latitude, "row": nearest_row, "column": nearest_column, "displacement_value": value, "patch_name": nearest_path.name}


def risk_counts(values: np.ndarray, watch_threshold: float = 0.5, critical_threshold: float = 0.8) -> dict[str, int]:
    valid = values[np.isfinite(values)]
    magnitude = np.abs(valid)
    return {"Stable": int(np.sum(magnitude < watch_threshold)), "Watch": int(np.sum((magnitude >= watch_threshold) & (magnitude < critical_threshold))), "Critical": int(np.sum(magnitude >= critical_threshold))}
