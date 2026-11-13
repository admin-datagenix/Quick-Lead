import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus } from 'lucide-react';
import { api } from '../../lib/api';
import { addDays, fmt, parseDateOnly, toDateOnly, today } from '../../lib/format';
import { Avatar, Badge, Button, EmptyState, Field, Modal, QueryView, useUi } from '../../components/ui';
import InviteModal from './InviteModal';

export function invalidateForms(qc, gid, fid) {
  qc.invalidateQueries({ queryKey: ['forms', gid] });
  qc.invalidateQueries({ queryKey: ['analytics', gid] });
  if (fid) {
    qc.invalidateQueries({ queryKey: ['form', fid] });
    qc.invalidateQueries({ queryKey: ['formAnalytics', fid] });
    qc.invalidateQueries({ queryKey: ['assignments', fid] });
  }
}

/** Extend a form's end date. */
export function ExtendModal({ form, groupId, onClose }) {
  const ui = useUi();
  const qc = useQueryClient();
  const start = parseDateOnly(form.startDate);
  const t = today();
  const min = toDateOnly(start > t ? start : t);
  const [end, setEnd] = useState(toDateOnly(new Date(Math.max(parseDateOnly(form.endDate), parseDateOnly(min)))));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const r = await api.extendForm(form.id, end);
      ui.success(r.message);
      invalidateForms(qc, groupId, form.id);
      onClose();
    } catch (e) { ui.error(e); setBusy(false); }
  }

  return (
    <Modal title="Extend form dates" subtitle={`${form.name} · currently ${fmt.rangeLong(form.startDate, form.endDate)}`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Extend</Button></>}>
      <Field label="New end date" htmlFor="ext-end" help="Assigned salesmen are notified.">
        <input id="ext-end" type="date" className="input" value={end} min={min} max={toDateOnly(addDays(start, 365))} onChange={(e) => setEnd(e.target.value)} />
      </Field>
      <div className="chips">
        {[1, 2, 3, 7].map((n) => (
          <button key={n} className="chip" onClick={() => setEnd(toDateOnly(addDays(parseDateOnly(form.endDate) < t ? t : parseDateOnly(form.endDate), n)))}>+{n} day{n > 1 ? 's' : ''}</button>
        ))}
      </div>
    </Modal>
  );
}

/** Assign salesmen to a form (multi-select) and unassign existing ones. */
export function AssignModal({ form, groupId, onClose }) {
  const ui = useUi();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['assignments', form.id], queryFn: () => api.assignments(form.id) });
  const [sel, setSel] = useState(new Set());
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviting, setInviting] = useState(false);

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function assign() {
    setBusy(true);
    try {
      const r = await api.assign(form.id, [...sel]);
      ui.success(r.message);
      setSel(new Set());
      invalidateForms(qc, groupId, form.id);
      qc.invalidateQueries({ queryKey: ['salesmen', groupId] });
    } catch (e) { ui.error(e); } finally { setBusy(false); }
  }

  async function unassign(a) {
    if (!(await ui.confirm({ title: `Unassign ${a.displayName}?`, message: `They will no longer capture leads for ${form.name}.`, confirmLabel: 'Unassign', destructive: true }))) return;
    try { await api.unassign(form.id, a.memberId); ui.success('Unassigned'); invalidateForms(qc, groupId, form.id); } catch (e) { ui.error(e); }
  }

  if (inviting) return <InviteModal groupId={groupId} formId={form.id} formName={form.name} onClose={() => setInviting(false)} />;

  return (
    <Modal wide title="Assign salesmen" subtitle={form.name} onClose={onClose}
      footer={<>
        <Button variant="secondary" icon={UserPlus} onClick={() => setInviting(true)}>Invite new</Button>
        <span className="grow" />
        <Button variant="secondary" onClick={onClose}>Done</Button>
        <Button disabled={!sel.size} loading={busy} onClick={assign}>Assign {sel.size || ''} {sel.size === 1 ? 'salesman' : 'salesmen'}</Button>
      </>}>
      <QueryView query={q}>
        {(items) => {
          if (!items.length) return <EmptyState icon={UserPlus} title="No salesmen in this group" message="Invite salesmen first. You can pre-assign this form with the invitation." />;
          const s = search.toLowerCase();
          const f = items.filter((a) => !s || a.displayName.toLowerCase().includes(s) || a.mobile.includes(s));
          const avail = f.filter((a) => !a.isAssigned);
          const assigned = f.filter((a) => a.isAssigned);
          return (
            <>
              <div className="search"><Search size={16} /><input className="input" placeholder="Search by name or mobile" aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              <div className="grid cols-2" style={{ alignItems: 'start' }}>
                <div className="stack" style={{ gap: 8 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <h3>Available ({avail.length})</h3>
                    {avail.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setSel(new Set(avail.every((a) => sel.has(a.memberId)) ? [] : avail.map((a) => a.memberId)))}>
                      {avail.every((a) => sel.has(a.memberId)) ? 'Clear' : 'Select all'}</button>}
                  </div>
                  {avail.length === 0 && <p className="muted small">Everyone is assigned.</p>}
                  {avail.map((a) => (
                    <label key={a.memberId} className="choice" style={{ padding: 10, borderColor: sel.has(a.memberId) ? 'var(--sky)' : undefined, background: sel.has(a.memberId) ? 'var(--sky-50)' : undefined }}>
                      <input type="checkbox" checked={sel.has(a.memberId)} onChange={() => toggle(a.memberId)} style={{ width: 18, height: 18, accentColor: '#0369A1' }} />
                      <Avatar name={a.displayName} size={32} />
                      <span className="grow"><b>{a.displayName}</b><span className="muted small" style={{ display: 'block' }}>{fmt.mobile(a.mobile)}{!a.isActive && ' · deactivated'}</span></span>
                    </label>
                  ))}
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  <h3>Assigned ({assigned.length})</h3>
                  {assigned.length === 0 && <p className="muted small">Nobody yet.</p>}
                  {assigned.map((a) => (
                    <div key={a.memberId} className="row card" style={{ padding: 10 }}>
                      <Avatar name={a.displayName} size={32} />
                      <span className="grow"><b>{a.displayName}</b><span className="muted small" style={{ display: 'block' }}>{a.leadsCount} leads{a.isPrimary && ' · primary form'}</span></span>
                      <Button variant="ghost" size="sm" style={{ color: 'var(--red)' }} onClick={() => unassign(a)}>Unassign</Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          );
        }}
      </QueryView>
    </Modal>
  );
}

/** Read-only list of a form's fields. */
export function PreviewModal({ formId, onClose }) {
  const q = useQuery({ queryKey: ['form', formId], queryFn: () => api.form(formId) });
  return (
    <Modal title="Form preview" onClose={onClose}>
      <QueryView query={q}>
        {(f) => (
          <div className="stack">
            <div><h2>{f.summary.name}</h2><p className="muted small">{f.companyName} · {fmt.rangeLong(f.summary.startDate, f.summary.endDate)}</p></div>
            {f.fields.map((x) => (
              <div key={x.id} className="card" style={{ padding: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <b>{x.label}{x.isRequired && <span style={{ color: 'var(--red)' }}> *</span>}</b>
                  <span className="muted small">{x.fieldType.replace(/([a-z])([A-Z])/g, '$1 $2')}{x.isSystem && ' · default'}</span>
                </div>
                {x.options.length > 0 && <div className="chips" style={{ marginTop: 8 }}>{x.options.map((o) => <Badge key={o} cls="b-draft">{o}</Badge>)}</div>}
              </div>
            ))}
          </div>
        )}
      </QueryView>
    </Modal>
  );
}
