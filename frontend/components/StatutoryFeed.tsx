"use client";

import { FileDown, ShieldCheck } from "lucide-react";
import AlertTable, { AlertEvent } from "./AlertTable";

export default function StatutoryFeed({ alerts }: { alerts: AlertEvent[] }) {
  return <section className="statutory-view"><div className="compliance-banner"><div><div className="panel-kicker"><ShieldCheck size={15} /> DGMS STATUTORY COMPLIANCE</div><h2>CMR 2017 operating thresholds</h2></div><button className="secondary"><FileDown size={14} /> Export Form-IV</button></div><div className="compliance-rules"><div><b>SAFE</b><span>Rate &lt; 2 mm/day</span><em>GREEN</em><meter className="meter-safe" min={0} max={5} value={1.2} /></div><div><b>ADVISORY</b><span>Rate 2–5 mm/day / tensile crack initiation</span><em>AMBER</em><meter className="meter-advisory" min={0} max={5} value={3.4} /></div><div><b>STOP / EVACUATE</b><span>Rate &gt; 5 mm/day or cumulative &gt; 50 mm near public structures</span><em>RED</em><meter className="meter-critical" min={0} max={5} value={5} /></div></div><AlertTable alerts={alerts} /></section>;
}
