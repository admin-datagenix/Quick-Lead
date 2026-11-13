import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Hourglass, Phone, QrCode, Search, UserMinus, UserPlus, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { fmt } from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { Avatar, Badge, Button, Drawer, EmptyState, QueryView, Switch, useUi } from '../../components/ui';
import InviteModal from './InviteModal';

export default function SalesmenPage() {
  const { activeGroupId: gid } = useSession();
  const ui = useUi();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [inviting, setInviting] = useState(false);
  const memberId = params.get('m');

  const list = useQuery({ queryKey: ['salesmen', gid], queryFn: () => api.salesmen(gid) });
  const invites = useQuery({ queryKey: ['invitations', gid], queryFn: () => api.groupInvitations(gid) });

  async function cancelInvite(inv) {
    try {
      await api.cancelInvitation(gid, inv.id);
      ui.success('Invitation cancelled');
      qc.invalidateQueries({ queryKey: ['invitations', gid] });
    } catch (e) { ui.error(e); }
  }

  const q = search.trim().toLowerCase();

  return (
    <>
      <div className="page-head">
        <div className="titles"><h1>Salesmen</h1><p className="sub">Invite your team, check their performance and control access.</p></div>
        <div className="actions">
          <div className="search" style={{ width: 260 }}><Search size={16} /><input className="input" placeholder="Search name or mobile" aria-label="Search salesmen" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Button icon={UserPlus} onClick={() => setInviting(true)}>Invite salesmen</Button>
        </div>
      </div>

      {invites.data?.length > 0 && (
        <section className="card">
          <div className="card-head"><Hourglass size={17} color="#B45309" /><h2>Pending invitations ({invites.data.length})</h2></div>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {invites.data.map((i) => (
                  <tr key={i.id}>
                    <td className="num"><b>{fmt.mobile(i.mobile)}</b></td>
                    <td className="muted">{i.formName ? `For ${i.formName}` : 'Group only'}</td>
                    <td className="muted small">Invited {fmt.relative(i.createdAt)}</td>
                    <td style={{ textAlign: 'right' }}><Button variant="ghost" size="sm" onClick={() => cancelInvite(i)} style={{ color: 'var(--red)' }}>Cancel</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card">
        <QueryView query={list}>
          {(rows) => {
            const filtered = rows.filter((r) => !q || r.displayName.toLowerCase().includes(q) || r.mobile.includes(q));
            if (!rows.length) {
              return <EmptyState icon={Users} title="No salesmen yet" message="Invite your team with their mobile numbers. They accept from the in-app inbox."
                action={<Button icon={UserPlus} onClick={() => setInviting(true)}>Invite salesmen</Button>} />;
            }
            return (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Salesman</th><th>Salesman ID</th><th>Status</th><th>Leads</th><th>Forms</th><th>Joined</th></tr></thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.memberId} className="clickable" onClick={() => setParams({ m: r.memberId })}>
                        <td><div className="cell-person"><Avatar name={r.displayName} size={36} /><div><div className="n">{r.displayName}</div><div className="s num">{fmt.mobile(r.mobile)}</div></div></div></td>
                        <td className="mono">{r.salesmanCode}</td>
                        <td>{r.isActive ? <Badge cls="b-live" dot>Active</Badge> : <Badge cls="b-draft" dot>Deactivated</Badge>}</td>
                        <td className="num"><b>{fmt.num(r.leadsCount)}</b></td>
                        <td className="num">{r.assignedFormsCount}</td>
                        <td className="muted small">{fmt.date(r.joinedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && <p className="muted" style={{ padding: 20 }}>No salesman matches “{search}”.</p>}
              </div>
            );
          }}
        </QueryView>
      </section>

      {inviting && <InviteModal groupId={gid} onClose={() => setInviting(false)} />}
      {memberId && <SalesmanDrawer groupId={gid} memberId={memberId} onClose={() => setParams({})} />}
    </>
  );
}

function SalesmanDrawer({ groupId, memberId, onClose }) {
  const ui = useUi();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['salesman', groupId, memberId], queryFn: () => api.salesman(groupId, memberId) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['salesman', groupId, memberId] });
    qc.invalidateQueries({ queryKey: ['salesmen', groupId] });
    qc.invalidateQueries({ queryKey: ['analytics', groupId] });
  };

  async function toggle(active) {
    try { const r = await api.setSalesmanStatus(groupId, memberId, active); ui.success(r.message); refresh(); } catch (e) { ui.error(e); }
  }
  async function unassign(f, name) {
    if (!(await ui.confirm({ title: 'Unassign form?', message: `${name} will no longer capture leads for ${f.name}.`, confirmLabel: 'Unassign', destructive: true }))) return;
    try { await api.unassignSalesmanForm(groupId, memberId, f.formId); ui.success('Form unassigned'); refresh(); } catch (e) { ui.error(e); }
  }
  async function remove(name) {
    if (!(await ui.confirm({ title: `Remove ${name}?`, message: 'They lose access to this group. Leads they captured are kept.', confirmLabel: 'Remove', destructive: true }))) return;
    try { await api.removeSalesman(groupId, memberId); ui.success('Salesman removed'); refresh(); onClose(); } catch (e) { ui.error(e); }
  }

  return (
    <Drawer title="Salesman" onClose={onClose}>
      <QueryView query={q}>
        {(s) => (
          <>
            <div className="card card-pad stack">
              <div className="row">
                <Avatar name={s.displayName} size={56} />
                <div className="grow">
                  <h2 style={{ fontSize: 19 }}>{s.displayName}</h2>
                  <div className="muted num">{fmt.mobile(s.mobile)}</div>
                  <Badge cls="b-sky"><span className="mono">ID {s.salesmanCode}</span></Badge>
                </div>
                <a className="tool-btn" href={`tel:+91${s.mobile}`} aria-label="Call"><Phone size={17} /></a>
              </div>
              <div className="divider" />
              <div className="row">
                <div className="grow"><b>{s.isActive ? 'Active' : 'Deactivated'}</b><div className="muted small">{s.isActive ? 'Can capture leads' : 'Lead capture is blocked'}</div></div>
                <Switch checked={s.isActive} onChange={toggle} label="Salesman active" />
              </div>
            </div>
            <div className="grid cols-2" style={{ gap: 12 }}>
              <div className="card card-pad"><div className="muted small">Leads today</div><div className="kpi-value" style={{ fontSize: 28 }}>{s.todayLeads}</div></div>
              <div className="card card-pad"><div className="muted small">Leads captured</div><div className="kpi-value" style={{ fontSize: 28 }}>{fmt.num(s.totalLeads)}</div></div>
            </div>
            <div className="card card-pad info-list" style={{ paddingBlock: 6 }}>
              <div className="info-row"><span className="k">Joined</span><span className="v">{fmt.date(s.joinedAt)}</span></div>
              <div className="info-row"><span className="k">Last login</span><span className="v">{s.lastLoginAt ? fmt.relative(s.lastLoginAt) : 'Never'}</span></div>
            </div>
            <section className="card">
              <div className="card-head"><h2>Assigned forms ({s.forms.length})</h2></div>
              {s.forms.length === 0 ? <p className="muted" style={{ padding: 20 }}>No forms assigned.</p> : s.forms.map((f) => (
                <div key={f.formId} className="row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                  <div className="grow">
                    <div className="wrap-row" style={{ gap: 6 }}><b>{f.name}</b>{f.isLive ? <Badge cls="b-live" dot>Live</Badge> : <Badge cls="b-expired" dot>Not live</Badge>}{f.isPrimary && <Badge>Primary</Badge>}</div>
                    <div className="muted small">{fmt.rangeLong(f.startDate, f.endDate)} · {f.leadsByMember} leads</div>
                  </div>
                  <Link className="tool-btn" to={`/forms/${f.formId}/qr?m=${memberId}`} aria-label="Salesman QR"><QrCode size={17} /></Link>
                  <Button variant="ghost" size="sm" style={{ color: 'var(--red)' }} onClick={() => unassign(f, s.displayName)}>Unassign</Button>
                </div>
              ))}
            </section>
            <Button variant="danger" icon={UserMinus} onClick={() => remove(s.displayName)}>Remove from group</Button>
          </>
        )}
      </QueryView>
    </Drawer>
  );
}
