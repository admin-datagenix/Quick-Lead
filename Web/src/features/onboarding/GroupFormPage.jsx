import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../lib/api';
import { validators } from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { Button, Field, Loader, useUi } from '../../components/ui';

const EMPTY = { name: '', companyName: '', contactPerson: '', contactMobile: '', contactEmail: '', website: '', address: '', whatsAppTemplate: '' };

/** Create a new group, or (edit) the active group's settings. */
export default function GroupFormPage({ edit, standalone }) {
  const s = useSession();
  const ui = useUi();
  const nav = useNavigate();
  const qc = useQueryClient();
  const group = useQuery({ queryKey: ['group', s.activeGroupId], queryFn: () => api.group(s.activeGroupId), enabled: !!edit });
  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (edit && group.data) {
      const g = group.data;
      setV({
        name: g.name, companyName: g.companyName, contactPerson: g.contactPerson || '', contactMobile: g.contactMobile || '',
        contactEmail: g.contactEmail || '', website: g.website || '', address: g.address || '', whatsAppTemplate: g.whatsAppTemplate || '',
      });
    } else if (!edit) {
      setV({ ...EMPTY, contactPerson: s.user?.fullName || '', contactMobile: s.user?.mobile || '' });
    }
  }, [edit, group.data, s.user]);

  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!v.name.trim()) errs.name = 'Group name is required.';
    if (!v.companyName.trim()) errs.companyName = 'Company name is required.';
    if (v.contactMobile && !validators.isMobile(v.contactMobile)) errs.contactMobile = 'Enter a valid 10-digit mobile.';
    if (v.contactEmail && !validators.isEmail(v.contactEmail)) errs.contactEmail = 'Enter a valid email.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    const body = { ...v, description: null };
    try {
      if (edit) {
        const r = await api.updateGroup(s.activeGroupId, body);
        ui.success(r.message);
        qc.invalidateQueries({ queryKey: ['group', s.activeGroupId] });
        await s.refresh();
      } else {
        const r = await api.createGroup(body);
        ui.success(`Group “${r.data.name}” created`);
        await s.enterGroup(r.data.id);
        nav('/');
      }
    } catch (err) {
      setErrors(Object.fromEntries(Object.entries(err.errors || {}).map(([k, m]) => [k, m[0]])));
      ui.error(err);
    } finally { setBusy(false); }
  }

  if (edit && group.isLoading) return <Loader />;

  const content = (
    <form onSubmit={submit} className="stack" style={{ gap: 20 }} noValidate>
      <div className="page-head">
        <div className="titles">
          {!edit && <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start', marginLeft: -10 }} onClick={() => nav(-1)}><ArrowLeft size={15} />Back</button>}
          <h1>{edit ? 'Group settings' : 'Create a group'}</h1>
          <p className="sub">Company details are printed on your QR pages and used in WhatsApp follow-ups.</p>
        </div>
        <div className="actions"><Button type="submit" loading={busy}>{edit ? 'Save changes' : 'Create group'}</Button></div>
      </div>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head"><h2>Basic info</h2></div>
          <div className="card-body stack" style={{ gap: 14 }}>
            <Field label="Group name" required htmlFor="g-name" error={errors.name} help="e.g. Pune Expo Sales Team">
              <input id="g-name" className={`input ${errors.name ? 'invalid' : ''}`} value={v.name} onChange={set('name')} />
            </Field>
            <Field label="Company name" required htmlFor="g-co" error={errors.companyName}>
              <input id="g-co" className={`input ${errors.companyName ? 'invalid' : ''}`} value={v.companyName} onChange={set('companyName')} />
            </Field>
            <Field label="Address" htmlFor="g-addr"><textarea id="g-addr" className="textarea" rows={3} value={v.address} onChange={set('address')} /></Field>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Contact on QR print</h2></div>
          <div className="card-body stack" style={{ gap: 14 }}>
            <Field label="Contact person" htmlFor="g-cp"><input id="g-cp" className="input" value={v.contactPerson} onChange={set('contactPerson')} /></Field>
            <Field label="Contact mobile" htmlFor="g-cm" error={errors.contactMobile}>
              <input id="g-cm" className={`input ${errors.contactMobile ? 'invalid' : ''}`} inputMode="numeric" maxLength={10} value={v.contactMobile} onChange={(e) => setV({ ...v, contactMobile: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <Field label="Contact email" htmlFor="g-ce" error={errors.contactEmail}><input id="g-ce" type="email" className={`input ${errors.contactEmail ? 'invalid' : ''}`} value={v.contactEmail} onChange={set('contactEmail')} /></Field>
            <Field label="Website" htmlFor="g-web"><input id="g-web" className="input" value={v.website} onChange={set('website')} /></Field>
          </div>
        </div>
        {edit && (
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-head"><h2>WhatsApp follow-up template</h2><span className="hint">Used by the WhatsApp button on lead details</span></div>
            <div className="card-body">
              <Field htmlFor="g-wa" help="Placeholders: {name} {fullname} {company} {form} {event} {enquiry} {salesman}">
                <textarea id="g-wa" className="textarea" rows={4} maxLength={1000} value={v.whatsAppTemplate} onChange={set('whatsAppTemplate')} />
              </Field>
            </div>
          </div>
        )}
      </div>
    </form>
  );

  return standalone ? <div style={{ minHeight: '100vh', padding: 24, maxWidth: 1080, margin: '0 auto' }}>{content}</div> : content;
}
