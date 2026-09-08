"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, ImageOverlay, MapContainer, TileLayer, useMap, useMapEvents, Tooltip } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import { Crosshair, Layers, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";

export type Bounds = { west: number; south: number; east: number; north: number };
export type MeshNode = { id: string; lat: number; lon: number; tilt_deg: number; tension_mm: number; vibration_hz: number; battery_mv: number; rssi_dbm: number; status: "NOMINAL" | "ADVISORY" | "CRITICAL"; last_packet: string };
export type GeoMapProps = { bounds: Bounds; nodes?: MeshNode[]; onSelect?: (node: MeshNode | null) => void; onInspect?: (point: [number, number]) => void };

function ClickCapture({ onMapClick }: { onMapClick: (point: [number, number]) => void }) {
  useMapEvents({ click: (event) => onMapClick([event.latlng.lat, event.latlng.lng]) });
  return null;
}

function FitMetadataBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  const initializedRef = useRef(false);
  useEffect(() => { if (!initializedRef.current) { map.fitBounds(bounds, { padding: [30, 30] }); initializedRef.current = true; } }, [bounds, map]);
  return null;
}

function threat(csri: number) {
  return csri >= .88 ? "critical" : csri >= .45 ? "warning" : "safe";
}

export default function GeoMap({ bounds, nodes = [], onSelect, onInspect }: GeoMapProps) {
  const [opacity, setOpacity] = useState(.75);
  const [showMesh, setShowMesh] = useState(false);
  const [mode, setMode] = useState<"scientific" | "satellite">("satellite");
  const [profileMode, setProfileMode] = useState(false);
  const [clicked, setClicked] = useState<[number, number] | null>(null);

  const leafletBounds: LatLngBoundsExpression = [[bounds.south, bounds.west], [bounds.north, bounds.east]];
  const center: [number, number] = [(bounds.south + bounds.north) / 2, (bounds.west + bounds.east) / 2];
  const nodePositions = useMemo(() => nodes.filter((node) => Number.isFinite(node.lat) && Number.isFinite(node.lon)), [nodes]);

  return <section className="geo-map" aria-label="GIS displacement map">
    <div className="map-toolbar"><span className="map-label"><Layers size={15} /> AI DISPLACEMENT COMMAND MAP</span><div className="map-segmented"><button className={mode === "scientific" ? "tool active" : "tool"} onClick={() => setMode("scientific")}>Scientific AI Raster</button><button className={mode === "satellite" ? "tool active" : "tool"} onClick={() => setMode("satellite")}>Satellite Terrain GIS</button></div><button onClick={() => setShowMesh(!showMesh)} className={showMesh ? "tool active" : "tool"}><MapPin size={14} /> Mesh</button><button onClick={() => setProfileMode(!profileMode)} className={profileMode ? "tool active" : "tool"}><Crosshair size={14} /> {profileMode ? "Profile armed" : "Inspect"}</button>{mode === "satellite" && <label className="opacity-control">Overlay <input aria-label="AI overlay opacity" type="range" min="30" max="100" value={opacity * 100} onChange={(event) => setOpacity(Number(event.target.value) / 100)} /> {Math.round(opacity * 100)}%</label>}</div>
    <div className="map-canvas">
      <MapContainer center={center} bounds={leafletBounds} scrollWheelZoom zoomControl={false} className="leaflet-map">
        <FitMetadataBounds bounds={leafletBounds} />
        {mode === "satellite" && <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />}
        <ImageOverlay className="displacement-overlay" url="/data/displacement_overlay.png" bounds={leafletBounds} opacity={mode === "scientific" ? 1 : opacity} interactive />
        <ClickCapture onMapClick={(point) => { setClicked(point); onInspect?.(point); }} />
        {clicked && <CircleMarker center={clicked} radius={10} pathOptions={{ color: "#00e5ff", weight: 3, fillOpacity: 0 }}><Tooltip permanent direction="top">PIXEL INSPECT</Tooltip></CircleMarker>}
        {showMesh && nodePositions.map((node) => <CircleMarker key={node.id} center={[node.lat!, node.lon!]} radius={8} pathOptions={{ color: node.status === "CRITICAL" ? "#ff3d71" : node.status === "ADVISORY" ? "#ffb300" : "#10b981", fillOpacity: .85 }} eventHandlers={{ click: () => onSelect?.(node) }}><Tooltip direction="top" offset={[0, -8]}>{node.id} · {node.status}<br />Tilt {node.tilt_deg}° · Tension {node.tension_mm} mm</Tooltip></CircleMarker>)}
      </MapContainer>
      <div className="map-scale"><span>-7 cm</span><i /><span>0</span><i /><span>+1 cm</span></div>
      {mode === "scientific" && <div className="scientific-axes"><span>22.378°N</span><span>22.345°N</span><span>22.312°N</span><b>82.635°E — 82.725°E</b></div>}
      <div className="map-coordinates">SOURCE: AI_DISPLACEMENT_DATASET / {bounds.west.toFixed(3)}–{bounds.east.toFixed(3)} E / {bounds.south.toFixed(3)}–{bounds.north.toFixed(3)} N{clicked ? ` / PICK ${clicked[1].toFixed(5)}, ${clicked[0].toFixed(5)}` : ""}</div>
    </div>
  </section>;
}
