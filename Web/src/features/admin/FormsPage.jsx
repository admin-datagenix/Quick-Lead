import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CopyPlus, Eye, FileText, Link2, MoreHorizontal, Pencil, Plus, QrCode, Send, Trash2, UserPlus } from 'lucide-react';
import { api } from '../../lib/api';
import { copyText, fmt, formState } from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { Badge, Button, EmptyState, QueryView, ToolButton, useUi } from '../../components/ui';
import { AssignModal, ExtendModal, PreviewModal, invalidateForms } from './formDialogs';

const FILTERS = ['All', 'Live', 'Upcoming', 'Expired', 'Draft'];

export default function FormsPage() {
  const { activeGroupId: gid } = useSession();
  const q = useQuery({ queryKey: ['forms', gid], queryFn: () => api.forms(gid) });
  const [filter, setFilter] = useState('All');
  const [dialog, setDialog] = useState(null);

  return (
    <>
      <div className="page-head">
        <div className="titles"><h1>Forms</h1><p className="sub">One form per event or exhibition. Assign salesmen and share its QR code.</p></div>
        <div className="actions"><Link className="btn btn-primary" to="/forms/new"><Plus size={17} />Create form</Link></div>
      </div>

      <QueryView query={q}>
        {(forms) => {
          if (!forms.length) {
            return <div className="card"><EmptyState icon={FileText} title="Create your first form"
              message="Start from a template or build your own. First name, last name, mobile and enquiry are included by default."
              action={<Link className="btn btn-primary" to="/forms/new"><Plus size={16} />Create form</Link>} /></div>;
          }
          const shown = forms.filter((f) => filter === 'All' || formState(f).label === filter);
          return (
            <>
              <div className="wrap-row">
                <div className="seg">{FILTERS.map((x) => {
                  const n = x === 'All' ? forms.length : forms.filter((f) => formState(f).label === x).length;
                  return <button key={x} className={filter === x ? 'on' : ''} onClick={() => setFilter(x)}>{x} <span className="muted">{n}</span></button>;
                })}</div>
              </div>
              <div className="grid cols-3">
                {shown.map((f) => <FormCard key={f.id} form={f} groupId={gid} onDialog={setDialog} />)}
              </div>
              {shown.length === 0 && <p className="muted">No {filter.toLowerCase()} forms.</p>}
            </>
          );
        }}
      </QueryView>

      {dialog?.type === 'extend' && <ExtendModal form={dialog.form} groupId={gid} onClose={() => setDialog(null)} />}
      {dialog?.type === 'assign' && <AssignModal form={dialog.form} groupId={gid} onClose={() => setDialog(null)} />}
      {dialog?.type === 'preview' && <PreviewModal formId={dialog.form.id} onClose={() => setDialog(null)} />}
    </>
  );
}

function FormCard({ form: f, groupId, onDialog }) {
  const ui = useUi();
  const nav = useNavigate();
  const qc = useQueryClient();
  const st = formState(f);

  async function run(action) {
    try {
      if (action === 'publish') { const r = await api.publishForm(f.id); ui.success(r.message); }
      if (action === 'duplicate') { await api.duplicateForm(f.id); ui.success('Form duplicated as draft'); }
      if (action === 'delete') {
        if (!(await ui.confirm({ title: 'Delete form?', message: `“${f.name}” will be removed. Leads already captured are kept.`, confirmLabel: 'Delete', destructive: true }))) return;
        await api.deleteForm(f.id); ui.success('Form deleted');
      }
      invalidateForms(qc, groupId, f.id);
    } catch (e) { ui.error(e); }
  }

  return (
    <article className="card form-card">
      <div className="fc-body">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Badge cls={st.cls} dot>{st.label}</Badge>
          <MoreMenu items={[
            { label: 'Preview fields', icon: Eye, onClick: () => onDialog({ type: 'preview', form: f }) },
            f.status === 'Draft' && { label: 'Publish', icon: Send, onClick: () => run('publish') },
            { label: 'Extend dates', icon: CalendarClock, onClick: () => onDialog({ type: 'extend', form: f }) },
            { label: 'Duplicate', icon: CopyPlus, onClick: () => run('duplicate') },
            { label: 'Delete', icon: Trash2, danger: true, onClick: () => run('delete') },
          ].filter(Boolean)} />
        </div>
        <Link to={`/forms/${f.id}`} className="fc-title" style={{ color: 'var(--ink)', textDecoration: 'none' }}>{f.name}</Link>
        {f.eventName && <div className="muted small" style={{ marginTop: -6 }}>{f.eventName}</div>}
        <button className="fc-meta" style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => onDialog({ type: 'extend', form: f })}>
          <CalendarClock size={14} /><b style={{ color: 'var(--ink)' }}>{fmt.rangeShort(f.startDate, f.endDate)}</b>&nbsp;({fmt.rangeLong(f.startDate, f.endDate)})
          <span style={{ color: 'var(--sky-700)', fontWeight: 700, marginLeft: 4 }}>Extend</span>
        </button>
        <div className="fc-stats">
          <div className="fc-stat"><b>{fmt.num(f.leadsCount)}</b><span>Leads</span></div>
          <div className="fc-stat"><b>{f.salesmenCount}</b><span>Salesmen</span></div>
          <div className="fc-stat"><b>{f.fieldsCount}</b><span>Fields</span></div>
        </div>
      </div>
      <div className="fc-foot">
        <ToolButton icon={Pencil} label="Edit" onClick={() => nav(`/forms/${f.id}/edit`)} />
        <ToolButton icon={Link2} label="Copy link" onClick={async () => { await copyText(f.publicUrl); ui.success('Form link copied'); }} />
        <ToolButton icon={QrCode} label="QR preview" onClick={() => nav(`/forms/${f.id}/qr`)} />
        <span className="grow" />
        <Button size="sm" icon={UserPlus} onClick={() => onDialog({ type: 'assign', form: f })}>Assign</Button>
      </div>
    </article>
  );
}

export function MoreMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" style={{ width: 34, height: 34, border: 0 }} aria-label="More actions" aria-expanded={open} onClick={() => setOpen(!open)}><MoreHorizontal size={18} /></button>
      {open && (
        <div className="card" role="menu" style={{ position: 'absolute', right: 0, top: 38, zIndex: 20, minWidth: 190, padding: 6, boxShadow: 'var(--shadow-lg)' }}>
          {items.map((it) => (
            <button key={it.label} role="menuitem" className="btn btn-ghost btn-sm btn-block" style={{ justifyContent: 'flex-start', color: it.danger ? 'var(--red)' : 'var(--ink)', height: 36 }}
              onClick={() => { setOpen(false); it.onClick(); }}>
              <it.icon size={15} />{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
