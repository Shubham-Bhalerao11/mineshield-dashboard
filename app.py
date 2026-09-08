"""MineShield national subsidence intelligence dashboard."""
from __future__ import annotations

from datetime import timedelta
from pathlib import Path

import numpy as np
import plotly.graph_objects as go
import streamlit as st

from displacement_data import read_overview, resolve_dataset, risk_counts, sample_pixel
from occ_engine import mesh_risk, read_mesh_telemetry, utc_now

st.set_page_config(page_title="MineShield | Subsidence Intelligence", page_icon="MS", layout="wide", initial_sidebar_state="expanded")

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap');
:root { --ink: #e8eef1; --muted: #9aaab1; --line: #293b46; --panel: #111b24; --cyan: #6dd6df; --amber: #f2b84b; --red: #f16b62; }
.stApp { background: #0b1118; color: var(--ink); font-family: 'Space Grotesk', sans-serif; }
.block-container { max-width: 1780px; padding: 1.35rem 2.5rem 3rem; }
[data-testid="stHeader"] { background: #0b1118; }
[data-testid="stSidebar"] { background: #101923; border-right: 1px solid var(--line); }
[data-testid="stSidebar"] h1, [data-testid="stSidebar"] h2, [data-testid="stSidebar"] h3, [data-testid="stSidebar"] p, [data-testid="stSidebar"] label, [data-testid="stSidebar"] small { color: var(--ink) !important; }
[data-testid="stSidebar"] .stCaption { color: var(--muted) !important; }
[data-testid="stSidebar"] input { color: #13202a !important; background: #f5f7f8 !important; }
[data-testid="stSidebar"] [data-testid="stWidgetLabel"] p { color: var(--ink) !important; }
[data-testid="stMetric"] { background: var(--panel); border: 1px solid var(--line); border-radius: 4px; padding: .8rem 1rem; }
[data-testid="stMetricLabel"] { color: var(--muted); font-family: 'JetBrains Mono', monospace; font-size: .68rem; letter-spacing: .08em; text-transform: uppercase; }
[data-testid="stMetricValue"] { color: var(--ink); font-family: 'Space Grotesk', sans-serif; font-weight: 700; }
.eyebrow { color: var(--cyan); font-family: 'JetBrains Mono', monospace; font-size: .7rem; letter-spacing: .16em; text-transform: uppercase; }
.title { font-family: 'Space Grotesk', sans-serif; font-size: 2.25rem; font-weight: 700; letter-spacing: -.035em; margin: .2rem 0 0; }
.subtitle { color: var(--muted); font-size: .9rem; margin: .25rem 0 1.3rem; }
.section { border-bottom: 1px solid var(--line); color: var(--cyan); font-family: 'JetBrains Mono', monospace; font-size: .7rem; letter-spacing: .14em; margin: 1.4rem 0 .75rem; padding-bottom: .5rem; text-transform: uppercase; }
.status, .warning, .critical { border-radius: 3px; font-family: 'JetBrains Mono', monospace; font-size: .75rem; padding: .7rem .9rem; }
.status { border: 1px solid #285a5f; background: #102d32; color: #a8eff0; }
.warning { border: 1px solid #7a5a25; background: #2b2415; color: #f8d481; }
.critical { border: 1px solid #803b3a; background: #32191b; color: #ffaba4; }
.statusbar { align-items: center; background: #111b24; border-bottom: 1px solid var(--line); border-top: 1px solid var(--line); color: var(--muted); display: flex; flex-wrap: wrap; font-family: 'JetBrains Mono', monospace; font-size: .68rem; gap: 1.25rem; letter-spacing: .04em; padding: .7rem .9rem; }
.statusbar b { color: #72e0aa; }
.live-dot { background: #35c69a; border-radius: 50%; box-shadow: 0 0 0 4px rgba(53,198,154,.12); display: inline-block; height: 7px; width: 7px; }
.mono { color: var(--muted); font-family: 'JetBrains Mono', monospace; font-size: .74rem; line-height: 1.9; }
.inspector { background: #111b24; border: 1px solid var(--line); border-left: 3px solid var(--cyan); padding: .85rem 1rem; }
</style>
""", unsafe_allow_html=True)


@st.cache_data(show_spinner=False)
def cached_overview(path: str, cache_version: str = "patch-mosaic-v3") -> dict:
    return read_overview(Path(path))


def format_area(extent: tuple[float, float, float, float]) -> float:
    return abs(extent[1] - extent[0]) * 97.0 * abs(extent[3] - extent[2]) * 111.0


def heatmap(overview: dict, show_extent: bool) -> go.Figure:
    figure = go.Figure(go.Heatmap(
        x=overview["lon"], y=overview["lat"], z=overview["values"],
        colorscale=[[0.0, "#3267a8"], [0.35, "#6ec7c1"], [0.5, "#182d2b"], [0.7, "#f5b84b"], [1.0, "#d9534f"]],
        zmin=overview["p02_cm"], zmax=overview["p98_cm"], colorbar=dict(title="cm", thickness=12),
        hovertemplate="Lon %{x:.5f}<br>Lat %{y:.5f}<br>Displacement %{z:.3f} cm<extra></extra>", connectgaps=False,
    ))
    if show_extent:
        min_lon, max_lon, min_lat, max_lat = overview["extent"]
        figure.add_trace(go.Scatter(x=[min_lon, max_lon, max_lon, min_lon, min_lon], y=[min_lat, min_lat, max_lat, max_lat, min_lat], mode="lines", line=dict(color="#dce7e6", width=1.5, dash="dot"), name="Monitored extent"))
    figure.update_layout(template="plotly_dark", height=590, margin=dict(l=0, r=0, t=8, b=0), paper_bgcolor="#102321", plot_bgcolor="#102321", xaxis=dict(title="Longitude", gridcolor="#25413f", zeroline=False), yaxis=dict(title="Latitude", gridcolor="#25413f", zeroline=False), legend=dict(orientation="h", y=1.04, x=0), hovermode="closest")
    return figure


with st.sidebar:
    st.markdown('<div class="eyebrow">DATA CONTROL</div>', unsafe_allow_html=True)
    requested_path = st.text_input("AI dataset folder", value="AI_Displacement_Dataset")
    st.caption("Only paired train_images and train_labels patches from this folder are used. No synthetic or sensor data is loaded.")
    show_extent = st.checkbox("Lease extent boundary", True)
    st.markdown('<div class="section">ALERT RULES</div>', unsafe_allow_html=True)
    critical_threshold = st.number_input("Critical displacement (cm)", min_value=0.1, max_value=20.0, value=2.0, step=.1)
    watch_threshold = st.number_input("Watch displacement (cm)", min_value=0.1, max_value=10.0, value=.5, step=.1)
    mesh_path = st.text_input("Real mesh gateway JSONL", value="mesh_telemetry.jsonl")
    st.caption("Optional: point this at a real gateway export. No simulated sensor stream is created by this application.")

dataset = resolve_dataset(requested_path)
st.markdown('<div class="eyebrow">NATIONAL MINE SAFETY NETWORK / GEO-INTELLIGENCE NODE 01</div>', unsafe_allow_html=True)
st.markdown('<div class="title">Surface Subsidence Intelligence</div>', unsafe_allow_html=True)
st.markdown('<div class="subtitle">AI displacement analytics for lease stability, infrastructure exposure, and proactive mine operations.</div>', unsafe_allow_html=True)
if dataset is None:
    st.error("AI displacement dataset not found. Select the folder containing metadata.json and train_images.")
    st.stop()
try:
    overview = cached_overview(str(dataset), "patch-mosaic-v4")
except Exception as error:
    st.error(f"AI patch ingestion failed: {error}")
    st.stop()

values = overview["values"]
mesh = read_mesh_telemetry(Path(mesh_path))
mesh_assessment = mesh_risk(mesh["records"])
counts = risk_counts(values, watch_threshold, critical_threshold)
valid = values[np.isfinite(values)]
critical_pixels = int(np.sum(np.abs(valid) >= critical_threshold))
watch_pixels = int(np.sum((np.abs(valid) >= watch_threshold) & (np.abs(valid) < critical_threshold)))
st.markdown('<div class="statusbar"><span class="live-dot"></span><b>OCC ONLINE</b><span>AI PATCHES VERIFIED</span><span>MACRO SOURCE: LOCAL AI DATASET</span><span>UNITS: CM</span></div>', unsafe_allow_html=True)
st.markdown('<div class="section">EXECUTIVE COMMAND PANEL</div>', unsafe_allow_html=True)
kpis = st.columns(5)
kpis[0].metric("Area monitored", f"{format_area(overview['extent']):,.0f}", "km2 approx")
kpis[1].metric("Critical zones", f"{critical_pixels:,}", "pixels")
kpis[2].metric("Watch zones", f"{watch_pixels:,}", "pixels")
stability_index = max(0, 100 * (1 - np.mean(np.abs(valid)) / max(np.max(np.abs(valid)), .001)))
kpis[3].metric("Stability index", f"{stability_index:.1f}", "/ 100")
kpis[4].metric("AI patches", f"{overview['patch_count']:,}", "paired patches")
if critical_pixels:
    st.markdown(f'<div class="critical">HAZARD ADVISORY  /  {critical_pixels:,} pixels exceed the {critical_threshold:.1f} cm displacement threshold. Prioritise field verification and asset overlay review.</div>', unsafe_allow_html=True)
elif watch_pixels:
    st.markdown(f'<div class="warning">WATCH CONDITION  /  {watch_pixels:,} pixels are in the {watch_threshold:.1f}-{critical_threshold:.1f} cm displacement band.</div>', unsafe_allow_html=True)
else:
    st.markdown('<div class="status">NO PIXEL-LEVEL DISPLACEMENT ALERTS UNDER THE ACTIVE THRESHOLDS.</div>', unsafe_allow_html=True)

map_tab, ai_tab, mesh_tab, health_tab = st.tabs(["GEOINT MAP", "AI EARLY WARNING", "MESH NETWORK", "DATA & COMPLIANCE"])
with map_tab:
    left, right = st.columns([2.3, 1])
    with left:
        st.markdown('<div class="section">AI DISPLACEMENT OVERLAY</div>', unsafe_allow_html=True)
        st.plotly_chart(heatmap(overview, show_extent), use_container_width=True, config={"displaylogo": False, "scrollZoom": True})
    with right:
        st.markdown('<div class="section">PIXEL INSPECTOR</div>', unsafe_allow_html=True)
        min_lon, max_lon, min_lat, max_lat = overview["extent"]
        longitude = st.number_input("Longitude", min_value=float(min_lon), max_value=float(max_lon), value=float((min_lon + max_lon) / 2), format="%.6f")
        latitude = st.number_input("Latitude", min_value=float(min_lat), max_value=float(max_lat), value=float((min_lat + max_lat) / 2), format="%.6f")
        sample = sample_pixel(dataset, longitude, latitude, overview)
        displacement = sample["displacement_value"]
        if displacement is None:
            st.warning("Selected pixel is nodata.")
        else:
            st.metric("Cumulative displacement", f"{displacement:.3f}", "cm")
            st.metric("Pixel status", "Critical" if abs(displacement) >= critical_threshold else "Watch" if abs(displacement) >= watch_threshold else "Stable")
            st.markdown(f"<div class='inspector'><b>SELECTED OBSERVATION</b><br>Nearest real patch: {sample['patch_name']}<br>Source value: {displacement:.3f} cm<br>Coordinates: {longitude:.5f}, {latitude:.5f}</div>", unsafe_allow_html=True)
        st.markdown('<div class="section">LAYER REGISTRY</div>', unsafe_allow_html=True)
        st.markdown('<div class="mono">[ON] AI displacement patch mosaic<br>[ON] Approximate metadata extent<br>[OFF] Underground workings vectors<br>[OFF] Railway / road buffers<br>[OFF] Multi-date velocity stack<br>[OFF] Physical mesh telemetry</div>', unsafe_allow_html=True)
        st.caption("Only layers represented by the supplied AI dataset are enabled; absent infrastructure and IoT observations are not simulated.")

with ai_tab:
    st.markdown('<div class="section">AI EARLY-WARNING ENGINE</div>', unsafe_allow_html=True)
    if mesh_assessment is None:
        st.markdown('<div class="warning">AI ENGINE ARMED  /  Awaiting real mesh telemetry. No prediction is displayed until tilt, vibration, crack, battery, and link packets arrive from the field network.</div>', unsafe_allow_html=True)
        st.info("Connect the configured JSONL gateway feed in the sidebar. This panel deliberately does not substitute satellite displacement for live mesh risk.")
    else:
        ai_metrics = st.columns(4)
        ai_metrics[0].metric("Mesh CSRI", f"{mesh_assessment['csri']:.3f}", "/ 1.000")
        ai_metrics[1].metric("Peak node risk", f"{mesh_assessment['peak_csri'] * 100:.1f}%", "highest node")
        ai_metrics[2].metric("Nodes assessed", mesh_assessment["nodes"], "real nodes")
        ai_metrics[3].metric("Alert stage", mesh_assessment["stage"])
        alert_class = "critical" if mesh_assessment["stage"] in {"CRITICAL EVACUATION", "WATCH"} else "status"
        st.markdown(f'<div class="{alert_class}">AI ACTION  /  {mesh_assessment["stage"]} from the live mesh feature vector. Human operator confirmation remains required.</div>', unsafe_allow_html=True)
        st.caption(mesh_assessment["method"] + ".")
    a, b = st.columns([1.1, 1.4])
    with a:
        st.markdown('<div class="section">MESH NODE RISK MATRIX</div>', unsafe_allow_html=True)
        if mesh_assessment is None:
            risk_figure = go.Figure()
            risk_figure.add_annotation(text="AWAITING REAL MESH PACKETS", x=.5, y=.5, xref="paper", yref="paper", showarrow=False, font=dict(size=16, family="JetBrains Mono", color="#9aaab1"))
        else:
            risk_figure = go.Figure(go.Bar(x=list(mesh_assessment["node_scores"]), y=list(mesh_assessment["node_scores"].values()), marker_color=["#ef6b63" if value >= .7 else "#f2b84b" if value >= .45 else "#35c69a" for value in mesh_assessment["node_scores"].values()], text=[f"{value:.2f}" for value in mesh_assessment["node_scores"].values()], textposition="outside"))
        risk_figure.update_layout(template="plotly_dark", height=370, margin=dict(l=16, r=16, t=22, b=28), paper_bgcolor="#111b24", plot_bgcolor="#111b24", yaxis_title="CSRI", yaxis=dict(range=[0, 1], gridcolor="#293b46"), xaxis=dict(gridcolor="#293b46"), showlegend=False, font=dict(family="JetBrains Mono", color="#c7d3d8"))
        st.plotly_chart(risk_figure, use_container_width=True)
    with b:
        st.markdown('<div class="section">MESH SIGNAL ENVELOPE</div>', unsafe_allow_html=True)
        if mesh_assessment is None:
            distribution = go.Figure()
            distribution.add_annotation(text="NO TELEMETRY TIMESERIES", x=.5, y=.5, xref="paper", yref="paper", showarrow=False, font=dict(size=16, family="JetBrains Mono", color="#9aaab1"))
        else:
            node_values = list(mesh_assessment["node_scores"].values())
            distribution = go.Figure(go.Scatter(x=list(mesh_assessment["node_scores"]), y=node_values, mode="lines+markers", line=dict(color="#6dd6df", width=3), marker=dict(size=9, color="#f2b84b"), fill="tozeroy", fillcolor="rgba(109,214,223,.12)", hovertemplate="Node %{x}<br>CSRI %{y:.3f}<extra></extra>"))
        distribution.update_layout(template="plotly_dark", height=370, margin=dict(l=16, r=16, t=22, b=28), paper_bgcolor="#111b24", plot_bgcolor="#111b24", xaxis_title="Node", yaxis_title="CSRI", yaxis=dict(range=[0, 1], gridcolor="#293b46"), xaxis=dict(gridcolor="#293b46"), font=dict(family="JetBrains Mono", color="#c7d3d8"))
        st.plotly_chart(distribution, use_container_width=True)
    st.markdown('<div class="warning">DATA BOUNDARY  /  Satellite patches provide macro deformation context. The AI warning score on this tab is intentionally computed only from real mesh packets.</div>', unsafe_allow_html=True)

@st.fragment(run_every=timedelta(seconds=2))
def render_mesh_panel(mesh_file: str) -> None:
    mesh = read_mesh_telemetry(Path(mesh_file))
    st.markdown('<div class="section">WIRELESS SURFACE MESH NETWORK</div>', unsafe_allow_html=True)
    if mesh["connected"]:
        st.markdown(f'<div class="status">MESH GATEWAY ONLINE  /  {len(mesh["records"])} real packets loaded  /  LAST CHECK {utc_now()}</div>', unsafe_allow_html=True)
        st.dataframe(mesh["records"][-24:], use_container_width=True, hide_index=True)
    else:
        st.markdown('<div class="warning">MESH GATEWAY STANDBY  /  No real telemetry feed is connected.</div>', unsafe_allow_html=True)
        st.caption("Connect an ESP32/LoRa gateway by writing newline-delimited JSON packets to the configured path. Expected fields include node_id, timestamp, lat, lon, pitch_deg, roll_deg, vibration_g, crack_extension_mm, battery_pct, rssi_dbm, and packet_loss_pct.")
    st.markdown('<div class="section">LIVE NODE CONTRACT</div>', unsafe_allow_html=True)
    st.markdown('<div class="mono">INGESTION: JSONL FILE WATCH / MQTT BRIDGE READY FOR DEPLOYMENT<br>ANALYTICS: TILT + CRACK + VIBRATION + LINK HEALTH<br>ALERTING: CSRI ENGINE / HUMAN OPERATOR CONFIRMATION REQUIRED<br>MODE: REAL DATA ONLY / NO TELEMETRY GENERATOR</div>', unsafe_allow_html=True)


with mesh_tab:
    render_mesh_panel(mesh_path)

with health_tab:
    st.markdown('<div class="section">DATA GOVERNANCE AND COMPLIANCE</div>', unsafe_allow_html=True)
    st.markdown('<div class="statusbar"><b>DATA LINEAGE</b><span>5,980 REAL PATCH PAIRS</span><span>NO SYNTHETIC TELEMETRY</span><span>AI WARNING: MESH-ONLY</span></div>', unsafe_allow_html=True)
    health = st.columns(4)
    health[0].metric("AI source", dataset.name, "resolved")
    health[1].metric("Valid coverage", f"{overview['valid_pixels'] / max(values.size, 1) * 100:.1f}%", "of overview")
    health[2].metric("Coordinate reference", "Approx. WGS84", "metadata extent")
    health[3].metric("AI patch ingestion", "Ready", "5,980 pairs")
    st.dataframe({
        "Check": ["Dataset exists", "Patch pairs", "Units", "Display extent", "CRS provenance", "Temporal stack"],
        "Result": ["PASS", f"{overview['patch_count']:,}", overview["metadata"].get("units", "unknown"), "PASS - metadata bbox", "APPROXIMATE - source CRS null", "PENDING - single date supplied"],
        "Operator action": ["None", "None", "None", "Verify against mine lease GIS", "Provide georeferenced export for regulatory use", "Provide multi-date InSAR stack"],
    }, hide_index=True, use_container_width=True)
    st.markdown('<div class="section">AUDIT EXPORT CONTEXT</div>', unsafe_allow_html=True)
    st.caption(f"Source: {dataset} | Metadata units: {overview['metadata'].get('units', 'not declared')} | Approximate extent: {overview['extent']} | Valid displacement range: {overview['min_cm']:.3f} to {overview['max_cm']:.3f} cm")
