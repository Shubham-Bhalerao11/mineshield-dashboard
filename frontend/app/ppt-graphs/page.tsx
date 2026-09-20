'use client';

import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const costData = [
  { name: 'MineShield AI (surface + underground + cloud)', cost: 24.79 },
  { name: 'IIT(BHU) Package 2022', cost: 37.15 },
  { name: 'MOIL AI/ML Service', cost: 45.5 },
  { name: 'IIT(BHU) Package 2023', cost: 54.97 },
];

const parametersData = [
  { name: 'MineShield AI (Ours)', parameters: 4 },
  { name: 'IoT Smart Strata', parameters: 1 },
  { name: 'IIT (ISM) Strata Monitoring', parameters: 1 },
  { name: 'CMPDI + IIT Kharagpur', parameters: 1 },
  { name: 'SECL Microseismic Monitoring', parameters: 1 },
];

const featuresData = [
  { name: 'MineShield AI (Ours)', score: 6 },
  { name: 'RTEPMS', score: 4 },
  { name: 'UGMD', score: 4 },
  { name: 'IIEST/ECL', score: 3 },
];

const colors = { ours: '#059669', competitor: '#64748b', grid: '#dbe3ea', text: '#526273' };
const featureLabels = ['IoT', 'Wireless', 'Cloud/Dashboard', 'AI/ML', 'Localization', 'Data logging'];

function barColor(name: string) {
  return name.includes('MineShield') ? colors.ours : colors.competitor;
}

function ValueTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={styles.tooltip}>
      <div style={{ color: colors.text, fontSize: 12 }}>{label}</div>
      <strong style={{ color: colors.ours, fontSize: 18 }}>
        {unit === '₹ lakh' ? `₹${Number(payload[0].value).toFixed(2)}` : payload[0].value}
        <small style={{ color: colors.text, fontSize: 11, marginLeft: 5 }}>{unit}</small>
      </strong>
    </div>
  );
}

function ComparisonCard({
  number,
  title,
  subtitle,
  insight,
  children,
}: {
  number: string;
  title: string;
  subtitle: React.ReactNode;
  insight: string;
  children: React.ReactNode;
}) {
  return (
    <section style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.number}>{number}</div>
        <div style={{ flex: 1 }}>
          <h2 style={styles.cardTitle}>{title}</h2>
          <div style={styles.subtitle}>{subtitle}</div>
        </div>
        <div style={styles.legend}>
          <span style={{ ...styles.dot, background: colors.ours }} /> MineShield AI
          <span style={{ ...styles.dot, background: colors.competitor, marginLeft: 12 }} /> Other systems
        </div>
      </div>
      <div style={styles.chart}>{children}</div>
      <div style={styles.insight}><b>Why it matters:</b> {insight}</div>
    </section>
  );
}

export default function PptGraphsPage() {
  notFound();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <main className="ppt-graph-page" style={styles.page}>
      <header style={styles.header}>
        <div style={styles.eyebrow}><span style={styles.pulse} /> COMPETITIVE COMPARISON · PPT VIEW</div>
        <h1 style={styles.title}>MineShield AI <span style={{ color: '#64748b' }}>vs.</span> Existing Systems</h1>
        <p style={styles.description}>A readable, presentation-ready comparison with complete node coverage and cloud storage included.</p>
      </header>

      <div className="ppt-graph-grid" style={styles.grid}>
        <ComparisonCard
          number="01"
          title="Deployment Cost"
          subtitle="Complete system deployment cost (₹ lakh) · Lower is better"
          insight="Updated MineShield AI total: ₹24.79 lakh. This includes the original ₹22.29 lakh baseline, ₹1.25 lakh for the surface-node/cloud revision, and ₹1.25 lakh for underground counterparts."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={costData} layout="vertical" margin={{ top: 4, right: 68, left: 12, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke={colors.grid} strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 60]} tick={{ fill: colors.text, fontSize: 12 }} axisLine={{ stroke: colors.grid }} tickLine={false} />
              <YAxis type="category" dataKey="name" width={280} tick={{ fill: '#334155', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} content={<ValueTooltip unit="₹ lakh" />} />
              <Bar dataKey="cost" barSize={30} radius={[0, 6, 6, 0]}>
                {costData.map((entry) => <Cell key={entry.name} fill={barColor(entry.name)} />)}
                <LabelList dataKey="cost" position="right" fill="#334155" fontSize={12} formatter={(value: number) => `₹${value.toFixed(2)}L`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ComparisonCard>

        <ComparisonCard
          number="02"
          title="Parameters Monitored"
          subtitle="Distinct safety and geotechnical parameters · Higher is better"
          insight="MineShield AI monitors 4 parameters, while each listed comparison system covers 1."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={parametersData} layout="vertical" margin={{ top: 4, right: 50, left: 12, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke={colors.grid} strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 5]} allowDecimals={false} tick={{ fill: colors.text, fontSize: 12 }} axisLine={{ stroke: colors.grid }} tickLine={false} />
              <YAxis type="category" dataKey="name" width={250} tick={{ fill: '#334155', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} content={<ValueTooltip unit="parameters" />} />
              <Bar dataKey="parameters" barSize={28} radius={[0, 6, 6, 0]}>
                {parametersData.map((entry) => <Cell key={entry.name} fill={barColor(entry.name)} />)}
                <LabelList dataKey="parameters" position="right" fill="#334155" fontSize={13} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ComparisonCard>

        <ComparisonCard
          number="03"
          title="Integrated Feature Score"
          subtitle={<span style={styles.featureList}>{featureLabels.map((label) => <b key={label}>{label}</b>)}</span>}
          insight="MineShield AI provides the only complete 6/6 feature set in this comparison."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={featuresData} layout="vertical" margin={{ top: 4, right: 50, left: 12, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke={colors.grid} strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 6]} allowDecimals={false} tick={{ fill: colors.text, fontSize: 12 }} axisLine={{ stroke: colors.grid }} tickLine={false} />
              <YAxis type="category" dataKey="name" width={170} tick={{ fill: '#334155', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} content={<ValueTooltip unit="of 6" />} />
              <Bar dataKey="score" barSize={32} radius={[0, 6, 6, 0]}>
                {featuresData.map((entry) => <Cell key={entry.name} fill={barColor(entry.name)} />)}
                <LabelList dataKey="score" position="right" fill="#334155" fontSize={13} formatter={(value: number) => `${value}/6`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ComparisonCard>
      </div>
      <style jsx global>{`
        @media (max-width: 700px) {
          .ppt-graph-page { padding: 28px 18px 40px !important; }
          .ppt-graph-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#ffffff', color: '#17202b', padding: '42px 52px 64px', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' },
  header: { maxWidth: 1240, margin: '0 auto 36px', borderBottom: '2px solid #dbe3ea', paddingBottom: 24 },
  eyebrow: { color: '#047857', fontSize: 12, fontWeight: 800, letterSpacing: '0.18em', display: 'flex', alignItems: 'center', gap: 9 },
  pulse: { width: 8, height: 8, borderRadius: '50%', background: '#059669' },
  title: { fontSize: 'clamp(30px, 4vw, 48px)', lineHeight: 1.1, margin: '14px 0 8px', letterSpacing: '-0.04em', color: '#0f172a' },
  description: { color: '#526273', fontSize: 15, margin: 0 },
  grid: { maxWidth: 1240, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr', gap: 28 },
  card: { minWidth: 0, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 12, padding: 28, boxShadow: '0 8px 24px rgba(15,23,42,.08)' },
  cardHeader: { display: 'flex', alignItems: 'flex-start', gap: 16, minHeight: 76 },
  number: { color: '#047857', fontSize: 14, fontWeight: 800, letterSpacing: '0.12em', paddingTop: 3 },
  cardTitle: { fontSize: 24, lineHeight: 1.2, margin: 0, color: '#0f172a' },
  subtitle: { color: '#526273', fontSize: 13, lineHeight: 1.55, margin: '8px 0 0' },
  featureList: { display: 'flex', flexWrap: 'wrap', gap: '6px 14px' },
  legend: { color: '#526273', fontSize: 11, whiteSpace: 'nowrap', paddingTop: 4 },
  dot: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 5 },
  chart: { height: 460, width: '100%', marginTop: 8 },
  insight: { borderTop: '1px solid #dbe3ea', color: '#526273', fontSize: 13, lineHeight: 1.6, paddingTop: 16, marginTop: 16 },
  tooltip: { background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, padding: '9px 12px', boxShadow: '0 12px 30px rgba(15,23,42,.12)' },
};
