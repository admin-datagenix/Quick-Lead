import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, Clock, Copy, FileText, Minus, Plus, QrCode,
  RefreshCw, Trophy, UserCheck, Users, Zap,
} from 'lucide-react';
import { api } from '../../lib/api';
import { addDays, fmt, parseDateOnly, sourceLabel, toDateOnly, today } from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { Avatar, Badge, EmptyState, ErrorState, Loader } from '../../components/ui';
import LeadDetailDrawer from './LeadDetailDrawer';

const RANGES = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: 'custom', label: 'Custom' },
];

const SOURCE_COLORS = { 'Salesman app': '#0284C7', 'QR scan': '#6D28D9', 'Shared link': '#0F766E' };

export default function DashboardPage() {
  const s = useSession();
  const gid = s.activeGroupId;
  const [range, setRange] = useState('30d');
  const [custom, setCustom] = useState({ from: toDateOnly(addDays(today(), -13)), to: toDateOnly(today()) });
  const [formId, setFormId] = useState('');
  const [leadId, setLeadId] = useState(null);

  const params = useMemo(() => {
    if (range === 'custom') return { from: custom.from, to: custom.to };
    const r = RANGES.find((x) => x.key === range);
    return { from: toDateOnly(addDays(today(), -(r.days - 1))), to: toDateOnly(today()) };
  }, [range, custom]);

  const forms = useQuery({ queryKey: ['forms', gid], queryFn: () => api.forms(gid) });
  const q = useQuery({
    queryKey: ['analytics', gid, params, formId],
    queryFn: () => api.analytics(gid, { ...params, formId: formId || undefined }),
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });

  const d = q.data;

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <span className="eyebrow">{s.active?.companyName}</span>
          <h1>Lead dashboard</h1>
          <p className="sub">
            {d ? <>Showing <b style={{ color: 'var(--ink)' }}>{fmt.rangeLong(d.from, d.to)}</b> · refreshes every minute</> : 'Live lead KPIs for your group'}
          </p>
        </div>
        <div className="actions">
          <div className="seg" role="tablist" aria-label="Date range">
            {RANGES.map((r) => (
              <button key={r.key} role="tab" aria-selected={range === r.key} className={range === r.key ? 'on' : ''} onClick={() => setRange(r.key)}>{r.label}</button>
            ))}
          </div>
          {range === 'custom' && (
            <div className="row" style={{ gap: 6 }}>
              <input type="date" className="input" style={{ width: 150 }} aria-label="From date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
              <span className="muted">–</span>
              <input type="date" className="input" style={{ width: 150 }} aria-label="To date" value={custom.to} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
            </div>
          )}
          <select className="select" style={{ width: 220 }} aria-label="Filter by form" value={formId} onChange={(e) => setFormId(e.target.value)}>
            <option value="">All forms</option>
            {(forms.data || []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <button className="icon-btn" onClick={() => q.refetch()} aria-label="Refresh" title="Refresh">
            <RefreshCw size={17} className={q.isFetching ? 'spinning' : ''} style={q.isFetching ? { animation: 'spin 1s linear infinite' } : undefined} />
          </button>
        </div>
      </div>

      {q.isLoading ? <Loader /> : q.isError && !d ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : d && (
        d.byForm.length === 0 && d.kpis.totalLeads === 0 ? <FirstRun /> : (
          <>
            <KpiRow d={d} range={range} />
            <StatStrip k={d.kpis} />

            <div className="dash-grid">
              <section className="card span-8">
                <div className="card-head">
                  <div><h2>Leads over time</h2><p className="hint">Completed leads per day, by source</p></div>
                  <div className="right legend">
                    <span><i style={{ background: '#0284C7' }} />App</span>
                    <span><i style={{ background: '#6D28D9' }} />QR scan</span>
                    <span><i style={{ background: '#0F766E' }} />Link</span>
                  </div>
                </div>
                <div className="card-body" style={{ height: 320, paddingTop: 12 }}>
                  <TrendChart daily={d.daily} />
                </div>
              </section>

              <section className="card span-4">
                <div className="card-head"><div><h2>Lead sources</h2><p className="hint">How leads reached you</p></div></div>
                <div className="card-body"><SourceDonut data={d.bySource} total={d.kpis.totalLeads} /></div>
              </section>

              <section className="card span-7">
                <div className="card-head">
                  <div><h2>Salesman leaderboard</h2><p className="hint">Ranked by leads in this range</p></div>
                  <div className="right"><Link className="btn btn-ghost btn-sm" to="/salesmen">All salesmen</Link></div>
                </div>
                <Leaderboard rows={d.bySalesman} />
              </section>

              <section className="card span-5">
                <div className="card-head"><div><h2>What visitors ask about</h2><p className="hint">“Enquiry about” answers</p></div></div>
                <div className="card-body"><EnquiryBars items={d.byEnquiry} /></div>
              </section>

              <section className="card span-8">
                <div className="card-head">
                  <div><h2>Busiest hours</h2><p className="hint">Leads by weekday and hour (IST). Plan stall staffing around the dark cells.</p></div>
                </div>
                <div className="card-body"><Heatmap data={d.heatmap} /></div>
              </section>

              <section className="card span-4">
                <div className="card-head">
                  <div><h2>Latest leads</h2><p className="hint">Live feed</p></div>
                  <div className="right"><Link className="btn btn-ghost btn-sm" to="/leads">View all</Link></div>
                </div>
                <div className="feed">
                  {d.recentLeads.length === 0 ? <p className="muted" style={{ padding: 20 }}>No leads yet.</p> : d.recentLeads.slice(0, 6).map((l) => (
                    <div key={l.id} className="feed-item" role="button" tabIndex={0} onClick={() => setLeadId(l.id)} onKeyDown={(e) => e.key === 'Enter' && setLeadId(l.id)}>
                      <Avatar name={l.fullName} size={34} />
                      <div className="meta">
                        <div className="n truncate">{l.fullName}</div>
                        <div className="s">{l.enquiryAbout || l.formName} · {l.salesmanName || sourceLabel(l.source)}</div>
                      </div>
                      <time>{fmt.relative(l.capturedAt).replace('Today, ', '')}</time>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card span-12">
                <div className="card-head">
                  <div><h2>Form performance</h2><p className="hint">Every form in this group, live forms first</p></div>
                  <div className="right"><Link className="btn btn-secondary btn-sm" to="/forms/new"><Plus size={15} />New form</Link></div>
                </div>
                <FormTable rows={d.byForm} />
              </section>
            </div>
          </>
        )
      )}

      {leadId && <LeadDetailDrawer leadId={leadId} onClose={() => setLeadId(null)} />}
    </>
  );
}

/* ------------------------------------------------------------------ KPI cards */
function Delta({ now, prev, suffix = 'vs previous period' }) {
  if (!prev && !now) return <span className="kpi-foot"><span className="delta flat"><Minus size={12} />0%</span>{suffix}</span>;
  if (!prev) return <span className="kpi-foot"><span className="delta up"><ArrowUpRight size={13} />New</span>{suffix}</span>;
  const pct = Math.round(((now - prev) / prev) * 100);
  const cls = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
  return <span className="kpi-foot"><span className={`delta ${cls}`}><Icon size={13} />{Math.abs(pct)}%</span>{suffix}</span>;
}

function Spark({ data, color = '#0284C7' }) {
  const max = Math.max(1, ...data);
  const w = 96; const h = 34;
  if (data.length < 2) return null;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 2 - (v / max) * (h - 4)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg className="kpi-spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={color} opacity=".12" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill={color} />
    </svg>
  );
}

function KpiCard({ icon: Icon, tone, label, value, foot, spark }) {
  const [bg, fg] = tone;
  return (
    <div className="card kpi">
      <div className="kpi-top"><span className="kpi-ic" style={{ background: bg, color: fg }}><Icon size={18} /></span><span className="kpi-label">{label}</span></div>
      {spark && <Spark data={spark} color={fg} />}
      <div className="kpi-value">{value}</div>
      {foot}
    </div>
  );
}

function KpiRow({ d, range }) {
  const k = d.kpis;
  const totals = d.daily.map((p) => p.total);
  const qr = d.daily.map((p) => p.qr + p.link);
  return (
    <div className="grid cols-4">
      <div className="card hero-kpi">
        <div className="kpi-top"><span className="kpi-ic" style={{ background: 'rgba(255,255,255,.14)', color: '#fff' }}><Zap size={18} /></span><span className="kpi-label">Leads captured</span></div>
        <div className="kpi-value">{fmt.num(k.totalLeads)}</div>
        <Delta now={k.totalLeads} prev={k.previousPeriodLeads} suffix={range === 'today' ? 'vs yesterday' : 'vs previous period'} />
      </div>
      <KpiCard icon={CalendarDays} tone={['#E0F2FE', '#0284C7']} label="Leads today" value={fmt.num(k.leadsToday)}
        foot={<Delta now={k.leadsToday} prev={k.leadsYesterday} suffix="vs yesterday" />} spark={totals.slice(-14)} />
      <KpiCard icon={UserCheck} tone={['#F3EEFF', '#6D28D9']} label="Active salesmen"
        value={<>{k.activeSalesmen}<span style={{ fontSize: 18, color: 'var(--faint)' }}> / {k.totalSalesmen}</span></>}
        foot={<span className="kpi-foot">{k.totalSalesmen ? `${Math.round((k.activeSalesmen / k.totalSalesmen) * 100)}% captured at least one lead` : 'Invite salesmen to start'}</span>} />
      <KpiCard icon={QrCode} tone={['#E6F7F4', '#0F766E']} label="Self-service share" value={`${k.qrSharePercent}%`}
        foot={<span className="kpi-foot">Leads from QR scans and links</span>} spark={qr.slice(-14)} />
    </div>
  );
}

function StatStrip({ k }) {
  const items = [
    { icon: Activity, label: 'Avg per day', value: k.averagePerDay },
    { icon: FileText, label: 'Live forms', value: k.liveForms },
    { icon: AlertTriangle, label: 'Incomplete', value: fmt.num(k.incompleteLeads), hint: 'Started the QR form but did not submit' },
    { icon: Copy, label: 'Duplicates', value: fmt.num(k.duplicateLeads), hint: 'Mobile number captured before' },
    { icon: Trophy, label: 'Best day', value: k.bestDay ? `${k.bestDayLeads}` : '—', sub: k.bestDay ? fmt.dayMonth(k.bestDay) : '' },
    { icon: Clock, label: 'Peak hour', value: fmt.hour(k.peakHour) },
  ];
  return (
    <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
      {items.map((it, i) => (
        <div key={it.label} title={it.hint} style={{ padding: '14px 18px', borderLeft: i ? '1px solid var(--line)' : 0, display: 'grid', gap: 4 }}>
          <span className="row muted small" style={{ gap: 6 }}><it.icon size={14} />{it.label}</span>
          <span className="num" style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 22 }}>
            {it.value}{it.sub && <span className="muted" style={{ fontFamily: 'var(--f-body)', fontSize: 13, fontWeight: 500 }}> on {it.sub}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ charts */
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="chart-tip">
      <b>{fmt.date(label)} · {total} leads</b>
      {payload.slice().reverse().map((p) => <div key={p.dataKey}><span style={{ color: p.color }}>●</span> {p.name}: {p.value}</div>)}
    </div>
  );
}

function TrendChart({ daily }) {
  const data = daily.map((p) => ({ ...p, label: p.date }));
  const dense = data.length > 45;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gApp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0284C7" stopOpacity={0.35} /><stop offset="100%" stopColor="#0284C7" stopOpacity={0.04} /></linearGradient>
          <linearGradient id="gQr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6D28D9" stopOpacity={0.3} /><stop offset="100%" stopColor="#6D28D9" stopOpacity={0.04} /></linearGradient>
          <linearGradient id="gLink" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0F766E" stopOpacity={0.3} /><stop offset="100%" stopColor="#0F766E" stopOpacity={0.04} /></linearGradient>
        </defs>
        <CartesianGrid stroke="#E1EAF1" strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey="label" tickFormatter={(v) => fmt.dayMonth(parseDateOnly(v))} tick={{ fill: '#5B6F82', fontSize: 12 }} axisLine={false} tickLine={false}
          minTickGap={dense ? 24 : 12} />
        <YAxis allowDecimals={false} tick={{ fill: '#5B6F82', fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTip />} cursor={{ stroke: '#BAE6FD', strokeWidth: 2 }} />
        <Area type="monotone" dataKey="link" name="Link" stackId="1" stroke="#0F766E" strokeWidth={2} fill="url(#gLink)" />
        <Area type="monotone" dataKey="qr" name="QR scan" stackId="1" stroke="#6D28D9" strokeWidth={2} fill="url(#gQr)" />
        <Area type="monotone" dataKey="app" name="App" stackId="1" stroke="#0284C7" strokeWidth={2.2} fill="url(#gApp)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function SourceDonut({ data, total }) {
  const rows = data.filter((d) => d.count > 0);
  if (!total) return <EmptyState icon={QrCode} title="No leads in this range" />;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div style={{ height: 210, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="count" nameKey="name" innerRadius="64%" outerRadius="92%" paddingAngle={2} stroke="none">
              {rows.map((r) => <Cell key={r.name} fill={SOURCE_COLORS[r.name] || '#94A3B8'} />)}
            </Pie>
            <Tooltip formatter={(v, n) => [`${v} leads`, n]} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', textAlign: 'center' }}>
          <div><div className="num" style={{ fontFamily: 'var(--f-display)', fontSize: 30, fontWeight: 700 }}>{fmt.num(total)}</div><div className="muted small">leads</div></div>
        </div>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {data.map((r) => (
          <div key={r.name} className="row" style={{ justifyContent: 'space-between' }}>
            <span className="row" style={{ gap: 8 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: SOURCE_COLORS[r.name] }} />{r.name}</span>
            <span className="num"><b>{r.count}</b> <span className="muted">· {total ? Math.round((r.count / total) * 100) : 0}%</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EnquiryBars({ items }) {
  if (!items.length) return <p className="muted">No enquiries in this range.</p>;
  const max = Math.max(...items.map((i) => i.count));
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <div className="bar-list">
      {items.slice(0, 8).map((i) => (
        <div key={i.name} className="bar-row">
          <div className="top"><span>{i.name}</span><span className="num"><b>{i.count}</b> <span className="muted">{Math.round((i.count / total) * 100)}%</span></span></div>
          <div className="track"><div className="fill" style={{ width: `${(i.count / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HEAT = ['#F0F9FF', '#BAE6FD', '#7DD3FC', '#38BDF8', '#0284C7', '#075985'];

function Heatmap({ data }) {
  const max = Math.max(1, ...data.flat());
  const shade = (v) => (v === 0 ? '#F4F8FB' : HEAT[Math.min(HEAT.length - 1, Math.ceil((v / max) * (HEAT.length - 1)))]);
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="table-wrap">
        <div className="heat" style={{ minWidth: 560 }}>
          <span />
          {Array.from({ length: 24 }, (_, h) => <span key={h} className="hh">{h % 3 === 0 ? (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`) : ''}</span>)}
          {data.map((row, di) => (
            <Row key={di} label={DAYS[di]} row={row} shade={shade} />
          ))}
        </div>
      </div>
      <div className="heat-scale">Fewer {HEAT.map((c) => <i key={c} style={{ background: c }} />)} More</div>
    </div>
  );
}

function Row({ label, row, shade }) {
  return (
    <>
      <span className="hl">{label}</span>
      {row.map((v, h) => <span key={h} className="cell" style={{ background: shade(v) }} title={`${label} ${fmt.hour(h)}: ${v} leads`} />)}
    </>
  );
}

/* ------------------------------------------------------------------ tables */
function Leaderboard({ rows }) {
  const nav = useNavigate();
  if (!rows.length) return <EmptyState icon={Users} title="No salesmen yet" action={<Link className="btn btn-primary" to="/salesmen">Invite salesmen</Link>} />;
  const max = Math.max(1, ...rows.map((r) => r.leads));
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th style={{ width: 54 }}>#</th><th>Salesman</th><th style={{ width: '28%' }}>Leads</th><th>Today</th><th>QR</th><th>Last lead</th></tr></thead>
        <tbody>
          {rows.slice(0, 8).map((r, i) => (
            <tr key={r.memberId} className="clickable" onClick={() => nav(`/salesmen?m=${r.memberId}`)}>
              <td><span className={`rank ${i < 3 && r.leads > 0 ? `r${i + 1}` : ''}`}>{i + 1}</span></td>
              <td>
                <div className="cell-person">
                  <Avatar name={r.name} size={32} />
                  <div className="grow"><div className="n truncate">{r.name}</div><div className="s mono">{r.salesmanCode}{!r.isActive && ' · inactive'}</div></div>
                </div>
              </td>
              <td><div className="row" style={{ gap: 10 }}><b className="num" style={{ minWidth: 32 }}>{r.leads}</b><div className="mini-bar"><span style={{ width: `${(r.leads / max) * 100}%` }} /></div></div></td>
              <td className="num">{r.leadsToday}</td>
              <td className="num">{r.qrLeads}</td>
              <td className="muted small">{r.lastCaptureAt ? fmt.relative(r.lastCaptureAt) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FormTable({ rows }) {
  const nav = useNavigate();
  if (!rows.length) return <EmptyState icon={FileText} title="No forms yet" action={<Link className="btn btn-primary" to="/forms/new">Create form</Link>} />;
  const t = today();
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Form</th><th>Status</th><th>Dates</th><th>Leads</th><th>Today</th><th>Incomplete</th><th>Salesmen</th></tr></thead>
        <tbody>
          {rows.map((f) => {
            const end = parseDateOnly(f.endDate);
            const left = Math.round((end - t) / 86400000);
            return (
              <tr key={f.formId} className="clickable" onClick={() => nav(`/forms/${f.formId}`)}>
                <td><b>{f.name}</b></td>
                <td>{f.isLive ? <Badge cls="b-live" dot>Live</Badge> : left < 0 ? <Badge cls="b-expired" dot>Ended</Badge> : <Badge cls="b-draft" dot>Not live</Badge>}</td>
                <td className="small">{fmt.rangeShort(f.startDate, f.endDate)}{f.isLive && <span className="muted"> · {left === 0 ? 'ends today' : `${left}d left`}</span>}</td>
                <td className="num"><b>{fmt.num(f.leads)}</b></td>
                <td className="num">{f.leadsToday}</td>
                <td className="num">{f.incomplete > 0 ? <Badge cls="b-amber">{f.incomplete}</Badge> : 0}</td>
                <td className="num">{f.salesmen}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FirstRun() {
  return (
    <div className="card">
      <EmptyState
        icon={Zap}
        title="Your dashboard fills up as leads arrive"
        message="Create your first form, invite salesmen and assign them. Lead KPIs, trends and the leaderboard appear here live."
        action={<div className="wrap-row" style={{ justifyContent: 'center' }}><Link className="btn btn-primary" to="/forms/new"><Plus size={16} />Create form</Link><Link className="btn btn-secondary" to="/salesmen">Invite salesmen</Link></div>}
      />
    </div>
  );
}
