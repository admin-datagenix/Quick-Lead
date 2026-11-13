import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, LogOut, Repeat } from 'lucide-react';
import { api } from '../../lib/api';
import { fmt } from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { Avatar, Badge, Button, Field, useUi } from '../../components/ui';

export default function ProfilePage() {
  const s = useSession();
  const ui = useUi();
  const [name, setName] = useState(s.user?.fullName || '');
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    if (name.trim().length < 2) { ui.info('Enter your name.'); return; }
    setBusy(true);
    try { const u = await api.updateMe(name.trim()); s.updateUser(u.data); ui.success('Name updated'); } catch (err) { ui.error(err); } finally { setBusy(false); }
  }

  async function logout() {
    if (await ui.confirm({ title: 'Log out?', message: 'You can log in again with your mobile number.', confirmLabel: 'Log out', destructive: true })) s.logout();
  }

  return (
    <>
      <div className="page-head"><div className="titles"><h1>Profile</h1></div></div>
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <section className="card card-pad stack" style={{ gap: 18 }}>
          <div className="row"><Avatar name={s.user?.fullName || s.user?.mobile} size={64} /><div><h2 style={{ fontSize: 20 }}>{s.user?.fullName || 'Add your name'}</h2>
            <span className="muted">{s.isAdmin ? `Admin · ${s.active?.groupName}` : `Salesman · ID ${s.active?.salesmanCode}`}</span></div></div>
          <form onSubmit={save} className="stack">
            <Field label="Full name" htmlFor="p-name"><input id="p-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Mobile number">
              <div className="row input" style={{ background: 'var(--surface-2)' }}><span className="num grow">{fmt.mobile(s.user?.mobile)}</span><BadgeCheck size={18} color="#15803D" /></div>
            </Field>
            <div><Button type="submit" loading={busy}>Save</Button></div>
          </form>
        </section>
        <section className="card">
          <div className="card-head"><h2>Your groups</h2><div className="right"><Button variant="secondary" size="sm" icon={Repeat} onClick={s.openChooser}>Create or join</Button></div></div>
          {s.user?.memberships.map((m) => (
            <div key={m.groupId} className="feed-item" onClick={() => s.selectGroup(m.groupId)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && s.selectGroup(m.groupId)}>
              <Avatar name={m.groupName} size={36} />
              <div className="meta"><div className="n">{m.groupName}</div><div className="s">{m.companyName}</div></div>
              <Badge cls={m.role === 'Admin' ? 'b-sky' : 'b-violet'}>{m.role}</Badge>
              {m.groupId === s.activeGroupId && <Badge cls="b-live" dot>Selected</Badge>}
            </div>
          ))}
          <div className="card-body row" style={{ justifyContent: 'space-between' }}>
            <Link to="/help" className="btn btn-ghost">Help &amp; support</Link>
            <Button variant="danger" icon={LogOut} onClick={logout}>Log out</Button>
          </div>
        </section>
      </div>
    </>
  );
}
