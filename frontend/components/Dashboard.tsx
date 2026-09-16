"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Bell, Check, CheckCircle2, ChevronRight, CircleAlert, Gauge,
  HardHat, LayoutDashboard, MapPin, Menu, Radio, Settings, Shield, Siren,
  UserRound, Users, Volume2, Wifi, Wrench, X, Zap,
} from "lucide-react";
import { CartesianGrid, Cell, Line, LineChart, PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Bounds, MeshNode } from "./GeoMap";
import TopNavbar, { DashboardAlert } from "./TopNavbar";
import EmergencyRouteModal from "./Modals/EmergencyRouteModal";
import MaintenanceModal from "./Modals/MaintenanceModal";

const GeoMap = dynamic(() => import("./GeoMap"), { ssr: false });
const API = "http://localhost:8001";

type Sensor = { id: string; tilt: number; vib: number; disp: number; crack: number };
type LivePayload = {
  system_status: { online: boolean; timestamp: string };
  alert: { active: boolean; type: string; node: string; zone: string; description: string };
  mine_overview: { status: string; active_alerts: number; nodes_online: number; total_nodes: number; personnel: number };
  communications: { received: number; lost_pct: number; last_packet_sec: number };
  danger_meter: { risk_pct: number; trend: string };
  environment: { methane: number; temperature: number; humidity: number; co_ppm: number; air_quality: string };
  personnel: { normal: number; caution: number; unaccounted: number };
  network: { online: number; weak: number; offline: number; lora_health: number };
  live_sensors: { time_label: string; nodes: Sensor[] };
};

const initial: LivePayload = {
  system_status: { online: true, timestamp: new Date().toISOString() },
  alert: { active: true, type: "Rock Fall / Crack Propagation", node: "N-17", zone: "Zone B (Lat 18.4567, Long 73.8567)", description: "Crack propagation detected in roof section" },
  mine_overview: { status: "NORMAL", active_alerts: 2, nodes_online: 38, total_nodes: 40, personnel: 126 },
  communications: { received: 12486, lost_pct: .8, last_packet_sec: 2 },
  danger_meter: { risk_pct: 18, trend: "Increasing" },
  environment: { methane: .42, temperature: 29.4, humidity: 78, co_ppm: 12, air_quality: "Normal" },
  personnel: { normal: 118, caution: 6, unaccounted: 2 },
  network: { online: 37, weak: 2, offline: 1, lora_health: 96 },
  live_sensors: { time_label: "11:00:00", nodes: [
    { id: "N-09", tilt: .5, vib: 1.2, disp: 12, crack: 1 }, { id: "N-12", tilt: .8, vib: 2.1, disp: 15, crack: 1.5 },
    { id: "N-17", tilt: 1.4, vib: 3.8, disp: 28, crack: 4.2 }, { id: "N-21", tilt: .2, vib: .5, disp: 5, crack: .2 },
  ] },
};

const metricData = (key: keyof Sensor, history: LivePayload[]) => history.map((entry, index) => ({ time: entry.live_sensors.time_label || `${index}`, ...Object.fromEntries(entry.live_sensors.nodes.map((node) => [node.id, node[key]])) }));

function Chart({ title, unit, dataKey, history }: { title: string; unit: string; dataKey: keyof Sensor; history: LivePayload[] }) {
  const data = metricData(dataKey, history);
  return <article className="sensor-chart"><header><span>{title} ({unit})</span><div><i className="legend-blue" />N-09 <i className="legend-green" />N-12 <i className="legend-red" />N-17 <i className="legend-yellow" />N-21</div></header><ResponsiveContainer width="100%" height={115}><LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="time" stroke="#475569" tick={{ fill: "#94a3b8", fontSize: 9 }} /><YAxis stroke="#475569" tick={{ fill: "#94a3b8", fontSize: 9 }} /><Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", color: "#f8fafc" }} /><Line dataKey="N-09" stroke="#38bdf8" dot={false} strokeWidth={2} /><Line dataKey="N-12" stroke="#10b981" dot={false} strokeWidth={2} /><Line dataKey="N-17" stroke="#ef4444" dot={false} strokeWidth={2} /><Line dataKey="N-21" stroke="#f59e0b" dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer></article>;
}

export default function Dashboard() {
  const [live, setLive] = useState(initial);
  const [history, setHistory] = useState<LivePayload[]>([initial]);
  const [buzzer, setBuzzer] = useState(true);
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [showLayers, setShowLayers] = useState(true);
  const [utc, setUtc] = useState("--:--:--");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [focusPoint, setFocusPoint] = useState<[number, number] | null>(null);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  useEffect(() => {
    const clock = window.setInterval(() => setUtc(new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date())), 1000);
    const ws = new WebSocket(`${API.replace("http", "ws")}/ws/live`);
    ws.onmessage = (event) => { const next = JSON.parse(event.data) as LivePayload; setLive(next); setHistory((old) => [...old.slice(-19), next]); };
    return () => { window.clearInterval(clock); ws.close(); };
  }, []);
  const bounds: Bounds = { west: 82.635, south: 22.312, east: 82.725, north: 22.378 };
  const nodes: MeshNode[] = live.live_sensors.nodes.map((node, index) => ({ id: node.id, lat: 22.322 + index * .015, lon: 82.645 + index * .022, tilt_deg: node.tilt, tension_mm: node.crack, vibration_hz: node.vib, battery_mv: 3800, rssi_dbm: -58, status: node.id === "N-17" ? "CRITICAL" : node.id === "N-21" ? "ADVISORY" : "NOMINAL", last_packet: live.system_status.timestamp }));
  const nav = [["Dashboard", LayoutDashboard], ["Nodes", Radio], ["USB Personnel Tracker", UserRound], ["Alerts & Incidents", Bell], ["Reports", HardHat], ["System", Settings]] as const;
  const alerts: DashboardAlert[] = live.alert.active && !acknowledged.includes("alert-n17") ? [{ id: "alert-n17", severity: "critical", node: live.alert.node, title: "Crack Propagation Detected", zone: live.alert.zone, timestamp: utc }] : [];
  const toggleBuzzer = () => {
    setBuzzer((current) => {
      const next = !current;
      if (next && typeof window !== "undefined") {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 720;
        gain.gain.setValueAtTime(.04, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .25);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + .25);
      }
      return next;
    });
  };
  const timestamp = utc === "--:--:--" ? "22 Sep 2026, --:--:--" : `22 Sep 2026, ${utc}`;
  const danger = [{ name: "risk", value: live.danger_meter.risk_pct, fill: "#10b981" }];
  return <main className="mine-console">
    <aside className="mine-sidebar"><div className="sidebar-title"><Menu size={22} /><Shield size={25} /><span>UNDERGROUND<br />COAL MINE</span></div><nav>{nav.map(([label, Icon]) => <button key={label} className={activeNav === label ? "active" : ""} onClick={() => setActiveNav(label)}><Icon size={16} /><span>{label}</span>{label === "Alerts & Incidents" && <b>2</b>}</button>)}</nav><footer><Wifi size={14} /> System Online</footer></aside>
    <section className="mine-main"><TopNavbar timestamp={timestamp} alerts={alerts} notificationsOpen={notificationsOpen} onToggleNotifications={() => setNotificationsOpen((open) => !open)} onAcknowledge={(id) => setAcknowledged((items) => [...items, id])} onClearAll={() => setAcknowledged(alerts.map((alert) => alert.id))} onMarkRead={() => setNotificationsOpen(false)} />
      <div className="dashboard-context"><span>LIVE OPERATIONS / {activeNav.toUpperCase()}</span><span><CheckCircle2 size={14} /> WebSocket stream active</span></div>
      <section className="mine-grid">
        <article className={`widget alert-active ${buzzer ? "" : "muted"}`}><header><Siren size={24} /><b>ALERT SYSTEM ACTIVE</b><span className="pulse" /><Volume2 size={17} /></header><p>{live.alert.description} at {live.alert.node}</p><button onClick={toggleBuzzer}>BUZZER {buzzer ? "ON" : "MUTED"}</button></article>
        <article className="widget mine-status"><label>MINE STATUS</label><div className="status-big"><CheckCircle2 size={27} /><strong>{live.mine_overview.status}</strong></div><div className="stat-row"><span>Active Alerts <b>{live.mine_overview.active_alerts}</b></span><span>Nodes Online <b>{live.mine_overview.nodes_online} / {live.mine_overview.total_nodes}</b></span><span>Personnel Underground <b>{live.mine_overview.personnel}</b></span></div></article>
        <article className="widget communication"><label><Wifi size={18} /> COMMUNICATION STATUS</label><div className="flow">{["Sensors", "LoRa", "Gateway", "Server", "Dashboard"].map((item, i) => <span key={item}><i />{item}{i < 4 && <em>→</em>}</span>)}</div><div className="stat-row"><span>Packets Received <b>{live.communications.received.toLocaleString()}</b></span><span>Packets Lost <b>{live.communications.lost_pct}%</b></span><span>Last Packet <b>{live.communications.last_packet_sec} sec ago</b></span></div></article>
        <article className="widget current-alert"><label>⚠ CURRENT ALERT</label><h3><AlertTriangle size={25} /> {live.alert.type}</h3><p>Node: <b>{live.alert.node}</b></p><p>{live.alert.description}</p><p>Location: {live.alert.zone}</p><button className="outline-button" onClick={() => setFocusPoint([18.4567, 73.8567])}><MapPin size={14} /> Track Location</button></article>
        <article className="widget danger-meter"><label>DANGER METER</label><div className="gauge"><ResponsiveContainer width="100%" height={145}><RadialBarChart cx="50%" cy="85%" innerRadius="65%" outerRadius="100%" startAngle={180} endAngle={0} barSize={18} data={danger}><RadialBar background={{ fill: "#26364a" }} dataKey="value" cornerRadius={8}><Cell fill="#10b981" /></RadialBar><PolarAngleAxis type="number" domain={[0, 100]} tick={false} /></RadialBarChart></ResponsiveContainer><strong>{live.danger_meter.risk_pct}%<small>RISK OF SUBSIDENCE</small></strong></div><span className="safe-pill">SAFE</span><p>Trend: <b className="warning-text">↑ {live.danger_meter.trend}</b></p></article>
        <article className="widget environment"><label>♨ ENVIRONMENTAL CONDITIONS</label>{[["Methane (CH₄)", `${live.environment.methane}%`, "green"], ["Temperature", `${live.environment.temperature}°C`, "green"], ["Humidity", `${live.environment.humidity}%`, "yellow"], ["CO", `${live.environment.co_ppm} ppm`, "green"], ["Air Quality", live.environment.air_quality, "green"]].map(([name, value, color]) => <div className="env-row" key={String(name)}><span>{String(name)}</span><b>{String(value)}</b><i className={String(color)} /></div>)}</article>
        <article className="widget gis-widget"><header><label><MapPin size={17} /> Mine GIS Map</label><span>🔴 Red Zone &nbsp; 🟡 Yellow Zone &nbsp; 🟢 Green Zone</span></header><div className="gis-map"><GeoMap bounds={bounds} nodes={nodes} focusPoint={focusPoint} /><button className="layers-toggle" onClick={() => setShowLayers(!showLayers)}>Map Layers {showLayers ? "×" : "+"}</button>{showLayers && <div className="layers-panel">{["Zones", "Sensor Nodes", "Workers", "Gateways", "Mine Tunnels", "Emergency Exits", "Evacuation Routes", "Recent Incidents"].map((layer) => <label key={layer}><input type="checkbox" defaultChecked /> {layer}</label>)}</div>}</div></article>
        <article className="widget personnel"><label><Users size={16} /> PERSONNEL STATUS</label><div className="personnel-total">{live.mine_overview.personnel}<small>Workers<br />Underground</small></div>{[["Normal", live.personnel.normal, "green"], ["In Caution Zone", live.personnel.caution, "yellow"], ["Unaccounted / Attention", live.personnel.unaccounted, "red"]].map(([name, value, color]) => <div className="person-row" key={String(name)}><i className={String(color)} /> <b>{String(value)}</b><span>{String(name)}</span></div>)}</article>
        <article className="widget sensor-network"><label><Radio size={16} /> SENSOR NETWORK</label><div className="network-count"><strong>{live.network.online + live.network.weak + live.network.offline}</strong><small>Nodes</small></div>{[["Online", live.network.online, "green"], ["Weak Connection", live.network.weak, "yellow"], ["Offline", live.network.offline, "red"]].map(([name, value, color]) => <div className="person-row" key={String(name)}><i className={String(color)} /><b>{String(value)}</b><span>{String(name)}</span></div>)}<div className="network-health">LoRa Network <b>{live.network.lora_health}%</b><br />Last Packet <b>2 sec ago</b></div></article>
        <article className="widget stability"><label>◒ GROUND STABILITY TREND</label><Chart title="Risk %" unit="" dataKey="crack" history={history} /><div className="trend-summary"><b>{live.danger_meter.risk_pct}%</b><span>Current Risk<br /><strong>↑ Increasing</strong></span></div><span className="safe-pill">SAFE</span></article>
        <article className="widget events"><label>◷ RECENT EVENTS</label>{[["22:41", "N-17 — Crack propagation detected", "red"], ["22:36", "N-09 — Abnormal tilt detected", "yellow"], ["22:29", "N-12 — Vibration returned to normal", "green"], ["22:15", "N-21 — Weak communication", "yellow"]].map(([time, text, color]) => <div className="event" key={time}><time>{time}</time><i className={color} /><span>{text}</span></div>)}</article>
        <article className="widget response"><label>♙ EMERGENCY RESPONSE</label><p>Nearest Emergency Exit <b className="green-text">E-03 (240 m)</b></p><p>Affected Zone <b>Zone B</b></p><p>Workers Affected <b>8</b></p><button className="primary-button" onClick={() => setRouteOpen(true)}>View Route <ChevronRight size={14} /></button></article>
        <article className="widget maintenance"><label><Wrench size={15} /> MAINTENANCE</label><p><i className="red" /> <b>2</b> Nodes require attention</p><p><i className="yellow" /> <b>4</b> Sensors due for maintenance</p><p><i className="green" /> <b>34</b> Nodes healthy</p><button className="outline-button" onClick={() => setMaintenanceOpen(true)}>View Details</button></article>
      </section>
      <section className="realtime widget"><label>REAL-TIME SENSOR DATA</label><div className="chart-grid"><Chart title="Tilt" unit="°" dataKey="tilt" history={history} /><Chart title="Vibration" unit="mm/s" dataKey="vib" history={history} /><Chart title="Displacement" unit="mm" dataKey="disp" history={history} /><Chart title="Crack" unit="mm" dataKey="crack" history={history} /></div></section>
      <section className="quick-actions widget"><label>QUICK ACTIONS</label><button onClick={() => setActiveNav("Nodes")}><Radio /> View Nodes</button><button onClick={() => setActiveNav("USB Personnel Tracker")}><UserRound /> USB Tracker</button><button onClick={() => setNotificationsOpen(true)}><Bell /> View Alerts</button></section>
    </section>{routeOpen && <EmergencyRouteModal onClose={() => setRouteOpen(false)} onDispatch={() => setRouteOpen(false)} />}{maintenanceOpen && <MaintenanceModal onClose={() => setMaintenanceOpen(false)} />}
  </main>;
}
