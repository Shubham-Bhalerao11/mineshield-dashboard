"""FastAPI GIS and telemetry API for the MineShield OCC."""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "AI_Displacement_Dataset"
RASTER = DATASET / "displacement_cm_cog.tif"
METADATA = DATASET / "metadata.json"
MESH_FILE = ROOT / "mesh_telemetry.jsonl"

app = FastAPI(title="MineShield OCC API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], allow_methods=["*"], allow_headers=["*"])


class ProfileRequest(BaseModel):
    coordinates: list[list[float]] = Field(min_length=2, max_length=256)


def metadata() -> dict[str, Any]:
    try:
        return json.loads(METADATA.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise HTTPException(503, f"Metadata unavailable: {error}") from error


def mesh_records() -> list[dict[str, Any]]:
    if not MESH_FILE.exists():
        return []
    records = []
    with MESH_FILE.open(encoding="utf-8") as stream:
        for line in stream:
            try:
                value = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict) and value.get("node_id"):
                records.append(value)
    latest = {str(item["node_id"]): item for item in records}
    return list(latest.values())


def node_csri(node: dict[str, Any]) -> float:
    def number(*keys: str) -> float:
        for key in keys:
            try:
                return abs(float(node.get(key, 0)))
            except (TypeError, ValueError):
                pass
        return 0.0

    return float(np.clip(.32 * max(number("pitch_deg"), number("roll_deg")) / 3.2 + .28 * number("vibration_g") / .2 + .25 * number("crack_extension_mm") / 4.5 + .1 * number("packet_loss_pct") / 10 + .05 * max(0, 30 - number("battery_pct")) / 30, 0, 1))


@app.get("/api/v1/insar/meta")
def insar_meta() -> dict[str, Any]:
    info = metadata()
    bbox = info.get("bbox_latlon", {})
    return {"source": str(RASTER), "units": info.get("units", "centimeters"), "shape": info.get("shape"), "bbox": {"west": bbox.get("min_longitude"), "south": bbox.get("min_latitude"), "east": bbox.get("max_longitude"), "north": bbox.get("max_latitude")}, "crs": info.get("crs"), "approximate_extent": info.get("bbox_is_approximate_tie_point_extent", True), "overlay": "/api/v1/insar/overlay"}


@app.get("/api/v1/insar/overlay")
def insar_overlay(width: int = Query(220, ge=32, le=512)) -> dict[str, Any]:
    if not RASTER.exists():
        raise HTTPException(503, "AI displacement COG is unavailable")
    with rasterio.open(RASTER) as source:
        height = max(2, round(source.height / source.width * width))
        values = source.read(1, out_shape=(height, width), masked=True).astype("float32").filled(np.nan)
    finite = values[np.isfinite(values)]
    return {"width": width, "height": height, "values_cm": np.nan_to_num(values, nan=0).round(3).tolist(), "min_cm": float(np.nanmin(finite)), "max_cm": float(np.nanmax(finite)), "valid_fraction": float(np.isfinite(values).mean())}


@app.get("/api/v1/mesh/nodes")
def mesh_nodes() -> dict[str, Any]:
    records = mesh_records()
    return {"connected": bool(records), "received_at": datetime.now(timezone.utc).isoformat(), "nodes": [{**node, "csri": node_csri(node)} for node in records], "message": "Real gateway feed connected" if records else "Waiting for real LoRa mesh telemetry"}


@app.get("/api/v1/alerts/feed")
def alerts_feed() -> dict[str, Any]:
    nodes = mesh_records()
    alerts = []
    for node in nodes:
        score = node_csri(node)
        if score >= .45:
            alerts.append({"id": f"mesh-{node['node_id']}", "node_id": node["node_id"], "severity": "critical" if score >= .88 else "warning", "csri": score, "message": "Mesh anomaly threshold exceeded", "timestamp": node.get("timestamp")})
    return {"alerts": alerts, "source": "real_mesh_gateway", "connected": bool(nodes)}


@app.post("/api/v1/analytics/profile")
def analytics_profile(request: ProfileRequest) -> dict[str, Any]:
    if not RASTER.exists():
        raise HTTPException(503, "AI displacement COG is unavailable")
    samples = []
    with rasterio.open(RASTER) as source:
        for index, pair in enumerate(request.coordinates):
            if len(pair) != 2:
                raise HTTPException(422, "Coordinates must be [longitude, latitude]")
            longitude, latitude = pair
            try:
                row, column = source.index(longitude, latitude)
                window = ((max(0, row), min(source.height, row + 1)), (max(0, column), min(source.width, column + 1)))
                value = source.read(1, window=window, masked=True)[0, 0]
                samples.append({"distance_index": index, "longitude": longitude, "latitude": latitude, "displacement_cm": None if np.ma.is_masked(value) else float(value)})
            except (IndexError, ValueError):
                samples.append({"distance_index": index, "longitude": longitude, "latitude": latitude, "displacement_cm": None})
    return {"samples": samples, "source": "AI displacement COG", "units": "centimeters"}
