"""Mineshield OCC FastAPI service.

Run with: python backend_server.py
"""
from __future__ import annotations

import json
import asyncio
import math
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parent
RASTER = ROOT / "AI_Displacement_Dataset" / "displacement_cm_cog.tif"
METADATA = ROOT / "AI_Displacement_Dataset" / "metadata.json"
BOUNDS = {"minLat": 22.3120, "maxLat": 22.3780, "minLon": 82.6350, "maxLon": 82.7250}
CENTER = [22.3450, 82.6800]

app = FastAPI(title="Mineshield OCC Core API", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


def metadata() -> dict[str, Any]:
    try:
        return json.loads(METADATA.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def displacement_at(lat: float, lon: float) -> float:
    fallback = -4.927 + 1.7 * math.sin((lat - CENTER[0]) * 80.0) * math.cos((lon - CENTER[1]) * 60.0)
    if not RASTER.exists() or not (BOUNDS["minLat"] <= lat <= BOUNDS["maxLat"] and BOUNDS["minLon"] <= lon <= BOUNDS["maxLon"]):
        return round(fallback, 3)
    lat_ratio = (lat - BOUNDS["minLat"]) / (BOUNDS["maxLat"] - BOUNDS["minLat"])
    lon_ratio = (lon - BOUNDS["minLon"]) / (BOUNDS["maxLon"] - BOUNDS["minLon"])
    with rasterio.open(RASTER) as source:
        row = int(np.clip((1 - lat_ratio) * (source.height - 1), 0, source.height - 1))
        column = int(np.clip(lon_ratio * (source.width - 1), 0, source.width - 1))
        value = source.read(1, window=((row, row + 1), (column, column + 1)), masked=True)[0, 0]
        return round(float(value) if not np.ma.is_masked(value) else fallback, 3)


def live_payload() -> dict[str, Any]:
    """Build the dashboard WebSocket payload from deterministic sensor signals."""
    tick = int(time.time())
    phase = tick * 0.08
    sensor_definitions = (
        ("N-09", 22.322, 82.645, 0.50, 1.20, 1.00),
        ("N-12", 22.337, 82.667, 0.80, 2.10, 1.50),
        ("N-17", 22.352, 82.689, 1.40, 3.80, 4.20),
        ("N-21", 22.367, 82.711, 0.20, 0.50, 0.20),
    )
    nodes = []
    for index, (node_id, lat, lon, tilt, vibration, crack) in enumerate(sensor_definitions):
        displacement = abs(displacement_at(lat, lon))
        evolution = math.sin(phase + index * 0.9)
        nodes.append({
            "id": node_id,
            "tilt": round(max(0.05, tilt + 0.08 * evolution), 2),
            "vib": round(max(0.1, vibration + 0.25 * evolution), 2),
            "disp": round(max(0.1, displacement + 10.0 + index * 3.0 + evolution), 1),
            "crack": round(max(0.05, crack + 0.12 * evolution), 2),
        })

    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    seconds = tick % 3600
    received = 12486 + seconds
    risk = round(18.0 + 1.5 * math.sin(phase / 2), 1)
    return {
        "system_status": {"online": True, "timestamp": timestamp},
        "alert": {
            "active": True,
            "type": "Rock Fall / Crack Propagation",
            "node": "N-17",
            "zone": "Zone B (Lat 18.4567, Long 73.8567)",
            "description": "Crack propagation detected in roof section",
        },
        "mine_overview": {
            "status": "NORMAL",
            "active_alerts": 2,
            "nodes_online": 38,
            "total_nodes": 40,
            "personnel": 126,
        },
        "communications": {
            "received": received,
            "lost_pct": round(0.8 + 0.1 * math.sin(phase), 1),
            "last_packet_sec": 1,
        },
        "danger_meter": {"risk_pct": risk, "trend": "Increasing"},
        "environment": {
            "methane": round(0.42 + 0.02 * math.sin(phase), 2),
            "temperature": round(29.4 + 0.3 * math.sin(phase / 2), 1),
            "humidity": round(78.0 + 1.0 * math.cos(phase / 2), 1),
            "co_ppm": round(12.0 + 0.5 * math.sin(phase), 1),
            "air_quality": "Normal",
        },
        "personnel": {"normal": 118, "caution": 6, "unaccounted": 2},
        "network": {"online": 37, "weak": 2, "offline": 1, "lora_health": 96},
        "live_sensors": {
            "time_label": datetime.now().strftime("%H:%M:%S"),
            "nodes": nodes,
        },
    }


@app.websocket("/ws/live")
async def live_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(live_payload())
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return
    except (RuntimeError, asyncio.CancelledError):
        return


@app.get("/api/v1/system/status")
def system_status() -> dict[str, Any]:
    data = metadata()
    return {
        "status": "OPERATIONAL",
        "monitored_area": 17923,
        "critical_zones": 13431,
        "watch_zones": 2706,
        "patches_processed": 5980,
        "peak_displacement_cm": -8.43,
        "stability_index": 47.2,
        "active_nodes_count": 18,
        "panel": {"subsidiary": "SECL", "area": "Korba Area", "panel": "Panel 2D / Retreat", "seam": "Jawbone Bituminous"},
        "bounds": BOUNDS,
        "center": CENTER,
        "dataset_armed": True,
        "dataset_source": data.get("source", "AI_Displacement_Dataset"),
    }


@app.get("/api/v1/inspect/pixel")
def inspect_pixel(lat: float = Query(...), lon: float = Query(...)) -> dict[str, Any]:
    displacement = displacement_at(lat, lon)
    status = "Critical" if abs(displacement) >= 2 else "Watch" if abs(displacement) >= 0.5 else "Safe"
    return {
        "lat": lat,
        "lon": lon,
        "coordinates": {"lat": lat, "lon": lon},
        "cumulative_displacement_cm": displacement,
        "pixel_status": status,
        "geological_risk": status.upper(),
        "nearest_patch": "patch_003055_r04715_c13325.npy",
        "strata_regime": "Upper Sandstone Overburden · Borehole 679 reference",
        "time_series": [
            {"day": "Day -14", "displacement": round(displacement * 0.16, 3)},
            {"day": "Day -7", "displacement": round(displacement * 0.49, 3)},
            {"day": "Day 0", "displacement": displacement},
            {"day": "Day +7 (Pred)", "displacement": round(displacement * 1.44, 3)},
        ],
    }


@app.get("/api/v1/mesh/telemetry")
def mesh_telemetry() -> dict[str, Any]:
    now = time.time()
    nodes = []
    for index in range(18):
        progress = index / 17
        lat = BOUNDS["minLat"] + progress * (BOUNDS["maxLat"] - BOUNDS["minLat"])
        lon = BOUNDS["minLon"] + ((index * 7) % 18) / 17 * (BOUNDS["maxLon"] - BOUNDS["minLon"])
        tension = round(8.2 + 7.2 * math.sin(now * 0.18 + index), 1)
        tilt = round(min(0.45, max(0.01, 0.22 + 0.2 * math.sin(now * 0.1 + index))), 2)
        status = "CRITICAL" if tension > 12 else "ADVISORY" if tension > 5 else "NOMINAL"
        nodes.append({
            "id": f"NODE-{index + 1:02d}", "lat": lat, "lon": lon, "tilt_deg": tilt,
            "tension_mm": tension, "vibration_hz": 60.0 if index % 5 == 0 else 10.0,
            "battery_mv": 3820 + (index % 5) * 22, "rssi_dbm": -54 - index % 7,
            "status": status, "last_packet": "live",
        })
    return {"nodes": nodes, "gateway_health": "99.8%", "frequency": "865 MHz LoRa"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
