import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarX, ClipboardCheck, ClipboardX, Copy, Mail } from 'lucide-react';
import { api } from '../../lib/api';
import { fmt } from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { Button, EmptyState, QueryView } from '../../components/ui';

const STYLE = {
  Invitation: [Mail, '#6D28D9', '#F3EEFF'], InvitationResponse: [Mail, '#6D28D9', '#F3EEFF'],
  FormAssigned: [ClipboardCheck, '#15803D', '#E8F7EE'], FormUnassigned: [ClipboardX, '#B45309', '#FEF5E7'],
  FormExpiring: [CalendarX, '#B91C1C', '#FDECEC'], FormExpired: [CalendarX, '#B91C1C', '#FDECEC'],
  DuplicateLead: [Copy, '#B45309', '#FEF5E7'],
};

export default function NotificationsPage() {
  const s = useSession();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api.notifications(1) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['unread'] }); };

  async function open(n) {
    if (!n.isRead) api.markRead(n.id).then(refresh).catch(() => {});
    if (n.type === 'Invitation') { nav('/invitations'); s.refresh(); }
    else if (n.type === 'DuplicateLead' && s.isAdmin) nav('/leads');
    else if (n.refId && s.isAdmin && ['FormExpiring', 'FormExpired'].includes(n.type)) nav(`/forms/${n.refId}`);
  }

  return (
    <>
      <div className="page-head">
        <div className="titles"><h1>Notifications</h1><p className="sub">Invitations, form assignments, expiry reminders and duplicate alerts.</p></div>
        <Button variant="secondary" onClick={async () => { await api.markAllRead(); refresh(); }}>Mark all read</Button>
      </div>
      <section className="card">
        <QueryView query={q}>
          {(page) => page.items.length === 0 ? <EmptyState icon={Bell} title="You’re all caught up" message="New invitations and updates will appear here." /> : page.items.map((n) => {
            const [Icon, fg, bg] = STYLE[n.type] || [Bell, '#0284C7', '#E0F2FE'];
            return (
              <div key={n.id} className="feed-item" style={{ background: n.isRead ? undefined : 'var(--sky-50)', alignItems: 'flex-start' }} role="button" tabIndex={0}
                onClick={() => open(n)} onKeyDown={(e) => e.key === 'Enter' && open(n)}>
                <span className="kpi-ic" style={{ background: bg, color: fg, borderRadius: '50%', width: 40, height: 40 }}><Icon size={18} /></span>
                <div className="meta">
                  <div className="n">{n.title}{!n.isRead && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: 'var(--sky)', marginLeft: 8 }} />}</div>
                  <div style={{ color: 'var(--body)' }}>{n.body}</div>
                </div>
                <time>{fmt.relative(n.createdAt)}</time>
              </div>
            );
          })}
        </QueryView>
      </section>
    </>
  );
}
