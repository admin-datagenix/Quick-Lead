import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Pencil } from 'lucide-react';
import { api } from '../../lib/api';
import { fmt, validators } from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { Avatar, Button, Field, Loader, Modal, QueryView, useUi } from '../../components/ui';

/* ------------------------------------------------------------------ validation (mirrors the API) */
export function validateField(f, raw) {
  const v = (raw ?? '').trim();
  if (!v) return f.isRequired ? `${f.label} is required.` : null;
  const type = f.key === 'mobile' ? 'Phone' : f.fieldType;
  switch (type) {
    case 'ShortText': return v.length > 200 ? 'Maximum 200 characters.' : null;
    case 'LongText': return v.length > 2000 ? 'Maximum 2000 characters.' : null;
    case 'Email': return validators.isEmail(v) ? null : 'Enter a valid email.';
    case 'Phone': return validators.isMobile(v) ? null : 'Enter a valid 10-digit mobile number.';
    case 'Number': return validators.isNumber(v) ? null : 'Enter a number.';
    case 'Dropdown': return f.options.includes(v) ? null : 'Select an option.';
    case 'Date': return /^\d{4}-\d{2}-\d{2}$/.test(v) ? null : 'Select a date.';
    default: return null;
  }
}

export function displayValue(f, v) {
  if (!v || !v.trim()) return '—';
  if (f.fieldType === 'Date') return fmt.dateNum(v);
  if (f.key === 'mobile' || f.fieldType === 'Phone') return fmt.mobile(validators.normalizeMobile(v));
  return v;
}

export function FieldInput({ field: f, value, onChange, error, autoFocus }) {
  const id = `fld-${f.key}`;
  const type = f.key === 'mobile' ? 'Phone' : f.fieldType;
  const cls = `input ${error ? 'invalid' : ''}`;
  let control;
  switch (type) {
    case 'LongText':
      control = <textarea id={id} className={`textarea ${error ? 'invalid' : ''}`} maxLength={2000} placeholder={f.placeholder || ''} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'Dropdown':
      control = (
        <select id={id} className={`select ${error ? 'invalid' : ''}`} value={value || ''} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus}>
          <option value="">Select…</option>
          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
      break;
    case 'Phone':
      control = (
        <div className="input-group"><span className="addon">+91</span>
          <input id={id} className={cls} inputMode="numeric" maxLength={10} autoFocus={autoFocus} value={value || ''} onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))} /></div>
      );
      break;
    case 'Date':
      control = <input id={id} type="date" className={cls} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
      break;
    default:
      control = (
        <input id={id} className={cls} autoFocus={autoFocus} maxLength={200} placeholder={f.placeholder || ''}
          type={type === 'Email' ? 'email' : 'text'} inputMode={type === 'Number' ? 'decimal' : undefined}
          autoComplete={f.key === 'first_name' ? 'given-name' : f.key === 'last_name' ? 'family-name' : 'off'}
          value={value || ''} onChange={(e) => onChange(e.target.value)} />
      );
  }
  return <Field label={f.label} required={f.isRequired} htmlFor={id} error={error}>{control}</Field>;
}

/* ------------------------------------------------------------------ page */
export default function CaptureLeadPage() {
  const { formId } = useParams();
  const { activeGroupId: gid } = useSession();
  const nav = useNavigate();
  const ui = useUi();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['form', formId], queryFn: () => api.form(formId) });

  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState('fill');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const clientRef = useRef(crypto.randomUUID ? crypto.randomUUID() : null);
  const capturedAt = useRef(null);

  const set = (k) => (v) => { setAnswers((a) => ({ ...a, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  function validateAll(fields) {
    const errs = {};
    fields.forEach((f) => { const e = validateField(f, answers[f.key]); if (e) errs[f.key] = e; });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function save(form) {
    if (!validateAll(form.fields)) { setStep('fill'); ui.info('Please correct the highlighted fields.'); return; }
    setSaving(true);
    const clean = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, (v || '').trim()]).filter(([, v]) => v));
    try {
      const r = await api.captureLead(gid, {
        formId, answers: clean, clientRefId: clientRef.current,
        capturedAt: (capturedAt.current || new Date()).toISOString(),
      });
      qc.invalidateQueries({ queryKey: ['home', gid] });
      qc.invalidateQueries({ queryKey: ['forms', gid] });
      qc.invalidateQueries({ queryKey: ['myLeads', gid] });
      ui.success(r.data.isDuplicate ? 'Lead captured · this mobile number was captured before' : 'Lead captured');
      nav('/');
    } catch (e) {
      setErrors(Object.fromEntries(Object.entries(e.errors || {}).map(([k, m]) => [k, m[0]])));
      if (Object.keys(e.errors || {}).length) setStep('fill');
      ui.error(e);
      setSaving(false);
    }
  }

  return (
    <QueryView query={q} loading={<Loader />}>
      {(form) => {
        const s = form.summary;
        const sys = form.fields.filter((f) => f.isSystem);
        const other = form.fields.filter((f) => !f.isSystem);
        const name = `${answers.first_name || ''} ${answers.last_name || ''}`.trim();

        return (
          <div style={{ maxWidth: 820, width: '100%', margin: '0 auto', display: 'grid', gap: 18 }}>
            <div className="page-head">
              <div className="titles">
                <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start', marginLeft: -10 }} onClick={() => (step === 'confirm' ? setStep('fill') : nav(-1))}><ArrowLeft size={15} />Back</button>
                <h1>{step === 'fill' ? 'Add lead' : 'Confirm lead details'}</h1>
                <p className="sub">{s.name} · {form.companyName} · {fmt.rangeShort(s.startDate, s.endDate)}</p>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span className="step-dot" style={{ background: 'var(--sky-700)' }}>1</span><span className="small">Details</span>
                <span style={{ width: 24, height: 2, background: step === 'confirm' ? 'var(--sky-700)' : 'var(--line-strong)' }} />
                <span className="step-dot" style={{ background: step === 'confirm' ? 'var(--sky-700)' : 'var(--line-strong)' }}>2</span><span className="small">Confirm</span>
              </div>
            </div>

            {!s.isLive && <div className="banner danger">This form is not live today. Leads cannot be captured.</div>}

            {step === 'fill' ? (
              <form className="stack" style={{ gap: 16 }} noValidate onSubmit={(e) => {
                e.preventDefault();
                if (validateAll(form.fields)) { capturedAt.current = capturedAt.current || new Date(); setStep('confirm'); }
              }}>
                <section className="card">
                  <div className="card-head"><span className="step-dot">1</span><h2>Lead details</h2><span className="hint">Required</span></div>
                  <div className="card-body grid cols-2" style={{ gap: 14 }}>
                    {sys.map((f, i) => <FieldInput key={f.key} field={f} value={answers[f.key]} onChange={set(f.key)} error={errors[f.key]} autoFocus={i === 0} />)}
                  </div>
                </section>
                {other.length > 0 && (
                  <section className="card">
                    <div className="card-head"><span className="step-dot">2</span><h2>Other details</h2><span className="hint">Set by your admin</span></div>
                    <div className="card-body grid cols-2" style={{ gap: 14 }}>
                      {other.map((f) => <div key={f.key} style={f.fieldType === 'LongText' ? { gridColumn: '1 / -1' } : undefined}><FieldInput field={f} value={answers[f.key]} onChange={set(f.key)} error={errors[f.key]} /></div>)}
                    </div>
                  </section>
                )}
                <div className="row" style={{ justifyContent: 'flex-end' }}><Button type="submit" size="lg" disabled={!s.isLive}>Capture lead <ArrowRight size={17} /></Button></div>
              </form>
            ) : (
              <>
                <div className="card card-pad row" style={{ background: 'var(--sky-50)', borderColor: 'var(--sky-100)' }}>
                  <Avatar name={name || '?'} size={52} />
                  <div><h2>{name || 'New lead'}</h2><p className="muted small">Review the details. Use the pencil to correct any field.</p></div>
                </div>
                <section className="card">
                  {form.fields.map((f) => (
                    <div key={f.key} className="row" style={{ padding: '10px 12px 10px 20px', borderBottom: '1px solid var(--line)' }}>
                      <div className="grow">
                        <div className="muted small">{f.label}</div>
                        <div style={{ fontWeight: 500, color: errors[f.key] ? 'var(--red)' : 'var(--ink)' }}>{errors[f.key] || displayValue(f, answers[f.key])}</div>
                      </div>
                      <button className="tool-btn" aria-label={`Edit ${f.label}`} onClick={() => setEditing(f)}><Pencil size={16} /></button>
                    </div>
                  ))}
                </section>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <Button variant="secondary" size="lg" onClick={() => setStep('fill')}>Back</Button>
                  <Button size="lg" icon={Check} loading={saving} onClick={() => save(form)}>Confirm &amp; save</Button>
                </div>
              </>
            )}

            {editing && <EditFieldModal field={editing} value={answers[editing.key]} onClose={() => setEditing(null)} onSave={(v) => { set(editing.key)(v); setEditing(null); }} />}
          </div>
        );
      }}
    </QueryView>
  );
}

function EditFieldModal({ field, value, onSave, onClose }) {
  const [v, setV] = useState(value || '');
  const [err, setErr] = useState(null);
  const submit = () => { const e = validateField(field, v); if (e) { setErr(e); return; } onSave(v.trim()); };
  const inner = useMemo(() => field, [field]);
  return (
    <Modal title={`Edit ${field.label}`} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Update</Button></>}>
      <FieldInput field={inner} value={v} onChange={(x) => { setV(x); setErr(null); }} error={err} autoFocus />
    </Modal>
  );
}
