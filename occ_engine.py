"""Real-data OCC analytics and optional mesh gateway ingestion."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np


def patch_statistics(dataset_root: Path, overview: dict[str, Any]) -> dict[str, Any]:
    values = []
    for _, _, path in overview.get("patches", []):
        patch = np.load(path, mmap_mode="r")
        values.append(float(np.nanmean(patch)))
    normalized = np.asarray(values, dtype=np.float32)
    normalization = overview.get("metadata", {}).get("normalization", {})
    min_cm = float(normalization.get("min_cm", overview.get("metadata", {}).get("global_valid_min_cm", 0.0)))
    max_cm = float(normalization.get("max_cm", overview.get("metadata", {}).get("global_valid_max_cm", 1.0)))
    displacement_cm = min_cm + normalized * (max_cm - min_cm)
    return {"patch_values_cm": displacement_cm, "mean_cm": float(np.mean(displacement_cm)), "std_cm": float(np.std(displacement_cm)), "p95_abs_cm": float(np.percentile(np.abs(displacement_cm), 95))}


def spatial_risk(overview: dict[str, Any], statistics: dict[str, Any], longitude: float, latitude: float) -> dict[str, Any]:
    min_lon, max_lon, min_lat, max_lat = overview["extent"]
    sample = (longitude - min_lon) / max(max_lon - min_lon, 1e-9)
    sample_y = (latitude - min_lat) / max(max_lat - min_lat, 1e-9)
    grid = overview["values"]
    values = grid[np.isfinite(grid)]
    row = int(np.clip((1 - sample_y) * (grid.shape[0] - 1), 0, grid.shape[0] - 1))
    column = int(np.clip(sample * (grid.shape[1] - 1), 0, grid.shape[1] - 1))
    local = float(grid[row, column])
    if not np.isfinite(local):
        local = float(np.nanmean(grid))
    scale = max(float(np.max(np.abs(values))), 1e-6)
    csri = float(np.clip(0.72 * abs(local) / scale + 0.28 * min(1.0, statistics["p95_abs_cm"] / scale), 0.0, 1.0))
    stage = "CRITICAL EVACUATION" if csri >= .88 else "WATCH" if csri >= .70 else "ADVISORY" if csri >= .45 else "NOMINAL"
    return {"csri": csri, "stage": stage, "local_displacement_cm": local, "zone_probability": float(np.clip(csri * 1.08, 0.0, 1.0)), "method": "Unsupervised spatial anomaly score from supplied AI displacement patches"}


def read_mesh_telemetry(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"connected": False, "records": [], "message": "Waiting for a real mesh gateway JSONL feed."}
    records = []
    with path.open("r", encoding="utf-8") as stream:
        for line in stream:
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(record, dict) and record.get("node_id"):
                records.append(record)
    return {"connected": bool(records), "records": records[-100:], "message": "Live gateway feed received." if records else "Gateway file is present but has no valid records."}


def mesh_risk(records: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not records:
        return None
    latest = {}
    for record in records:
        latest[str(record["node_id"])] = record
    scores = []
    node_scores = {}
    for node_id, record in latest.items():
        def number(*names: str, default: float = 0.0) -> float:
            for name in names:
                if record.get(name) is not None:
                    try:
                        return abs(float(record[name]))
                    except (TypeError, ValueError):
                        return default
            return default

        tilt = max(number("pitch_deg"), number("roll_deg")) / 3.2
        vibration = number("vibration_g") / .20
        crack = number("crack_extension_mm") / 4.5
        packet_loss = number("packet_loss_pct") / 10.0
        battery = max(0.0, (30.0 - number("battery_pct")) / 30.0)
        node_score = float(np.clip(.32 * tilt + .28 * vibration + .25 * crack + .10 * packet_loss + .05 * battery, 0.0, 1.0))
        scores.append(node_score)
        node_scores[node_id] = node_score
    csri = float(np.mean(scores))
    peak = float(np.max(scores))
    stage = "CRITICAL EVACUATION" if peak >= .88 else "WATCH" if peak >= .70 else "ADVISORY" if peak >= .45 else "NOMINAL"
    return {"csri": csri, "peak_csri": peak, "stage": stage, "nodes": len(latest), "node_scores": node_scores, "method": "Mesh-only anomaly score from real tilt, vibration, crack, power, and link telemetry"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
