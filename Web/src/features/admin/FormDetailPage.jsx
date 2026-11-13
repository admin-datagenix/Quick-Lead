import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowLeft, CalendarClock, Copy, Eye, Hourglass, Link2, Pencil, QrCode, UserPlus, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { copyText, fmt, formState, parseDateOnly } from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { Badge, Button, EmptyState, Loader, QueryView, useUi } from '../../components/ui';
import { AssignModal, ExtendModal, PreviewModal } from './formDialogs';

export default function FormDetailPage() {
  const { formId } = useParams();
  const { activeGroupId: gid } = useSession();
  const nav = useNavigate();
  const ui = useUi();
  const form = useQuery({ queryKey: ['form', formId], queryFn: () => api.form(formId) });
  const stats = useQuery({ queryKey: ['formAnalytics', formId], queryFn: () => api.formAnalytics(formId), refetchInterval: 60_000 });
  const [dialog, setDialog] = useState(null);

  if (form.isLoading) return <Loader />;

  return (
    <QueryView query={form}>
      {(f) => {
        const s = f.summary;
        const st = formState(s);
        const summaryForDialogs = { ...s, id: s.id };
        return (
          <>
            <div className="page-head">
              <div className="titles">
                <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start', marginLeft: -10 }} onClick={() => nav('/forms')}><ArrowLeft size={15} />All forms</button>
                <div className="wrap-row"><h1>{s.name}</h1><Badge cls={st.cls} dot>{st.label}</Badge></div>
                <p className="sub">{s.eventName ? `${s.eventName} · ` : ''}{fmt.rangeLong(s.startDate, s.endDate)} · code <span className="mono">{s.publicCode}</span></p>
              </div>
              <div className="actions">
                <Button variant="secondary" icon={Eye} onClick={() => setDialog('preview')}>Preview</Button>
                <Button variant="secondary" icon={Link2} onClick={async () => { await copyText(s.publicUrl); ui.success('Form link copied'); }}>Copy link</Button>
                <Link className="btn btn-secondary" to={`/forms/${s.id}/qr`}><QrCode size={17} />QR print</Link>
                <Link className="btn btn-secondary" to={`/forms/${s.id}/edit`}><Pencil size={16} />Edit</Link>
                <Button icon={UserPlus} onClick={() => setDialog('assign')}>Assign salesmen</Button>
              </div>
            </div>

            <QueryView query={stats} loading={<Loader />}>
              {(a) => (
                <>
                  <div className="grid cols-4">
                    <Stat label="Total leads" value={fmt.num(a.totalLeads)} />
                    <Stat label="Today" value={fmt.num(a.leadsToday)} />
                    <Stat label="Incomplete (QR)" value={fmt.num(a.incompleteLeads)} icon={Hourglass} hint="Visitors who started but did not submit" />
                    <Stat label="Duplicates" value={fmt.num(a.duplicateLeads)} icon={Copy} />
                  </div>
                  <div className="dash-grid">
                    <section className="card span-8">
                      <div className="card-head"><h2>Leads per day</h2>
                        <div className="right"><Button variant="ghost" size="sm" icon={CalendarClock} onClick={() => setDialog('extend')}>Extend dates</Button></div>
                      </div>
                      <div className="card-body" style={{ height: 300 }}>
                        {a.byDay.length === 0 ? <EmptyState icon={Users} title="No leads yet" /> : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={a.byDay} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                              <CartesianGrid stroke="#E1EAF1" strokeDasharray="3 4" vertical={false} />
                              <XAxis dataKey="date" tickFormatter={(v) => fmt.dayMonth(parseDateOnly(v))} tick={{ fill: '#5B6F82', fontSize: 12 }} axisLine={false} tickLine={false} />
                              <YAxis allowDecimals={false} tick={{ fill: '#5B6F82', fontSize: 12 }} axisLine={false} tickLine={false} />
                              <Tooltip cursor={{ fill: '#F0F9FF' }} labelFormatter={(v) => fmt.date(v)} formatter={(v) => [`${v} leads`, 'Leads']} />
                              <Bar dataKey="count" fill="#0284C7" radius={[6, 6, 0, 0]} maxBarSize={44} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </section>
                    <section className="card span-4">
                      <div className="card-head"><h2>By source</h2></div>
                      <div className="card-body"><Bars items={a.bySource.map((x) => ({ ...x, name: x.name === 'QrCode' ? 'QR scan' : x.name }))} color="#6D28D9" /></div>
                    </section>
                    <section className="card span-6">
                      <div className="card-head"><h2>By salesman</h2></div>
                      <div className="card-body"><Bars items={a.bySalesman} color="#0284C7" /></div>
                    </section>
                    <section className="card span-6">
                      <div className="card-head"><h2>By enquiry</h2></div>
                      <div className="card-body"><Bars items={a.byEnquiry} color="#0F766E" /></div>
                    </section>
                  </div>
                </>
              )}
            </QueryView>

            <section className="card">
              <div className="card-head"><h2>Fields ({f.fields.length})</h2></div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Options</th></tr></thead>
                  <tbody>
                    {f.fields.map((x) => (
                      <tr key={x.id}>
                        <td><b>{x.label}</b>{x.isSystem && <span className="muted small"> · default</span>}</td>
                        <td>{x.fieldType.replace(/([a-z])([A-Z])/g, '$1 $2')}</td>
                        <td>{x.isRequired ? 'Yes' : 'No'}</td>
                        <td className="muted small">{x.options.join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {dialog === 'assign' && <AssignModal form={summaryForDialogs} groupId={gid} onClose={() => setDialog(null)} />}
            {dialog === 'extend' && <ExtendModal form={summaryForDialogs} groupId={gid} onClose={() => setDialog(null)} />}
            {dialog === 'preview' && <PreviewModal formId={s.id} onClose={() => setDialog(null)} />}
          </>
        );
      }}
    </QueryView>
  );
}

function Stat({ label, value, icon: Icon, hint }) {
  return (
    <div className="card kpi" title={hint}>
      <span className="kpi-label row" style={{ gap: 6 }}>{Icon && <Icon size={14} />}{label}</span>
      <span className="kpi-value">{value}</span>
    </div>
  );
}

function Bars({ items, color }) {
  if (!items.length) return <p className="muted">No data yet.</p>;
  const max = Math.max(...items.map((i) => i.count));
  return (
    <div className="bar-list">
      {items.slice(0, 10).map((i) => (
        <div key={i.name} className="bar-row">
          <div className="top"><span>{i.name}</span><b className="num">{i.count}</b></div>
          <div className="track"><div className="fill" style={{ width: `${(i.count / max) * 100}%`, background: color }} /></div>
        </div>
      ))}
    </div>
  );
}
