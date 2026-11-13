import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Eye, FileText, Link2, Plus, QrCode, Star } from 'lucide-react';
import { api } from '../../lib/api';
import { copyText, fmt, formState } from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { Badge, Button, EmptyState, QueryView, ToolButton, useUi } from '../../components/ui';
import { PreviewModal } from '../admin/formDialogs';

export default function MyFormsPage() {
  const s = useSession();
  const gid = s.activeGroupId;
  const q = useQuery({ queryKey: ['forms', gid], queryFn: () => api.forms(gid) });
  const [preview, setPreview] = useState(null);

  return (
    <>
      <div className="page-head"><div className="titles"><h1>My forms</h1><p className="sub">Forms your admin assigned to you in {s.active?.groupName}. The primary form opens when you click Add lead.</p></div></div>
      <QueryView query={q}>
        {(forms) => forms.length === 0 ? (
          <div className="card"><EmptyState icon={FileText} title="No forms assigned" message="Your admin hasn’t assigned a form to you in this group yet." /></div>
        ) : (
          <div className="grid cols-3">{forms.map((f) => <MyFormCard key={f.id} form={f} onPreview={() => setPreview(f.id)} />)}</div>
        )}
      </QueryView>
      {preview && <PreviewModal formId={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

function MyFormCard({ form: f, onPreview }) {
  const s = useSession();
  const ui = useUi();
  const nav = useNavigate();
  const qc = useQueryClient();
  const st = formState(f);
  const link = `${f.publicUrl}?s=${s.active?.salesmanCode}`;

  async function primary() {
    try {
      await api.setPrimary(f.id);
      ui.success(`“${f.name}” is now your primary form`);
      qc.invalidateQueries({ queryKey: ['forms', s.activeGroupId] });
      qc.invalidateQueries({ queryKey: ['home', s.activeGroupId] });
    } catch (e) { ui.error(e); }
  }

  return (
    <article className={`card form-card ${f.isPrimary ? 'primary' : ''}`}>
      <div className="fc-body">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="wrap-row" style={{ gap: 6 }}><Badge cls={st.cls} dot>{st.label}</Badge>{f.isPrimary && <Badge>Primary</Badge>}</div>
          <b className="small" style={{ color: 'var(--sky-700)' }}>{f.myLeadsCount} my leads</b>
        </div>
        <div className="fc-title">{f.name}</div>
        {f.eventName && <div className="muted small" style={{ marginTop: -6 }}>{f.eventName}</div>}
        <div className="fc-meta"><CalendarDays size={14} /><b style={{ color: 'var(--ink)' }}>{fmt.rangeShort(f.startDate, f.endDate)}</b>&nbsp;· {fmt.rangeLong(f.startDate, f.endDate)}</div>
      </div>
      <div className="fc-foot">
        <ToolButton icon={Star} tone="warn" label={f.isPrimary ? 'Primary form' : 'Set as primary'} onClick={f.isPrimary ? undefined : primary} disabled={f.isPrimary} />
        <ToolButton icon={Eye} label="Preview fields" onClick={onPreview} />
        <ToolButton icon={Link2} label="Copy my link" onClick={async () => { await copyText(link); ui.success('Your form link is copied'); }} />
        <ToolButton icon={QrCode} label="QR preview" onClick={() => nav(`/forms/${f.id}/qr`)} />
        <span className="grow" />
        <Button size="sm" icon={Plus} disabled={!f.isLive} onClick={() => nav(`/capture/${f.id}`)}>Lead</Button>
      </div>
    </article>
  );
}
