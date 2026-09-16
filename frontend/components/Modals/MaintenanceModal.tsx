"use client";

import { BatteryCharging, Signal, Wrench, X } from "lucide-react";

export default function MaintenanceModal({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onClick={onClose}>
    <section className="modal-card maintenance-modal" role="dialog" aria-modal="true" aria-labelledby="maintenance-title" onClick={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close"><X size={17} /></button>
      <div className="modal-kicker"><Wrench size={16} /> TELEMETRY HEALTH</div>
      <h2 id="maintenance-title">Maintenance — 40 Node Fleet</h2>
      <div className="maintenance-list"><p><Signal size={15} className="text-red" /><b>Node N-21</b><span>Signal Weak (RSSI -104 dBm) — Battery 88%</span></p><p><Wrench size={15} className="text-yellow" /><b>Node N-09</b><span>Tilt Calibration Drift (+0.4°) — Requires Re-zeroing</span></p><p><BatteryCharging size={15} className="text-red" /><b>Node N-17</b><span>High Strain Trigger — Urgent Structural Inspection</span></p><p><Signal size={15} className="text-green" /><b>37 Nodes</b><span>Optimal (Battery &gt; 90%, Latency &lt; 120ms)</span></p></div>
      <button className="outline-button" onClick={onClose}>Close</button>
    </section>
  </div>;
}
