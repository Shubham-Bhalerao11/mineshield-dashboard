"use client";

import { Bell, CheckCircle2, X } from "lucide-react";

export type DashboardAlert = { id: string; severity: "critical" | "warning"; node: string; title: string; zone: string; timestamp: string };

export default function TopNavbar({ timestamp, alerts, notificationsOpen, onToggleNotifications, onAcknowledge, onClearAll, onMarkRead }: { timestamp: string; alerts: DashboardAlert[]; notificationsOpen: boolean; onToggleNotifications: () => void; onAcknowledge: (id: string) => void; onClearAll: () => void; onMarkRead: () => void }) {
  return <header className="mine-topbar"><div><span className="top-kicker">MINE SAFETY OPERATIONS CENTER</span><h1>Underground Coal Mine Safety Monitoring System</h1></div><div className="top-status"><div className="notification-anchor"><button className="notification-button" onClick={onToggleNotifications} aria-label="Notifications"><Bell size={17} />{alerts.length > 0 && <b>{alerts.length}</b>}</button>{notificationsOpen && <div className="notification-card"><header><strong>Active notifications</strong><button onClick={onToggleNotifications}><X size={14} /></button></header>{alerts.length ? alerts.map((alert) => <article key={alert.id}><span className={`notification-severity ${alert.severity}`}>{alert.severity}</span><b>{alert.node}: {alert.title}</b><small>{alert.zone} · {alert.timestamp}</small><button onClick={() => onAcknowledge(alert.id)}>Acknowledge</button></article>) : <div className="notification-empty"><CheckCircle2 size={18} />All Systems Normal — No Active Incidents</div>}<footer><button onClick={onClearAll}>Clear All</button><button onClick={onMarkRead}>Mark as Read</button></footer></div>}</div><span>{timestamp}</span><strong><i /> System Online</strong><em>#WEBSOCKET STREAM ACTIVE</em></div></header>;
}
