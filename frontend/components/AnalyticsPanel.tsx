"use client";

import { Activity, BrainCircuit, Gauge, Waves } from "lucide-react";

export type ProfilePoint = { distance_index: number; displacement_cm: number | null };
export type AnalyticsPanelProps = { csri?: number; profile?: ProfilePoint[]; selectedNode?: { node_id: string; csri: number } | null; meshConnected?: boolean };

export default function AnalyticsPanel({ csri = 0, profile = [], selectedNode, meshConnected }: AnalyticsPanelProps) {
  const max = Math.max(...profile.map((point) => Math.abs(point.displacement_cm ?? 0)), 1);
  return <aside className="analytics-panel">
    <div className="panel-kicker"><BrainCircuit size={16} /> PREDICTIVE RISK ASSESSMENT</div>
    <div className="csri-gauge"><div className="gauge-ring" style={{ "--progress": `${csri * 100}%` } as React.CSSProperties}><strong>{(csri * 100).toFixed(0)}</strong><span>DATA RISK / 100</span></div><div><b>AI DATASET ACTIVE</b><small>Risk context derived from the local displacement COG and metadata</small></div></div>
    <div className="signal-grid"><div><Activity size={15} /><span>Threat stage</span><b>{csri >= .88 ? "CRITICAL" : csri >= .45 ? "ADVISORY" : "NOMINAL"}</b></div><div><Gauge size={15} /><span>Selected source</span><b>{selectedNode?.node_id ?? "AI COG"}</b></div><div><Waves size={15} /><span>Data stream</span><b>LOCAL / ONLINE</b></div></div>
    <div className="chart-heading">CROSS-SECTION / AI DISPLACEMENT PROFILE <span>cm</span></div>
    <div className="profile-chart" role="img" aria-label="Displacement cross section chart">{profile.length ? profile.map((point) => <div key={point.distance_index} className="profile-bar" style={{ height: `${Math.max(4, Math.abs(point.displacement_cm ?? 0) / max * 100)}%` }} title={`${point.displacement_cm?.toFixed(3) ?? "nodata"} cm`} />) : <div className="empty-chart">DRAW A PROFILE ON THE MAP</div>}</div>
    <div className="chart-axis"><span>START</span><span>PROFILE DISTANCE</span><span>END</span></div>
    <div className="analytics-note">Macro displacement is sourced from the supplied AI COG. Physical mesh telemetry is an optional future layer and does not block this dataset-backed command view.</div>
  </aside>;
}
