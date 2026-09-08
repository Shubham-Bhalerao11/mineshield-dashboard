"use client";

import { Layers3, Mountain, Ruler } from "lucide-react";

export default function StrataInspector() {
  return <aside className="inspector-panel"><div className="panel-kicker"><Layers3 size={15} /> STRATA & SAMPLE INSPECTOR</div><div className="borehole-id">BOREHOLE 679 <span>FIELD LOG</span></div><div className="lithology-log"><div><i className="sandstone" /><span>Sandstone</span><b>13 ft</b></div><div><i className="sandy-shale" /><span>Sandy shale</span><b>35%</b></div><div><i className="shale" /><span>Shale</span><b>55%</b></div><div><i className="coal" /><span>Coal seam</span><b>5 ft</b></div></div><div className="inspector-metric"><Ruler size={15} /><span>ANGLE OF DRAW</span><strong>25°–35°</strong></div><div className="inspector-metric"><Mountain size={15} /><span>CMRR RATING</span><strong>52 <small>MODERATE / HIGH CAVING RISK</small></strong></div><div className="inspector-foot">Reference profile for panel interpretation. Confirm against current CMPDI strata records before statutory decisions.</div></aside>;
}
