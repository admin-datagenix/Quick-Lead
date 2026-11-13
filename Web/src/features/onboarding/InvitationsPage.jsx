import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, FileText, MailOpen, User } from 'lucide-react';
import { api } from '../../lib/api';
import { fmt } from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { Avatar, Button, EmptyState, Field, Modal, QueryView, useUi } from '../../components/ui';

export default function InvitationsPage({ standalone }) {
  const s = useSession();
  const nav = useNavigate();
  const ui = useUi();
  const qc = useQueryClient();
  const inbox = useQuery({ queryKey: ['inbox'], queryFn: api.inbox });
  const [accepting, setAccepting] = useState(null);

  async function decline(inv) {
    const ok = await ui.confirm({ title: 'Decline invitation?', message: `You will not join ${inv.groupName}.`, confirmLabel: 'Decline', destructive: true });
    if (!ok) return;
    try {
      await api.declineInvitation(inv.id);
      ui.success('Invitation declined');
      qc.invalidateQueries({ queryKey: ['inbox'] });
      s.refresh();
    } catch (e) { ui.error(e); }
  }

  const body = (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div className="titles">
          {standalone && <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start', marginLeft: -10 }} onClick={() => nav('/')}><ArrowLeft size={15} />Back</button>}
          <h1>Invitations</h1>
          <p className="sub">Accept an invitation to join a company group as a salesman.</p>
        </div>
      </div>
      <QueryView query={inbox}>
        {(items) => items.length === 0 ? (
          <div className="card"><EmptyState icon={MailOpen} title="No invitations yet" message={`When an admin invites ${fmt.mobile(s.user?.mobile)}, the invitation will appear here.`} /></div>
        ) : (
          <div className="grid cols-2">
            {items.map((inv) => (
              <div key={inv.id} className="card card-pad stack" style={{ gap: 14 }}>
                <div className="row"><Avatar name={inv.companyName} size={44} /><div className="grow"><h2 className="truncate">{inv.groupName}</h2><p className="muted small">{inv.companyName}</p></div></div>
                <div className="stack" style={{ gap: 6, background: 'var(--sky-50)', borderRadius: 10, padding: 12, fontSize: 13.5 }}>
                  <span className="row" style={{ gap: 8 }}><User size={15} color="#0369A1" />Invited by {inv.invitedByName || fmt.mobile(inv.invitedByMobile)}</span>
                  {inv.formName && <span className="row" style={{ gap: 8 }}><FileText size={15} color="#0369A1" />Form: {inv.formName}</span>}
                  <span className="muted small">{fmt.relative(inv.createdAt)}</span>
                </div>
                <div className="grid cols-2" style={{ gap: 10 }}>
                  <Button variant="danger" onClick={() => decline(inv)}>Decline</Button>
                  <Button icon={Check} onClick={() => setAccepting(inv)}>Accept</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </QueryView>
      {accepting && <AcceptModal inv={accepting} onClose={() => setAccepting(null)} />}
    </div>
  );

  return standalone ? <div style={{ minHeight: '100vh', padding: 24, maxWidth: 980, margin: '0 auto' }}>{body}</div> : body;
}

function AcceptModal({ inv, onClose }) {
  const s = useSession();
  const ui = useUi();
  const nav = useNavigate();
  const [name, setName] = useState(s.user?.fullName || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function accept(e) {
    e.preventDefault();
    if (name.trim().length < 2) { setError('Please enter your name.'); return; }
    setBusy(true);
    try {
      const r = await api.acceptInvitation(inv.id, name.trim());
      ui.success(r.message);
      onClose();
      await s.enterGroup(r.data.groupId);
      nav('/');
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <Modal title={`Join ${inv.groupName}`} subtitle="Your name is shown to the admin and printed on your QR page." onClose={onClose}>
      <form onSubmit={accept} className="stack" style={{ gap: 16 }}>
        <Field label="Your full name" required htmlFor="acc-name" error={error}>
          <input id="acc-name" className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button type="submit" block loading={busy}>Accept &amp; join</Button>
      </form>
    </Modal>
  );
}
