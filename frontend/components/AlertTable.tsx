"use client";

import { useState } from "react";
import { AlertTriangle, Check, ChevronRight, Siren } from "lucide-react";

export type AlertEvent = { id: string; node_id?: string; severity: "warning" | "critical"; message: string; csri: number; timestamp?: string };

export default function AlertTable({ alerts }: { alerts: AlertEvent[] }) {
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  return <section className="alert-console"><header><div><span className="panel-kicker"><Siren size={15} /> EMERGENCY & COMPLIANCE CONSOLE</span><h2>Dataset-derived early warning feed</h2></div><span className="alert-count">{alerts.filter((alert) => !acknowledged.includes(alert.id)).length} OPEN</span></header>{alerts.length ? alerts.map((alert) => <article className={`alert-row ${alert.severity}`} key={alert.id}><AlertTriangle size={17} /><div><b>{alert.severity === "critical" ? "STOP MINING / FIELD VERIFICATION" : "ADVISORY"} · AI DATASET</b><p>{alert.message}</p></div><span className="alert-csri">{(alert.csri * 100).toFixed(0)}%</span>{acknowledged.includes(alert.id) ? <Check size={17} /> : <button onClick={() => setAcknowledged((items) => [...items, alert.id])}>Acknowledge <ChevronRight size={14} /></button>}</article>) : <div className="no-alerts"><Check size={18} /> No active displacement threshold alerts.</div>}<footer><button className="secondary">Export DGMS Form-IV CSV</button><button className="secondary">Generate audit packet</button></footer></section>;
}
