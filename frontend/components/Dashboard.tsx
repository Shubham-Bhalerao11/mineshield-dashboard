"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Bell, CheckCircle2, ChevronDown, CircleGauge, ClipboardList,
  Crosshair, Gauge, Layers, Map, Menu, Radio, RefreshCw, ScanLine, Send, Shield,
  Users, Waves, X, Zap,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Bounds, MeshNode } from "./GeoMap";

const GeoMap = dynamic(() => import("./GeoMap"), { ssr: false });

type Section = "Overview" | "Nodes" | "UWB" | "Crack detection" | "Displacement" | "Tilt & vibration" | "Scanned room" | "GIS & risk" | "Alerts";
type Zone = "Red" | "Yellow" | "Green";

const nav: { label: Section; icon: typeof Gauge }[] = [
  { label: "Overview", icon: Gauge }, { label: "Nodes", icon: Radio }, { label: "Crack detection", icon: Activity },
  { label: "Displacement", icon: Crosshair }, { label: "Tilt & vibration", icon: Waves }, { label: "Scanned room", icon: ScanLine }, { label: "UWB", icon: Users },
  { label: "GIS & risk", icon: Map }, { label: "Alerts", icon: Bell },
];
const zones: Record<Zone, { color: string; soft: string }> = {
  Red: { color: "#ef4444", soft: "#fff1f2" }, Yellow: { color: "#eab308", soft: "#fefce8" }, Green: { color: "#16a34a", soft: "#f0fdf4" },
};
const nodes = [
  { id: "N-01", zone: "Red" as Zone, status: "Critical", last: "10:42:18", sensor: "Crack + UWB" },
  { id: "N-02", zone: "Yellow" as Zone, status: "Advisory", last: "10:42:16", sensor: "Tilt + Vibration" },
  { id: "N-03", zone: "Green" as Zone, status: "Reporting", last: "10:42:14", sensor: "Tilt + Vibration" },
  { id: "N-04", zone: "Green" as Zone, status: "Reporting", last: "10:42:13", sensor: "Crack + UWB" },
  { id: "N-05", zone: "Green" as Zone, status: "Reporting", last: "10:42:12", sensor: "Tilt + Vibration" },
];
const workers = [
  ["W-01", "Rohan Patil", "Red"], ["W-02", "Sagar More", "Yellow"], ["W-03", "Pratik Salunke", "Green"],
] as [string, string, Zone][];
const series = [
  { time: "10:00", dx: -210, dy: -330, dz: 1.2, crack: 22, tilt: 1.1, vibration: 0.8 },
  { time: "10:10", dx: -245, dy: -355, dz: 1.8, crack: 31, tilt: 1.4, vibration: 1.1 },
  { time: "10:20", dx: -268, dy: -372, dz: 2.0, crack: 53, tilt: 1.8, vibration: 1.4 },
  { time: "10:30", dx: -252, dy: -360, dz: 1.6, crack: 48, tilt: 1.6, vibration: 1.2 },
  { time: "10:40", dx: -278, dy: -381, dz: 2.4, crack: 67, tilt: 2.1, vibration: 1.9 },
];
const nodeSeries: Record<string, typeof series> = {
  "N-01": series,
  "N-02": series.map((point, index) => ({ ...point, dx: point.dx + 32 - index * 5, dy: point.dy + 120 - index * 7, dz: point.dz + 6, crack: point.crack - 17, tilt: point.tilt - .6, vibration: point.vibration - .4 })),
};
function dataFor(node: string, range: string) {
  const source = nodeSeries[node] ?? series;
  const multiplier = range === "15 min" ? .42 : range === "6 hours" ? 1.18 : range === "All" ? 1.32 : 1;
  return source.map((point, index) => ({ ...point, time: range === "15 min" ? `10:${35 + index}` : range === "6 hours" ? `${index + 5}:00` : range === "All" ? `Sep ${18 + index}` : point.time, dx: Math.round(point.dx * multiplier), dy: Math.round(point.dy * multiplier), dz: Number((point.dz * multiplier).toFixed(1)), crack: Math.round(point.crack * multiplier) }));
}
function formatClock(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function formatDate(date: Date) {
  return date.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}
function LiveClock({ mode = "datetime" }: { mode?: "datetime" | "time" }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <>{now ? mode === "time" ? formatClock(now) : `${formatDate(now)} · ${formatClock(now)}` : "Syncing clock..."}</>;
}
const bounds: Bounds = { west: 82.635, south: 22.312, east: 82.725, north: 22.378 };
const meshNodes: MeshNode[] = nodes.map((node, index) => ({
  id: node.id, lat: 22.322 + index * .012, lon: 82.645 + index * .018, tilt_deg: series[4].tilt,
  tension_mm: series[4].crack, vibration_hz: series[4].vibration, battery_mv: 3800, rssi_dbm: -58,
  status: node.zone === "Red" ? "CRITICAL" : node.zone === "Yellow" ? "ADVISORY" : "NOMINAL", last_packet: node.last,
}));

function Pill({ zone, children }: { zone: Zone; children: React.ReactNode }) {
  return <span className="zone-pill" style={{ color: zones[zone].color, background: zones[zone].soft }}><i style={{ background: zones[zone].color }} />{children}</span>;
}
function StatCard({ label, value, detail, tone = "default", icon: Icon }: { label: string; value: string; detail: React.ReactNode; tone?: string; icon: typeof Gauge }) {
  return <article className={`proto-stat ${tone}`}><div className="stat-icon"><Icon size={18} /></div><small>{label}</small><strong>{value}</strong><span>{detail}</span></article>;
}
function MetricChart({ title, keys, height = 260, data = series }: { title: string; keys: { key: string; color: string }[]; height?: number; data?: typeof series }) {
  return <article className="proto-chart"><header><b>{title}</b><div>{keys.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.key}</span>)}</div></header><ResponsiveContainer width="100%" height={height}><LineChart data={data}><CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" /><XAxis dataKey="time" stroke="#94a3b8" fontSize={11} /><YAxis stroke="#94a3b8" fontSize={11} /><Tooltip /><Line type="monotone" dataKey={keys[0].key} stroke={keys[0].color} strokeWidth={2.5} dot={false} />{keys.slice(1).map((item) => <Line key={item.key} type="monotone" dataKey={item.key} stroke={item.color} strokeWidth={2.5} dot={false} />)}</LineChart></ResponsiveContainer></article>;
}

export default function Dashboard() {
  const [section, setSection] = useState<Section>("Overview");
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertSent, setAlertSent] = useState(false);
  const [mapStyle, setMapStyle] = useState<"Satellite" | "Street">("Satellite");
  const [mapView, setMapView] = useState<"Geographic" | "Plan">("Geographic");
  const [range, setRange] = useState("1 hour");
  const [showMesh, setShowMesh] = useState(true);
  const [selectedNode, setSelectedNode] = useState("N-01");
  const [resurveyed, setResurveyed] = useState(false);
  const selected = nodes.find((node) => node.id === selectedNode) ?? nodes[0];
  const location = useMemo(() => selected.id === "N-01" ? [22.334, 82.671] as [number, number] : null, [selected.id]);
  const chartTitle = section === "Crack detection" ? "Coherently moved cells per sweep" : section === "Tilt & vibration" ? "Tilt and vibration history" : "Centroid shift per axis, from the LiDAR";

  const content =     section === "Overview" ? <Overview onNavigate={setSection} onAlert={() => { setAlertSent(false); setAlertOpen(true); }} /> :
  section === "Nodes" ? <Nodes selected={selectedNode} onSelect={setSelectedNode} /> :
    section === "UWB" ? <UWB /> :
    section === "Crack detection" ? <CrackDetection /> :
    section === "Displacement" ? <Displacement range={range} setRange={setRange} selected={selectedNode} setSelected={setSelectedNode} /> :
    section === "Tilt & vibration" ? <><PageHeading title="Tilt & vibration" subtitle="Live motion signals from the five-node prototype network." /><MetricChart title={chartTitle} keys={[{ key: "tilt", color: "#2563eb" }, { key: "vibration", color: "#0f766e" }]} /><div className="proto-grid-3"><StatCard label="Peak tilt" value="2.1°" detail="N-01 · warning threshold 5°" icon={Crosshair} tone="warning" /><StatCard label="Peak vibration" value="1.9 mm/s" detail="N-01 · within prototype limit" icon={Waves} /><StatCard label="Signal health" value="100%" detail="5 of 5 nodes reporting" icon={Radio} tone="success" /></div></> :
    section === "Scanned room" ? <Room /> :
    section === "GIS & risk" ? <GIS mapStyle={mapStyle} setMapStyle={setMapStyle} mapView={mapView} setMapView={setMapView} showMesh={showMesh} setShowMesh={setShowMesh} resurveyed={resurveyed} onResurvey={() => setResurveyed(true)} /> :
    <Alerts onSend={() => setAlertOpen(true)} />;

  return <main className="prototype-shell">
    <header className="prototype-header"><div className="prototype-brand"><button className="icon-button" aria-label="Menu"><Menu size={20} /></button><div className="brand-badge"><Shield size={19} /></div><div><b>Mine Subsidence Monitoring</b><small>Integrated IoT · UWB mesh · GIS · Early warning</small></div></div><div className="header-meta"><span>Host <LiveClock mode="time" /></span><strong><i /> Host connected</strong><span><LiveClock /></span><button className="header-alert" onClick={() => { setAlertSent(false); setAlertOpen(true); }}><Bell size={18} /><em>1</em></button></div></header>
    <div className="prototype-body"><aside className="prototype-sidebar"><small className="sidebar-label">MONITORING SECTIONS</small><nav>{nav.map(({ label, icon: Icon }) => <button key={label} className={section === label ? "active" : ""} onClick={() => setSection(label)}><Icon size={16} />{label}{label === "Alerts" && <b>1</b>}</button>)}</nav><div className="sidebar-host"><small>HOST</small><span>Uptime <b>27 min</b></span><span>Nodes seen <b>5 / 5</b></span><span>Workers <b>3 underground</b></span></div></aside><section className="prototype-main"><div className="breadcrumb">MONITORING / {section.toUpperCase()} <span><i /> Live prototype data</span></div>{content}</section></div>
    {alertOpen && <AlertComposer onClose={() => setAlertOpen(false)} sent={alertSent} onSend={() => { setAlertSent(true); window.setTimeout(() => setAlertOpen(false), 900); }} />}
  </main>;
}

function PageHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <header className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</header>;
}
function Overview({ onNavigate, onAlert }: { onNavigate: (section: Section) => void; onAlert: () => void }) {
  return <><PageHeading title="Overview" subtitle="Prototype mine monitoring dashboard · all values are simulated for demonstration." action={<button className="primary-action" onClick={onAlert}><Send size={14} /> Send alert signal</button>} /><div className="proto-grid-4"><StatCard label="Mine status" value="NORMAL" detail="Last sync · live" icon={CheckCircle2} tone="success" /><StatCard label="Sensor network" value="5 / 5" detail="All nodes reporting" icon={Radio} tone="success" /><StatCard label="UWB workers" value="3" detail="1 red · 1 yellow · 1 green" icon={Users} /><StatCard label="Current alert" value="1 active" detail="Crack propagation · N-01" icon={AlertTriangle} tone="danger" /></div><div className="proto-overview-grid"><section className="proto-panel overview-map"><div className="panel-title"><div><b>Mine GIS map</b><small>Risk zones and live UWB worker positions</small></div><button className="text-action" onClick={() => onNavigate("GIS & risk")}>Open GIS & risk <ChevronDown size={14} /></button></div><div className="overview-map-canvas"><GeoMap bounds={bounds} nodes={meshNodes} /></div></section><section className="proto-panel"><div className="panel-title"><div><b>UWB workers status</b><small>One worker in each risk zone</small></div><button className="text-action" onClick={() => onNavigate("UWB")}>Open UWB</button></div><div className="worker-summary"><strong>3<small>total workers</small></strong><div><Pill zone="Red">1 worker</Pill><Pill zone="Yellow">1 worker</Pill><Pill zone="Green">1 worker</Pill></div></div><div className="worker-list">{workers.map(([id, name, zone]) => <div key={id}><Pill zone={zone}>{zone}</Pill><span>{id} · {name}</span><b>Working</b></div>)}</div><button className="secondary-action" onClick={() => onNavigate("UWB")}>View UWB tracking</button></section></div><div className="proto-overview-grid lower"><section className="proto-panel"><div className="panel-title"><div><b>Environmental conditions</b><small>Prototype measures humidity only</small></div><span className="live-badge">● LIVE</span></div><div className="humidity-card"><Gauge size={27} /><strong>68<small>% RH</small></strong><span>Normal range<br /><b>45–80% RH</b></span></div><div className="humidity-bar"><i /></div></section><section className="proto-panel"><div className="panel-title"><div><b>Current alert</b><small>Only crack propagation is enabled</small></div><Pill zone="Red">Active</Pill></div><div className="alert-preview"><AlertTriangle size={22} /><div><b>Crack propagation detected</b><span>Node N-01 · Live</span></div><button onClick={onAlert}>Manage</button></div></section></div></>;
}
function UWB() {
  return <><PageHeading title="UWB worker tracking" subtitle="Live prototype positions for underground workers by GIS risk zone." action={<span className="live-badge">● LIVE · UWB mesh connected</span>} /><div className="proto-grid-3"><StatCard label="Workers tracked" value="3 / 3" detail="All UWB tags reporting" icon={Users} tone="success" /><StatCard label="Red zone" value="1" detail="Rohan Patil · Working" icon={Radio} tone="danger" /><StatCard label="Yellow / Green" value="1 / 1" detail="One worker in each zone" icon={Map} /></div><section className="proto-panel uwb-panel"><div className="panel-title"><div><b>UWB live location map</b><small>Worker positions are simulated for the prototype</small></div><Pill zone="Green">3 tags connected</Pill></div><div className="uwb-map"><GeoMap bounds={bounds} nodes={meshNodes} /></div></section><section className="proto-panel uwb-table"><div className="panel-title"><div><b>Worker status</b><small>All three workers are currently working underground</small></div></div><div className="worker-list">{workers.map(([id, name, zone], index) => <div key={id}><Pill zone={zone}>{zone}</Pill><span><b>{id}</b> · {name}</span><span>UWB tag UWB-{index + 1}</span><b>Working</b></div>)}</div></section></>;
}
function Nodes({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const lastSeen = (index: number) => formatClock(new Date(now.getTime() - index * 2000));
  return <><PageHeading title="Nodes" subtitle="Sensor inventory reported by each node in the five-node prototype network." action={<button className="secondary-action" onClick={() => onSelect(selected)}><RefreshCw size={14} /> Refresh</button>} /><section className="proto-panel table-panel"><table><thead><tr><th>Node</th><th>Status</th><th>Zone</th><th>Last seen</th><th>Crack detector</th><th>UWB</th><th>Tilt & vibration</th></tr></thead><tbody>{nodes.map((node, index) => <tr key={node.id} className={selected === node.id ? "selected-row" : ""} onClick={() => onSelect(node.id)}><td><b>{node.id}</b></td><td><span className={`status-dot ${node.zone.toLowerCase()}`} />{node.status}</td><td><Pill zone={node.zone}>{node.zone} zone</Pill></td><td>{lastSeen(index)}</td><td className="yes">connected</td><td className="yes">connected</td><td className="yes">connected</td></tr>)}</tbody></table></section><div className="node-card-grid">{nodes.map((node, index) => <article className="proto-panel node-card" key={node.id}><header><div><b>{node.id}</b><small>Last frame {lastSeen(index)} · seq {1861 - index * 17}</small></div><Pill zone={node.zone}>{node.status}</Pill></header><h4>SENSORS</h4>{["Crack detection", "UWB position", "Tilt & vibration", "Humidity"].map((sensor) => <div className="sensor-row" key={sensor}><span>{sensor}</span><b>connected</b></div>)}</article>)}</div></>;
}
function Displacement({ range, setRange, selected, setSelected }: { range: string; setRange: (v: string) => void; selected: string; setSelected: (v: string) => void }) {
  const data = dataFor(selected, range);
  return <><PageHeading title="Displacement" subtitle="Bulk movement of the scanned surface and where the selected node sits." action={<div className="segmented">{nodes.slice(0, 2).map((node) => <button key={node.id} className={selected === node.id ? "active" : ""} onClick={() => setSelected(node.id)}>{node.id}</button>)}{["15 min", "1 hour", "6 hours", "All"].map((item) => <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item}</button>)}</div>} /><div className="proto-grid-4"><StatCard label="ΔX" value={`${data[data.length - 1].dx} mm`} detail="Centroid shift" icon={Crosshair} /><StatCard label="ΔY" value={`${data[data.length - 1].dy} mm`} detail="Centroid shift" icon={Crosshair} /><StatCard label="ΔZ" value={`+${data[data.length - 1].dz} mm`} detail="Centroid shift" icon={Crosshair} /><StatCard label="Sweep noise" value={selected === "N-01" ? "1.41 mm" : "1.20 mm"} detail="Instrument floor" icon={Activity} /></div><MetricChart title="Centroid shift per axis, from the LiDAR" data={data} keys={[{ key: "dx", color: "#475569" }, { key: "dy", color: "#54aaa4" }, { key: "dz", color: "#b08d46" }]} /><div className="proto-grid-2"><InfoPanel title={`Node position · ${selected}`}><b>{selected === "N-01" ? "2.070 m" : "1.030 m"}</b><span>X position</span><b>{selected === "N-01" ? "0.760 m" : "0.240 m"}</b><span>Y position</span></InfoPanel><InfoPanel title="Scan quality"><b>{selected === "N-01" ? "12,150" : "12,126"}</b><span>Points this sweep</span><b>{selected === "N-01" ? "1.41 mm" : "1.20 mm"}</b><span>Per-beam noise</span></InfoPanel></div></>;
}
function CrackDetection() {
  const [selected, setSelected] = useState("N-02");
  const [range, setRange] = useState("1 hour");
  const data = dataFor(selected, range);
  return <><PageHeading title="Crack detection" subtitle="Each sweep is scored by the prototype crack detector. Current alert: crack propagation." action={<div className="segmented">{nodes.slice(0, 2).map((node) => <button key={node.id} className={selected === node.id ? "active" : ""} onClick={() => setSelected(node.id)}>{node.id}</button>)}{["15 min", "1 hour", "6 hours", "All"].map((item) => <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item}</button>)}</div>} /><div className="proto-grid-4"><StatCard label="Detector cells" value={`${selected === "N-01" ? 53 : 36}`} detail="Clustered, labelled crack cells" icon={Activity} /><StatCard label="Max residual" value={`${selected === "N-01" ? "-3276.8" : "-2184.4"} mm`} detail="Single largest beam" icon={Crosshair} tone="danger" /><StatCard label="Sweep noise" value={selected === "N-01" ? "1.20 mm" : "1.05 mm"} detail="Instrument floor" icon={Gauge} /><StatCard label="State" value={selected === "N-01" ? "Warning" : "Nominal"} detail="Displacement above baseline" icon={AlertTriangle} tone={selected === "N-01" ? "warning" : "success"} /></div><MetricChart title="Coherently moved cells per sweep" data={data} keys={[{ key: "crack", color: "#475569" }]} /><MetricChart title="Max residual, per sweep" data={data.map((point) => ({ ...point, crack: point.crack * -48 }))} keys={[{ key: "crack", color: "#718b9b" }]} height={210} /><section className="proto-panel explanatory"><b>The detector</b><p>Detector cells represent connected clusters where the measured displacement differs from the stored baseline. This prototype uses simulated readings so the alert and trend interactions can be demonstrated without hardware.</p></section></>;
}
function GIS({ mapStyle, setMapStyle, mapView, setMapView, showMesh, setShowMesh, resurveyed, onResurvey }: { mapStyle: "Satellite" | "Street"; setMapStyle: (v: "Satellite" | "Street") => void; mapView: "Geographic" | "Plan"; setMapView: (v: "Geographic" | "Plan") => void; showMesh: boolean; setShowMesh: (v: boolean) => void; resurveyed: boolean; onResurvey: () => void }) { return <><PageHeading title="GIS & risk zones" subtitle="Monitored area with risk shaded from the prototype live measurements." action={<div className="gis-actions"><div className="segmented"><button className={mapView === "Plan" ? "active" : ""} onClick={() => setMapView("Plan")}>Plan</button><button className={mapView === "Geographic" ? "active" : ""} onClick={() => setMapView("Geographic")}>Geographic</button></div><div className="segmented"><button className={mapStyle === "Satellite" ? "active" : ""} onClick={() => setMapStyle("Satellite")}>Satellite</button><button className={mapStyle === "Street" ? "active" : ""} onClick={() => setMapStyle("Street")}>Street</button></div><button className="secondary-action" onClick={onResurvey}><RefreshCw size={14} /> {resurveyed ? "Origin updated" : "Re-survey origin"}</button></div>} /><section className="proto-panel gis-panel"><div className="gis-map-large"><GeoMap bounds={bounds} nodes={showMesh ? meshNodes : []} baseStyle={mapStyle} view={mapView} /><div className="map-overlay-label"><Layers size={14} /> {mapView} view · {mapStyle} map</div><button className="map-toggle" onClick={() => setShowMesh(!showMesh)}>{showMesh ? "Hide nodes" : "Show nodes"}</button></div></section><div className="proto-grid-3"><InfoPanel title="Risk zones"><Pill zone="Green">Nominal · 3 nodes</Pill><Pill zone="Yellow">Elevated · 1 node</Pill><Pill zone="Red">Critical · 1 node</Pill></InfoPanel><InfoPanel title="Measured vs judged"><p>Measured inputs are simulated humidity, crack, tilt, vibration, and UWB presence. Risk judgement combines the active crack rule with zone thresholds.</p></InfoPanel><InfoPanel title="Origin"><b>22.3340° N</b><span>82.6710° E</span><small>{resurveyed ? "Updated just now" : "Last survey · 22 Sep 2026"}</small></InfoPanel></div></>; }
function Room() {
  const [scanMode, setScanMode] = useState<"live" | "point-cloud" | "reference">("live");
  const modeDetails = {
    live: { title: "ROOM A · LIVE LIDAR SWEEP", detail: "12,150 points · 94% matched", result: "Surface deviation +2.4 mm" },
    "point-cloud": { title: "ROOM A · POINT CLOUD ANALYSIS", detail: "12,150 points · 3 structural faces", result: "Point density 98.1% · 28 inspection clusters" },
    reference: { title: "ROOM A · REFERENCE COMPARISON", detail: "Current scan aligned to baseline", result: "Variance +2.4 mm · within review threshold" },
  }[scanMode];
  return <><PageHeading title="Scanned room" subtitle="Prototype scan coverage and room-level structural status." action={<div className="segmented"><button className={scanMode === "live" ? "active" : ""} onClick={() => setScanMode("live")}>Live scan</button><button className={scanMode === "point-cloud" ? "active" : ""} onClick={() => setScanMode("point-cloud")}>Point cloud</button><button className={scanMode === "reference" ? "active" : ""} onClick={() => setScanMode("reference")}>Reference</button></div>} /><div className={`room-visual room-mode-${scanMode}`}><div className="room-grid-lines" /><div className="scan-sweep sweep-one" /><div className="scan-sweep sweep-two" /><div className="point-cloud">{Array.from({ length: scanMode === "point-cloud" ? 56 : 28 }, (_, index) => <i key={index} style={{ left: `${12 + (index * 31) % 78}%`, top: `${18 + (index * 47) % 64}%`, opacity: .35 + (index % 5) * .12 }} />)}</div><div className="room-shape"><span>N-01 <small>critical face</small></span><span>N-02 <small>monitor</small></span><span>N-03 <small>nominal</small></span></div><div className="scan-callout"><b>{modeDetails.title}</b><span>{modeDetails.detail}</span><strong>{modeDetails.result}</strong></div><div className="room-legend"><Pill zone="Red">Critical face</Pill><Pill zone="Yellow">Monitor closely</Pill><Pill zone="Green">Nominal scan</Pill></div></div><div className="proto-grid-3"><StatCard label="Points this scan" value="12,150" detail={scanMode === "point-cloud" ? "Point cloud density view" : "Latest room sweep"} icon={ScanLine} /><StatCard label="Coverage" value="94%" detail={scanMode === "reference" ? "Compared with baseline" : "Reference surfaces matched"} icon={CircleGauge} tone="success" /><StatCard label="Scan status" value={scanMode === "reference" ? "Compared" : "Complete"} detail={scanMode === "point-cloud" ? "Cluster analysis ready" : "Next sweep in 15 minutes"} icon={CheckCircle2} tone="success" /></div><div className="proto-grid-3 room-detail-grid"><InfoPanel title="Surface quality"><b>{scanMode === "reference" ? "Baseline aligned" : "Good"}</b><span>Edge alignment 98.1%</span></InfoPanel><InfoPanel title="Structural faces"><b>3 monitored</b><span>1 critical · 1 advisory · 1 nominal</span></InfoPanel><InfoPanel title="Next action"><b>{scanMode === "point-cloud" ? "Review clusters" : "Rescan in 15 min"}</b><span>Keep LiDAR host connected</span></InfoPanel></div></>;
}
function Alerts({ onSend }: { onSend: () => void }) { return <><PageHeading title="Alerts" subtitle="Alert history and incident timeline. The prototype currently focuses on crack propagation." action={<button className="primary-action" onClick={onSend}><Send size={14} /> Send alert signal</button>} /><div className="alert-layout"><section className="proto-panel timeline"><div className="timeline-item critical"><span>10:42 PM</span><div><Pill zone="Red">Red zone</Pill><b>Crack propagation detected</b><p>Node N-01 · Roof section A · immediate inspection required.</p></div><strong>Ongoing</strong></div><div className="timeline-item"><span>09:58 PM</span><div><Pill zone="Yellow">Yellow zone</Pill><b>Baseline scan completed</b><p>Five nodes reported successfully. No additional incidents.</p></div><strong>Resolved</strong></div></section><section className="proto-panel"><div className="panel-title"><b>Incidents summary</b></div><div className="incident-total">1 <small>Total incident</small></div><div className="incident-bars"><span>Crack propagation <b>1</b></span><i style={{ width: "100%" }} /></div><button className="secondary-action full" onClick={onSend}>Open manual alert composer</button></section></div></>; }
function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="proto-panel info-panel"><b>{title}</b><div>{children}</div></section>; }
function AlertComposer({ onClose, onSend, sent }: { onClose: () => void; onSend: () => void; sent: boolean }) {
  const [zone, setZone] = useState<Zone>("Red");
  const [tab, setTab] = useState<"create" | "history">("create");
  return <div className="proto-modal-backdrop"><section className="proto-modal"><header><div><Send size={19} /><b>Send alert signals</b></div><button onClick={onClose}><X size={18} /></button></header>{sent ? <div className="sent-state"><CheckCircle2 size={42} /><h2>Alert signal sent</h2><p>Prototype notification dispatched to control room channels.</p></div> : <><div className="modal-tabs"><button className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}>Create alert</button><button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Alert history</button></div>{tab === "history" ? <div className="modal-history"><div><Pill zone="Red">Red zone</Pill><b>Crack propagation detected</b><small>{formatDate(new Date())} · Node N-01 · Ongoing</small></div><div><Pill zone="Yellow">Yellow zone</Pill><b>Baseline scan completed</b><small>Resolved · Five nodes reported successfully</small></div></div> : <><h3>1. Choose alert type</h3><div className="alert-type selected"><AlertTriangle size={21} /><div><b>Crack propagation</b><small>Immediate structural inspection required</small></div></div><h3>2. Select region / zone</h3><div className="zone-select">{(["Red", "Yellow", "Green"] as Zone[]).map((item) => <button key={item} className={zone === item ? "selected" : ""} onClick={() => setZone(item)}><Pill zone={item}>{item} zone</Pill></button>)}</div><h3>3. Alert message</h3><p className="modal-message">Crack propagation detected at Node N-01. Inspect the affected roof section and confirm worker safety.</p><h3>4. Notification channels</h3>{["SMS to registered numbers", "Siren / buzzer", "Control room display", "Email (optional)"].map((item, index) => <label className="channel" key={item}>{item}<input type="checkbox" defaultChecked={index < 3} /></label>)}<button className="send-alert" onClick={onSend}><Send size={16} /> Send alert</button><small className="confirm-note">Alert will be sent only after your confirmation.</small></>}</>}</section></div>;
}
