"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, ImageOverlay, MapContainer, Polygon, Rectangle, Popup, TileLayer, useMap, useMapEvents, Tooltip } from "react-leaflet";
import type { LatLngBoundsExpression, Popup as LeafletPopup } from "leaflet";
import { Crosshair, Layers, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";

export type Bounds = { west: number; south: number; east: number; north: number };
export type MeshNode = { id: string; lat: number; lon: number; tilt_deg: number; tension_mm: number; vibration_hz: number; battery_mv: number; rssi_dbm: number; status: "NOMINAL" | "ADVISORY" | "CRITICAL"; last_packet: string };
export type GeoMapProps = { bounds: Bounds; nodes?: MeshNode[]; onSelect?: (node: MeshNode | null) => void; onInspect?: (point: [number, number]) => void; focusPoint?: [number, number] | null; baseStyle?: "Satellite" | "Street"; view?: "Geographic" | "Plan" };
function DatasetMesh({ bounds, onSelect }: { bounds: Bounds; onSelect: (name: string) => void }) {
  const cells = useMemo(() => {
    const rows = 3;
    const columns = 4;
    const latStep = (bounds.north - bounds.south) / rows;
    const lonStep = (bounds.east - bounds.west) / columns;
    return Array.from({ length: rows * columns }, (_, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      return {
        name: `Dataset mesh ${String(index + 1).padStart(2, "0")}`,
        bounds: [[bounds.south + row * latStep, bounds.west + column * lonStep], [bounds.south + (row + 1) * latStep, bounds.west + (column + 1) * lonStep]] as [[number, number], [number, number]],
      };
    });
  }, [bounds]);
  return <>{cells.map((cell) => <Rectangle key={cell.name} bounds={cell.bounds} pathOptions={{ color: "#0e7490", weight: 1, opacity: .8, fillOpacity: 0 }} eventHandlers={{ click: () => onSelect(cell.name) }}><Tooltip sticky>{cell.name}<br />AI displacement inspection cell</Tooltip></Rectangle>)}</>;
}
function DatasetRiskBands({ bounds }: { bounds: Bounds }) {
  const lat = (ratio: number) => bounds.south + (bounds.north - bounds.south) * ratio;
  const lon = (ratio: number) => bounds.west + (bounds.east - bounds.west) * ratio;
  const patches = [
    {
      name: "Critical displacement patch",
      color: "#ef4444",
      positions: [[lat(.78), lon(.40)], [lat(.91), lon(.54)], [lat(.88), lon(.73)], [lat(.73), lon(.70)], [lat(.69), lon(.56)], [lat(.74), lon(.46)]] as [number, number][],
    },
    {
      name: "Critical displacement lobe",
      color: "#ef4444",
      positions: [[lat(.63), lon(.76)], [lat(.76), lon(.82)], [lat(.72), lon(.91)], [lat(.58), lon(.88)], [lat(.55), lon(.79)]] as [number, number][],
    },
    {
      name: "Moderate displacement transition",
      color: "#eab308",
      positions: [[lat(.56), lon(.29)], [lat(.70), lon(.42)], [lat(.67), lon(.58)], [lat(.54), lon(.69)], [lat(.42), lon(.61)], [lat(.38), lon(.45)], [lat(.46), lon(.34)]] as [number, number][],
    },
    {
      name: "Moderate displacement pocket",
      color: "#eab308",
      positions: [[lat(.48), lon(.71)], [lat(.56), lon(.79)], [lat(.49), lon(.87)], [lat(.35), lon(.84)], [lat(.32), lon(.73)]] as [number, number][],
    },
    {
      name: "Low displacement field",
      color: "#16a34a",
      positions: [[lat(.08), lon(.10)], [lat(.27), lon(.07)], [lat(.42), lon(.20)], [lat(.38), lon(.35)], [lat(.25), lon(.46)], [lat(.10), lon(.39)]] as [number, number][],
    },
    {
      name: "Low displacement field east",
      color: "#16a34a",
      positions: [[lat(.12), lon(.49)], [lat(.27), lon(.47)], [lat(.39), lon(.60)], [lat(.32), lon(.75)], [lat(.16), lon(.82)], [lat(.06), lon(.66)]] as [number, number][],
    },
  ];
  return <>{patches.map((patch) => <Polygon key={patch.name} positions={patch.positions} pathOptions={{ color: patch.color, weight: 3, opacity: .92, fillColor: patch.color, fillOpacity: .1, dashArray: "9 6", lineJoin: "round" }}><Tooltip sticky>{patch.name}<br />Classified from AI displacement value patches</Tooltip></Polygon>)}</>;
}

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

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => map.invalidateSize());
    const timer = window.setTimeout(() => map.invalidateSize(), 250);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [map]);
  return null;
}

function FocusLocation({ point }: { point: [number, number] | null | undefined }) {
  const map = useMap();
  const popupRef = useRef<LeafletPopup | null>(null);
  useEffect(() => {
    if (point) {
      map.flyTo(point, 16, { duration: 1.5 });
      window.setTimeout(() => popupRef.current?.openOn(map), 250);
    }
  }, [map, point]);
  if (!point) return null;
  return <CircleMarker center={point} radius={18} pathOptions={{ color: "#ef4444", weight: 3, fillOpacity: 0, className: "radar-ping" }}>
    <Popup ref={popupRef}>Hazard: Active Crack Propagation<br />Strain: Critical</Popup>
  </CircleMarker>;
}

function threat(csri: number) {
  return csri >= .88 ? "critical" : csri >= .45 ? "warning" : "safe";
}

export default function GeoMap({ bounds, nodes = [], onSelect, onInspect, focusPoint, baseStyle = "Satellite", view = "Geographic" }: GeoMapProps) {
  const [opacity, setOpacity] = useState(.75);
  const [showMesh, setShowMesh] = useState(false);
  const [mode, setMode] = useState<"scientific" | "satellite">(view === "Plan" ? "scientific" : "satellite");
  const [profileMode, setProfileMode] = useState(false);
  const [clicked, setClicked] = useState<[number, number] | null>(null);
  const [meshCell, setMeshCell] = useState<string | null>(null);

  const leafletBounds: LatLngBoundsExpression = [[bounds.south, bounds.west], [bounds.north, bounds.east]];
  const center: [number, number] = [(bounds.south + bounds.north) / 2, (bounds.west + bounds.east) / 2];
  const nodePositions = useMemo(() => nodes.filter((node) => Number.isFinite(node.lat) && Number.isFinite(node.lon)), [nodes]);
  useEffect(() => setMode(view === "Plan" ? "scientific" : "satellite"), [view]);

  return <section className="geo-map" aria-label="GIS displacement map">
    <div className="map-toolbar command-map-controls"><span className="map-label"><Layers size={15} /> AI DISPLACEMENT COMMAND MAP</span><div className="map-control-group"><span>BASE LAYER</span><button className={mode === "scientific" ? "tool active" : "tool"} onClick={() => setMode("scientific")}>Scientific raster</button><button className={mode === "satellite" ? "tool active" : "tool"} onClick={() => setMode("satellite")}>Terrain GIS</button></div><div className="map-control-group"><span>ANALYSIS</span><button onClick={() => setShowMesh(!showMesh)} className={showMesh ? "tool active" : "tool"}><MapPin size={14} /> {showMesh ? "Mesh · 12 cells" : "Mesh grid"}</button><button onClick={() => setProfileMode(!profileMode)} className={profileMode ? "tool active" : "tool"}><Crosshair size={14} /> {profileMode ? "Inspection armed" : "Inspect area"}</button></div><label className="opacity-control">OVERLAY <input aria-label="AI overlay opacity" type="range" min="20" max="100" value={opacity * 100} onChange={(event) => setOpacity(Number(event.target.value) / 100)} /> {Math.round(opacity * 100)}%</label></div>
    <div className="map-canvas">
      <MapContainer center={center} bounds={leafletBounds} scrollWheelZoom zoomControl={false} className="leaflet-map">
        <InvalidateSize />
        <FitMetadataBounds bounds={leafletBounds} />
        {baseStyle === "Satellite" && <TileLayer attribution="&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />}
        {baseStyle === "Street" && <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />}
        <ImageOverlay className="displacement-overlay" url="/data/displacement_overlay.png" bounds={leafletBounds} opacity={mode === "scientific" ? opacity : opacity * .55} interactive />
        <DatasetRiskBands bounds={bounds} />
        <ClickCapture onMapClick={(point) => { setClicked(point); onInspect?.(point); }} />
        <FocusLocation point={focusPoint} />
        {showMesh && <DatasetMesh bounds={bounds} onSelect={setMeshCell} />}
        {clicked && <CircleMarker center={clicked} radius={10} pathOptions={{ color: "#00e5ff", weight: 3, fillOpacity: 0 }}><Tooltip permanent direction="top">PIXEL INSPECT</Tooltip></CircleMarker>}
        {showMesh && nodePositions.map((node) => <CircleMarker key={node.id} center={[node.lat!, node.lon!]} radius={8} pathOptions={{ color: node.status === "CRITICAL" ? "#ff3d71" : node.status === "ADVISORY" ? "#ffb300" : "#10b981", fillOpacity: .85 }} eventHandlers={{ click: () => onSelect?.(node) }}><Tooltip direction="top" offset={[0, -8]}>{node.id} · {node.status}<br />Tilt {node.tilt_deg}° · Tension {node.tension_mm} mm</Tooltip></CircleMarker>)}
      </MapContainer>
      <div className="map-scale"><span>-7 cm</span><i /><span>0</span><i /><span>+1 cm</span></div>
      {mode === "scientific" && <div className="scientific-axes"><span>22.378°N</span><span>22.345°N</span><span>22.312°N</span><b>82.635°E — 82.725°E</b></div>}
      <div className="map-coordinates">SOURCE: AI_DISPLACEMENT_DATASET / {bounds.west.toFixed(3)}–{bounds.east.toFixed(3)} E / {bounds.south.toFixed(3)}–{bounds.north.toFixed(3)} N{clicked ? ` / PICK ${clicked[1].toFixed(5)}, ${clicked[0].toFixed(5)}` : ""}</div>
      {(meshCell || clicked || profileMode) && <div className="map-inspection-card"><b>{meshCell ?? "AI displacement inspection"}</b><span>Source: displacement COG · centimetres</span><span>{clicked ? `Sample point ${clicked[1].toFixed(5)}, ${clicked[0].toFixed(5)}` : "Click a mesh cell or map point to inspect"}</span><strong>{profileMode ? "Profile armed · inspection area selected" : "Overlay active · raster values visible"}</strong></div>}
    </div>
  </section>;
}
