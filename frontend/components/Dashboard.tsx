"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Activity, Clock3, Map, Radio, ShieldCheck, Zap, Crosshair, Siren, RadioTower } from "lucide-react";
import type { Bounds, MeshNode } from "./GeoMap";
import AnalyticsDeck from "./AnalyticsDeck";
import AlertTable, { AlertEvent } from "./AlertTable";
import MeshNetworkPanel from "./MeshNetworkPanel";
import StatutoryFeed from "./StatutoryFeed";
import StrataInspector from "./StrataInspector";

const GeoMap = dynamic(() => import("./GeoMap"), { ssr: false });
const API = "http://localhost:8000";
const DATA_BOUNDS: Bounds = { west: 82.635, south: 22.312, east: 82.725, north: 22.378 };
type Tab = "geoint" | "mesh" | "ai" | "compliance";
type Inspection = { lat: number; lon: number; coordinates?: { lat: number; lon: number }; cumulative_displacement_cm: number; pixel_status: string; nearest_patch: string; strata_regime?: string; time_series: { day: string; displacement: number }[] };
type Status = { monitored_area: number; critical_zones: number; watch_zones: number; patches_processed: number; peak_displacement_cm: number; stability_index: number; active_nodes_count: number; bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number } };

const DEFAULT_STATUS: Status = {
  monitored_area: 17_923, critical_zones: 13_431, watch_zones: 2_706,
  patches_processed: 5980,
  peak_displacement_cm: -8.43,
  stability_index: 47.2,
  active_nodes_count: 18,
  bounds: { minLat: DATA_BOUNDS.south, maxLat: DATA_BOUNDS.north, minLon: DATA_BOUNDS.west, maxLon: DATA_BOUNDS.east },
};

const MOCK_NODES: MeshNode[] = Array.from({ length: 18 }, (_, index) => ({
  id: `NODE-${String(index + 1).padStart(2, "0")}`,
  lat: 22.316 + (index % 6) * 0.010,
  lon: 82.640 + Math.floor(index / 6) * 0.028,
  tilt_deg: Number((0.12 + (index % 4) * 0.08).toFixed(2)),
  tension_mm: Number((2.4 + (index % 5) * 0.7).toFixed(1)),
  vibration_hz: index % 7 === 0 ? 60 : 10,
  battery_mv: 3820 - (index % 6) * 55,
  rssi_dbm: -58 - (index % 5) * 4,
  status: index === 13 ? "ADVISORY" : "NOMINAL",
  last_packet: new Date().toISOString(),
}));

function normalizeStatus(value: Partial<Status>): Status {
  return {
    ...DEFAULT_STATUS,
    ...value,
    bounds: { ...DEFAULT_STATUS.bounds, ...(value.bounds ?? {}) },
  };
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("geoint");
  const [bounds, setBounds] = useState(DATA_BOUNDS);
  const [advisoryOpen, setAdvisoryOpen] = useState(true);
  const [operatorAction, setOperatorAction] = useState("MONITORING");
  const [status, setStatus] = useState<Status>(DEFAULT_STATUS);
  const [nodes, setNodes] = useState<MeshNode[]>(MOCK_NODES);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [utc, setUtc] = useState("--:--:--");

  useEffect(() => {
    const tick = () => setUtc(new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()));
    tick(); const clock = window.setInterval(tick, 1000);
    const loadStatus = async () => {
      try {
        const response = await fetch(`${API}/api/v1/system/status`);
        if (!response.ok) throw new Error(`Status request failed: ${response.status}`);
        const nextStatus = normalizeStatus(await response.json());
        setStatus(nextStatus);
        setBounds({ west: nextStatus.bounds.minLon, south: nextStatus.bounds.minLat, east: nextStatus.bounds.maxLon, north: nextStatus.bounds.maxLat });
      } catch { setStatus(DEFAULT_STATUS); }
    };
    const loadNodes = async () => {
      try {
        const response = await fetch(`${API}/api/v1/mesh/telemetry`);
        if (!response.ok) throw new Error(`Telemetry request failed: ${response.status}`);
        const value = await response.json();
        setNodes(Array.isArray(value.nodes) && value.nodes.length ? value.nodes : MOCK_NODES);
      } catch { setNodes(MOCK_NODES); }
    };
    loadStatus(); loadNodes(); const telemetry = window.setInterval(loadNodes, 3000);
    return () => { window.clearInterval(clock); window.clearInterval(telemetry); };
  }, []);

  const inspect = async ([lat, lon]: [number, number]) => {
    try {
      const response = await fetch(`${API}/api/v1/inspect/pixel?lat=${lat}&lon=${lon}`);
      if (!response.ok) throw new Error(`Inspection request failed: ${response.status}`);
      setInspection(await response.json());
    } catch {
      const displacement = -Math.max(0.35, 4.927 - Math.hypot(lat - 22.345, lon - 82.68) * 80);
      setInspection({
        lat, lon,
        cumulative_displacement_cm: displacement,
        pixel_status: Math.abs(displacement) >= 2 ? "Critical" : "Safe",
        nearest_patch: "patch_003055_r04715_c13325.npy",
        strata_regime: "Offline raster estimate · verify against live API",
        time_series: [{ day: "Day -14", displacement: displacement * .16 }, { day: "Day -7", displacement: displacement * .49 }, { day: "Day 0", displacement }, { day: "Day +7 (Pred)", displacement: displacement * 1.44 }],
      });
    }
  };
  const peak = Math.abs(status?.peak_displacement_cm ?? 8.43);
  const peakValue = (status?.peak_displacement_cm ?? -8.43).toFixed(2);
  const alerts: AlertEvent[] = [{ id: "insar-peak", severity: peak > 5 ? "critical" : "warning", message: `AI displacement peak ${peakValue} cm exceeds the 5 cm statutory review threshold.`, csri: Math.min(1, peak / 8.43), timestamp: utc }];
  const nodeAlertCount = nodes.filter((node) => node.status === "CRITICAL").length;
  const tabs = useMemo(() => [["geoint", "GEOINT MAP", Map], ["mesh", "MESH NETWORK", Radio], ["ai", "AI EARLY WARNING", Zap], ["compliance", "DATA & COMPLIANCE", ShieldCheck]] as const, []);

  return <main className="mission-shell"><div className="mission-map"><GeoMap bounds={bounds} nodes={nodes} onInspect={inspect} onSelect={(node) => inspect([node.lat, node.lon])} /></div><header className="hud-top"><div className="hud-brand"><span className="brand-mark"><ShieldCheck size={21} strokeWidth={2.5} /></span><div><b>MINESHIELD OCC</b><small>SURFACE SUBSIDENCE & STRATA INTELLIGENCE</small></div><span className="connection-dot" /></div><div className="hud-chips"><span>SECL</span><span>KORBA AREA</span><span>JAWBONE SEAM</span></div><nav className="hud-tabs">{tabs.map(([key, label, Icon]) => <button key={key} className={tab === key ? "hud-tab active" : "hud-tab"} onClick={() => setTab(key)}><Icon size={14} />{label}</button>)}</nav><div className="hud-status"><strong>OCC ONLINE</strong><strong>AI DATASET ARMED: ACTIVE</strong><span className="ist-clock"><Clock3 size={13} /> IST {utc}</span></div></header>
  <section className="hud-kpis"><div><small>AREA MONITORED</small><b>{(status?.monitored_area ?? 17_923).toLocaleString()} <em>km² approx</em></b></div><div className="hud-danger"><small>CRITICAL ZONES</small><b>{(status?.critical_zones ?? 13_431).toLocaleString()} <em>pixels</em></b></div><div className="hud-warn"><small>WATCH ZONES</small><b>{(status?.watch_zones ?? 2_706).toLocaleString()} <em>pixels</em></b></div><div><small>STABILITY INDEX</small><b>{(status?.stability_index ?? 47.2).toFixed(1)} <em>/ 100</em></b></div><div><small>AI PATCHES</small><b>{(status?.patches_processed ?? 5980).toLocaleString()} <em>paired patches</em></b></div></section>
  {advisoryOpen && <div className="hazard-banner"><b><Siren size={14} /> HAZARD ADVISORY</b><span>13,431 pixels exceed the critical displacement threshold (2.0 cm). Prioritise field verification and asset overlay review.</span><div className="operator-actions"><button className="action-ack" onClick={() => { setOperatorAction("ACKNOWLEDGED"); setAdvisoryOpen(false); }}>ACKNOWLEDGE</button><button className="action-dispatch" onClick={() => setOperatorAction("FIELD VERIFICATION DISPATCHED")}><RadioTower size={13} /> DISPATCH FIELD CHECK</button></div></div>}
  {operatorAction !== "MONITORING" && <div className="operator-state"><ShieldCheck size={13} /> OPERATOR ACTION: {operatorAction}</div>}
  <aside className="hud-left"><div className="hud-filter"><span>DATASET</span><b>AI_Displacement_Dataset</b><span>CRITICAL THRESHOLD</span><b>2.00 cm</b><span>WATCH THRESHOLD</span><b>0.50 cm</b></div><StrataInspector /></aside>
  <aside className={`hud-right ${inspection ? "inspector-open" : ""}`}>{inspection ? <div className="pixel-inspector"><div className="panel-kicker"><Crosshair size={15} /> PIXEL INSPECTOR</div><h2 className={inspection.pixel_status.toLowerCase()}>{inspection.pixel_status}</h2><div className="inspect-coordinates">LAT {inspection.lat.toFixed(5)} / LON {inspection.lon.toFixed(5)}</div><div className="inspect-metrics"><div><small>CUMULATIVE DISPLACEMENT</small><b>{inspection.cumulative_displacement_cm.toFixed(3)} cm</b></div><div><small>OBSERVATION FILE</small><b>{inspection.nearest_patch}</b></div></div><div className="inspect-strata">{inspection.strata_regime}</div><div className="mini-series">{inspection.time_series.map((point) => <i key={point.day} style={{ height: `${Math.max(4, Math.abs(point.displacement) / Math.max(1, peak) * 100)}%` }} title={`${point.day}: ${point.displacement} cm`} />)}</div><button className="drawer-close" onClick={() => setInspection(null)}>CLOSE INSPECTOR</button></div> : <AnalyticsDeck mode={tab === "ai" ? "prediction" : "overview"} />}</aside>
  {tab === "mesh" && <div className="hud-modal"><MeshNetworkPanel nodes={nodes} /></div>}{tab === "compliance" && <div className="hud-modal"><StatutoryFeed alerts={alerts} /></div>}{tab === "ai" && !inspection && <div className="hud-ai-badge"><Activity size={15} /> AI ENGINE: DERIVED FROM LOCAL DISPLACEMENT COG / {nodeAlertCount} LIVE NODE CRITICAL</div>}
  <div className="hud-bottom"><AlertTable alerts={alerts} /></div></main>;
}

function CrosshairIcon() { return <span className="crosshair-icon">+</span>; }
