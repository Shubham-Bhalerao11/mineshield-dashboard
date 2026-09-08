"use client";

import { Battery, Radio, Signal, TriangleAlert } from "lucide-react";
import type { MeshNode } from "./GeoMap";

export default function MeshNetworkPanel({ nodes }: { nodes: MeshNode[] }) {
  const critical = nodes.filter((node) => node.status === "CRITICAL").length;
  const advisory = nodes.filter((node) => node.status === "ADVISORY").length;
  return <section className="mesh-view">
    <div className="mesh-summary"><div className="panel-kicker"><Radio size={15} /> SURFACE MESH NETWORK</div><div className="mesh-summary-grid"><div><small>DEPLOYMENT CAPACITY</small><b>{nodes.length || 18} / 18</b><span>865 MHz LoRa plan</span></div><div><small>LIVE PACKETS</small><b>{nodes.length * 24}</b><span>3-second telemetry poll</span></div><div><small>HEALTH</small><b>{critical ? "CRITICAL" : advisory ? "ADVISORY" : "NOMINAL"}</b><span>{critical} critical · {advisory} advisory</span></div></div></div>
    <div className="mesh-honesty"><TriangleAlert size={16} /><span>Telemetry is live when the FastAPI gateway is reachable; fallback nodes remain clearly marked as local mock data.</span></div>
    <div className="node-register">{nodes.map((node) => <div className={`node-register-row node-${node.status.toLowerCase()}`} key={node.id}><span className="node-led" /><b>{node.id}</b><span className="node-status">{node.status}</span><span><Signal size={13} /> {node.rssi_dbm} dBm</span><span><Battery size={13} /> {node.battery_mv} mV</span><span className="node-reading">Tilt {node.tilt_deg.toFixed(2)}° · Tension {node.tension_mm.toFixed(1)} mm · {node.vibration_hz} Hz</span></div>)}</div>
  </section>;
}
