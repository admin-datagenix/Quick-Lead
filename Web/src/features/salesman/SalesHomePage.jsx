import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ban, CheckCircle2, ChevronRight, FileText, Plus, QrCode, UserPlus } from 'lucide-react';
import { api } from '../../lib/api';
import { fmt } from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { Avatar, Badge, Button, EmptyState, Modal, QueryView, useUi } from '../../components/ui';

export default function SalesHomePage() {
  const s = useSession();
  const gid = s.activeGroupId;
  const nav = useNavigate();
  const ui = useUi();
  const home = useQuery({ queryKey: ['home', gid], queryFn: () => api.home(gid), refetchInterval: 60_000 });
  const forms = useQuery({ queryKey: ['forms', gid], queryFn: () => api.forms(gid) });
  const [picker, setPicker] = useState(null); // 'lead' | 'qr'
  const first = (s.user?.fullName || '').split(' ')[0];

  function addLead() {
    const h = home.data;
    if (h && !h.isActive) { ui.info('Your account is deactivated in this group.'); return; }
    if (h?.primaryFormId) { nav(`/capture/${h.primaryFormId}`); return; }
    const live = (forms.data || []).filter((f) => f.isLive);
    if (!live.length) { ui.info('No live form is assigned to you yet.'); return; }
    if (live.length === 1) { nav(`/capture/${live[0].id}`); return; }
    setPicker('lead');
  }

  return (
    <QueryView query={home}>
      {(h) => (
        <>
          <section className="sales-hero">
            <div className="stack" style={{ gap: 10 }}>
              <p>{fmt.greeting()}{first && `, ${first}`}</p>
              <div className="row" style={{ alignItems: 'flex-end', gap: 14 }}>
                <span className="big num">{h.todayCount}</span>
                <span style={{ paddingBottom: 6, fontWeight: 600 }}>leads captured<br />today</span>
              </div>
              <p className="small">{fmt.num(h.totalCount)} total · {h.activeFormsCount} active form{h.activeFormsCount === 1 ? '' : 's'} · {h.groupName}</p>
            </div>
            <button className="choice" style={{ maxWidth: 360, color: 'var(--ink)' }} onClick={addLead}>
              <span className="ci" style={{ background: 'var(--sky)', color: '#fff' }}><Plus size={28} /></span>
              <span className="grow"><b style={{ fontSize: 18 }}>Add lead</b><span className="muted small truncate" style={{ display: 'block' }}>{h.primaryFormName ? `Primary · ${h.primaryFormName}` : 'Capture a visitor’s details'}</span></span>
              <ChevronRight size={18} color="#0369A1" />
            </button>
          </section>

          {!h.isActive && <div className="banner danger"><Ban size={18} />Your account is deactivated in this group. Contact your admin to capture leads.</div>}

          <div className="grid cols-3">
            <button className="qa" onClick={addLead}><span className="qi" style={{ background: 'var(--sky-100)', color: 'var(--sky-700)' }}><UserPlus size={22} /></span>Add lead</button>
            <button className="qa" onClick={() => setPicker('qr')}><span className="qi" style={{ background: 'var(--violet-50)', color: 'var(--violet)' }}><QrCode size={22} /></span>My QR</button>
            <Link className="qa" to="/my-forms"><span className="qi" style={{ background: 'var(--teal-50)', color: 'var(--teal)' }}><FileText size={22} /></span>My forms</Link>
          </div>

          <section className="card">
            <div className="card-head"><h2>Recent leads</h2><div className="right"><Link className="btn btn-ghost btn-sm" to="/my-leads">Show all</Link></div></div>
            {h.recentLeads.length === 0 ? <EmptyState icon={UserPlus} title="No leads yet" message="Click Add lead to capture your first visitor." /> : h.recentLeads.map((l) => (
              <div key={l.id} className="feed-item" style={{ cursor: 'default' }}>
                <Avatar name={l.fullName} size={36} />
                <div className="meta"><div className="n">{l.fullName}</div><div className="s">{fmt.relative(l.capturedAt)}</div></div>
                <CheckCircle2 size={19} color="#15803D" />
              </div>
            ))}
          </section>

          {picker && (
            <FormPicker
              forms={(forms.data || []).filter((f) => (picker === 'lead' ? f.isLive : f.isLive || f.isUpcoming))}
              title={picker === 'lead' ? 'Choose a form' : 'My QR'}
              cta={picker === 'lead' ? 'Continue' : 'Open QR print page'}
              onClose={() => setPicker(null)}
              onPick={(f) => nav(picker === 'lead' ? `/capture/${f.id}` : `/forms/${f.id}/qr`)}
            />
          )}
        </>
      )}
    </QueryView>
  );
}

export function FormPicker({ forms, title, cta, onPick, onClose }) {
  const [sel, setSel] = useState(forms.find((f) => f.isPrimary)?.id || forms[0]?.id);
  return (
    <Modal title={title} subtitle="Active forms assigned to you" onClose={onClose}
      footer={forms.length ? <Button onClick={() => { onClose(); onPick(forms.find((f) => f.id === sel)); }}>{cta}</Button> : null}>
      {forms.length === 0 ? <p className="muted">No active forms are assigned to you.</p> : forms.map((f) => (
        <label key={f.id} className="choice" style={{ padding: 12, borderColor: sel === f.id ? 'var(--sky)' : undefined, background: sel === f.id ? 'var(--sky-50)' : undefined }}>
          <input type="radio" name="pick" checked={sel === f.id} onChange={() => setSel(f.id)} style={{ accentColor: '#0369A1' }} />
          <span className="grow"><span className="wrap-row" style={{ gap: 6 }}><b>{f.name}</b>{f.isPrimary && <Badge>Primary</Badge>}</span>
            <span className="muted small">{fmt.rangeLong(f.startDate, f.endDate)}</span></span>
        </label>
      ))}
    </Modal>
  );
}
