import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowUp, Lock, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { addDays, fmt, parseDateOnly, toDateOnly, today } from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { Badge, Button, Field, Loader, Modal, Switch, ToolButton, useUi } from '../../components/ui';
import { invalidateForms } from './formDialogs';

const TYPES = [
  ['ShortText', 'Short text'], ['LongText', 'Long text'], ['Email', 'Email'], ['Number', 'Number'],
  ['Dropdown', 'Dropdown'], ['Date', 'Date'], ['Phone', 'Phone'],
];
const typeLabel = (t) => TYPES.find((x) => x[0] === t)?.[1] || t;

export default function FormBuilderPage() {
  const { formId } = useParams();
  const editing = !!formId;
  const { activeGroupId: gid } = useSession();
  const nav = useNavigate();
  const ui = useUi();
  const qc = useQueryClient();

  const templates = useQuery({ queryKey: ['templates'], queryFn: api.templates, enabled: !editing, staleTime: Infinity });
  const existing = useQuery({ queryKey: ['form', formId], queryFn: () => api.form(formId), enabled: editing });

  const [name, setName] = useState('');
  const [eventName, setEventName] = useState('');
  const [start, setStart] = useState(toDateOnly(today()));
  const [end, setEnd] = useState(toDateOnly(addDays(today(), 3))); // 4 days inclusive
  const [enquiry, setEnquiry] = useState([]);
  const [optInput, setOptInput] = useState('');
  const [fields, setFields] = useState([]);
  const [published, setPublished] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(null);
  const [editor, setEditor] = useState(null); // { index, draft }

  useEffect(() => {
    const f = existing.data;
    if (!f) return;
    setName(f.summary.name);
    setEventName(f.summary.eventName || '');
    setStart(f.summary.startDate);
    setEnd(f.summary.endDate);
    setEnquiry(f.enquiryOptions);
    setFields(f.fields.filter((x) => !x.isSystem).map((x) => ({ id: x.id, label: x.label, fieldType: x.fieldType, isRequired: x.isRequired, placeholder: x.placeholder, options: x.options })));
    setPublished(f.summary.status !== 'Draft');
  }, [existing.data]);

  function applyTemplate(t) {
    if (!name.trim()) setName(t.name);
    setEnquiry(t.enquiryOptions);
    setFields(t.fields.map((f) => ({ ...f, id: null, options: f.options || [] })));
    ui.info(`Template “${t.name}” applied`);
  }

  function addOption() {
    const v = optInput.trim();
    if (!v) return;
    if (!enquiry.some((e) => e.toLowerCase() === v.toLowerCase())) setEnquiry([...enquiry, v]);
    setOptInput('');
    setErrors({ ...errors, enquiry: undefined });
  }

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    setFields(next);
  }

  async function save(publish) {
    const errs = {};
    if (!name.trim()) errs.name = 'Form name is required.';
    if (!enquiry.length) errs.enquiry = 'Add at least one option for “Enquiry about”.';
    if (end < start) errs.end = 'End date cannot be before the start date.';
    setErrors(errs);
    if (Object.keys(errs).length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }

    setBusy(publish ? 'publish' : 'draft');
    const body = {
      name: name.trim(), eventName: eventName.trim() || null, description: null, startDate: start, endDate: end,
      enquiryOptions: enquiry,
      fields: fields.map((f) => ({ id: f.id || null, label: f.label, fieldType: f.fieldType, isRequired: f.isRequired, placeholder: f.placeholder || null, options: f.fieldType === 'Dropdown' ? f.options : null })),
      publish,
    };
    try {
      const r = editing ? await api.updateForm(formId, body) : await api.createForm(gid, body);
      ui.success(r.message);
      invalidateForms(qc, gid, r.data.summary.id);
      nav(`/forms/${r.data.summary.id}`);
    } catch (e) {
      if (e.field('enquiryOptions')) setErrors({ enquiry: e.field('enquiryOptions') });
      ui.error(e);
    } finally { setBusy(null); }
  }

  if (editing && existing.isLoading) return <Loader />;
  const days = Math.round((parseDateOnly(end) - parseDateOnly(start)) / 86400000) + 1;

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start', marginLeft: -10 }} onClick={() => nav(-1)}><ArrowLeft size={15} />Back</button>
          <h1>{editing ? 'Edit form' : 'Create form'}</h1>
          <p className="sub">First name, last name, mobile number and enquiry are always included and required.</p>
        </div>
        <div className="actions">
          {published ? (
            <Button loading={busy === 'publish'} onClick={() => save(true)}>Save changes</Button>
          ) : (
            <>
              <Button variant="secondary" loading={busy === 'draft'} onClick={() => save(false)}>Save draft</Button>
              <Button loading={busy === 'publish'} onClick={() => save(true)}>Publish</Button>
            </>
          )}
        </div>
      </div>

      {!editing && templates.data?.length > 0 && (
        <section className="grid cols-2">
          {templates.data.slice(0, 2).map((t) => (
            <div key={t.key} className="card card-pad row" style={{ background: 'var(--sky-50)', borderColor: 'var(--sky-100)' }}>
              <span className="kpi-ic" style={{ background: 'var(--surface)', color: 'var(--sky-700)' }}><Sparkles size={18} /></span>
              <div className="grow"><b>{t.name}</b><div className="muted small">{t.description} · {4 + t.fields.length} fields</div></div>
              <Button size="sm" onClick={() => applyTemplate(t)}>Use</Button>
            </div>
          ))}
        </section>
      )}

      <div className="dash-grid" style={{ alignItems: 'start' }}>
        <div className="span-7 stack" style={{ gap: 16 }}>
          <section className="card">
            <div className="card-head"><h2>Form details</h2></div>
            <div className="card-body stack" style={{ gap: 14 }}>
              <Field label="Form name" required htmlFor="f-name" error={errors.name}>
                <input id="f-name" className={`input ${errors.name ? 'invalid' : ''}`} placeholder="e.g. Auto Expo 2026 Enquiry" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Event / exhibition" htmlFor="f-event" help="Shown on the QR print and the visitor form.">
                <input id="f-event" className="input" placeholder="e.g. Pragati Maidan, Hall 4" value={eventName} onChange={(e) => setEventName(e.target.value)} />
              </Field>
              <div className="grid cols-2" style={{ gap: 12 }}>
                <Field label="Start date" htmlFor="f-start"><input id="f-start" type="date" className="input" value={start} onChange={(e) => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value); }} /></Field>
                <Field label="End date" htmlFor="f-end" error={errors.end}><input id="f-end" type="date" className="input" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></Field>
              </div>
              <p className="muted small">Runs {days} day{days === 1 ? '' : 's'} · {fmt.rangeLong(start, end)}. Leads are accepted only on these dates.</p>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2>Additional fields</h2><span className="hint">{fields.length ? 'Use the arrows to reorder' : 'Optional questions for the visitor'}</span>
              <div className="right"><Button size="sm" icon={Plus} onClick={() => setEditor({ index: null, draft: { label: '', fieldType: 'ShortText', isRequired: false, placeholder: '', options: [] } })}>Add field</Button></div>
            </div>
            <div className="card-body stack" style={{ gap: 8 }}>
              {fields.length === 0 && <p className="muted">No additional fields. Add company, email, city or anything else you need.</p>}
              {fields.map((f, i) => (
                <div key={i} className="row card" style={{ padding: '8px 10px' }}>
                  <div className="stack" style={{ gap: 2 }}>
                    <button className="btn btn-ghost btn-sm btn-icon" style={{ height: 22 }} aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
                    <button className="btn btn-ghost btn-sm btn-icon" style={{ height: 22 }} aria-label="Move down" disabled={i === fields.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
                  </div>
                  <div className="grow">
                    <b>{f.label}</b>{f.isRequired && <span style={{ color: 'var(--red)' }}> *</span>}
                    <div className="muted small">{typeLabel(f.fieldType)}{f.fieldType === 'Dropdown' && ` · ${f.options.length} options`}</div>
                  </div>
                  <ToolButton icon={Pencil} label="Edit field" onClick={() => setEditor({ index: i, draft: { ...f, options: [...f.options] } })} />
                  <ToolButton icon={Trash2} tone="danger" label="Delete field" onClick={() => setFields(fields.filter((_, k) => k !== i))} />
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="span-5 stack" style={{ gap: 16 }}>
          <section className="card">
            <div className="card-head"><h2>Default fields</h2><span className="hint">Always required</span></div>
            <div className="card-body stack" style={{ gap: 8 }}>
              {[['First name', 'Short text'], ['Last name', 'Short text'], ['Mobile number', 'Phone'], ['Enquiry about', 'Dropdown']].map(([l, t]) => (
                <div key={l} className="row" style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '9px 12px' }}>
                  <b className="grow">{l}</b><span className="muted small">{t}</span><Lock size={14} color="#8FA3B5" />
                </div>
              ))}
              <div className="divider" style={{ margin: '6px 0' }} />
              <Field label="“Enquiry about” options" error={errors.enquiry}>
                <div className="row" style={{ gap: 8 }}>
                  <input className={`input ${errors.enquiry ? 'invalid' : ''}`} placeholder="Add an option, e.g. Pricing" aria-label="New option" value={optInput}
                    onChange={(e) => setOptInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }} />
                  <Button variant="secondary" icon={Plus} onClick={addOption}>Add</Button>
                </div>
              </Field>
              <div className="chips">
                {enquiry.map((o) => <span key={o} className="chip on">{o}<button className="x" aria-label={`Remove ${o}`} onClick={() => setEnquiry(enquiry.filter((x) => x !== o))}>×</button></span>)}
              </div>
            </div>
          </section>

          <section className="card card-pad stack" style={{ gap: 8, background: 'var(--sky-50)', borderColor: 'var(--sky-100)' }}>
            <b>What happens next</b>
            <p className="muted small">After publishing, assign salesmen to this form. Each salesman gets a personal QR code that credits every visitor scan to them.</p>
            {editing && <Badge cls={published ? 'b-live' : 'b-draft'} dot>{published ? 'Published' : 'Draft'}</Badge>}
          </section>
        </div>
      </div>

      {editor && (
        <FieldEditor
          draft={editor.draft}
          isNew={editor.index === null}
          onClose={() => setEditor(null)}
          onSave={(d) => {
            setFields(editor.index === null ? [...fields, d] : fields.map((f, i) => (i === editor.index ? d : f)));
            setEditor(null);
          }}
        />
      )}
    </>
  );
}

function FieldEditor({ draft, isNew, onSave, onClose }) {
  const [d, setD] = useState(draft);
  const [opt, setOpt] = useState('');
  const [err, setErr] = useState({});

  const addOpt = () => {
    const v = opt.trim();
    if (v && !d.options.includes(v)) setD({ ...d, options: [...d.options, v] });
    setOpt('');
  };

  function submit() {
    const e = {};
    if (!d.label.trim()) e.label = 'Enter a field name.';
    const options = opt.trim() && !d.options.includes(opt.trim()) ? [...d.options, opt.trim()] : d.options;
    if (d.fieldType === 'Dropdown' && !options.length) e.options = 'Add at least one option.';
    setErr(e);
    if (Object.keys(e).length) return;
    onSave({ ...d, label: d.label.trim(), options });
  }

  return (
    <Modal title={isNew ? 'Add field' : 'Edit field'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>{isNew ? 'Add field' : 'Update'}</Button></>}>
      <Field label="Field name" required htmlFor="fe-label" error={err.label}>
        <input id="fe-label" className="input" autoFocus placeholder="e.g. Company name" value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} />
      </Field>
      <Field label="Field type">
        <div className="chips">{TYPES.map(([v, l]) => <button key={v} type="button" className={`chip ${d.fieldType === v ? 'on' : ''}`} onClick={() => setD({ ...d, fieldType: v })}>{l}</button>)}</div>
      </Field>
      {d.fieldType === 'Dropdown' && (
        <Field label="Options" error={err.options}>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" placeholder="Add option" aria-label="New option" value={opt} onChange={(e) => setOpt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOpt(); } }} />
            <Button variant="secondary" icon={Plus} onClick={addOpt}>Add</Button>
          </div>
          <div className="chips" style={{ marginTop: 6 }}>{d.options.map((o) => <span key={o} className="chip on">{o}<button className="x" aria-label={`Remove ${o}`} onClick={() => setD({ ...d, options: d.options.filter((x) => x !== o) })}>×</button></span>)}</div>
        </Field>
      )}
      {['ShortText', 'LongText', 'Email', 'Number'].includes(d.fieldType) && (
        <Field label="Placeholder" htmlFor="fe-ph" help="Optional hint shown inside the input.">
          <input id="fe-ph" className="input" value={d.placeholder || ''} onChange={(e) => setD({ ...d, placeholder: e.target.value })} />
        </Field>
      )}
      <div className="row card" style={{ padding: 12 }}>
        <div className="grow"><b>Required field</b><div className="muted small">Visitors must fill this before submitting.</div></div>
        <Switch checked={d.isRequired} onChange={(v) => setD({ ...d, isRequired: v })} label="Required field" />
      </div>
    </Modal>
  );
}
