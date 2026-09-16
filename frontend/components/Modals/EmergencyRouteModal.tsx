"use client";

import { MapPin, Radio, Route, X } from "lucide-react";

export default function EmergencyRouteModal({ onClose, onDispatch }: { onClose: () => void; onDispatch: () => void }) {
  return <div className="modal-backdrop" role="presentation" onClick={onClose}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="route-title" onClick={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close"><X size={17} /></button>
      <div className="modal-kicker"><Route size={16} /> EMERGENCY RESPONSE</div>
      <h2 id="route-title">Emergency Evacuation Corridor — Zone B</h2>
      <div className="route-schematic"><div className="route-node">SHAFT 2</div><div className="route-line"><i /><i /><i /></div><div className="route-node exit"><MapPin size={15} /> EXIT E-03</div></div>
      <div className="modal-details"><p><b>Primary route</b> Shaft 2 to Exit E-03 · 240 m clearance</p><p><b>Status</b> Safe passage verified; bypassed shear zone at Node N-17.</p><p><b>Affected personnel</b> 8 workers tracked and notified.</p></div>
      <div className="modal-actions"><button className="primary-button" onClick={onDispatch}><Radio size={14} /> Dispatch Evacuation Beacon</button><button className="outline-button" onClick={() => window.alert("DGMS evacuation log prepared for download.")}>Download DGMS Evacuation Log</button><button className="outline-button" onClick={onClose}>Close</button></div>
    </section>
  </div>;
}
