import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, ChevronRight, Info, LogOut, UserPlus } from 'lucide-react';
import { useSession } from '../../context/SessionContext';
import { Badge } from '../../components/ui';
import { BrandMark } from '../../components/layout/AppShell';
import { fmt } from '../../lib/format';

export default function GroupChoicePage() {
  const s = useSession();
  const nav = useNavigate();
  const first = (s.user?.fullName || '').split(' ')[0];
  const pending = s.user?.pendingInvitations || 0;

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--surface)' }}>
      <div style={{ width: 'min(560px, 100%)', display: 'grid', gap: 24 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <BrandMark size={44} />
          {s.canGoBack ? (
            <button className="btn btn-ghost" onClick={s.closeChooser}><ArrowLeft size={16} />Back</button>
          ) : (
            <button className="btn btn-ghost" onClick={s.logout}><LogOut size={16} />Log out</button>
          )}
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <h1>{first ? `Hi ${first},` : 'Welcome!'}</h1>
          <p className="muted" style={{ fontSize: 16 }}>How would you like to start?</p>
        </div>
        <button className="choice" onClick={() => nav('/groups/new')}>
          <span className="ci" style={{ background: 'var(--sky-100)', color: 'var(--sky-700)' }}><Building2 size={26} /></span>
          <span className="grow">
            <b style={{ fontSize: 16 }}>Create a group</b>
            <span className="muted" style={{ display: 'block', marginTop: 4 }}>For admins. Set up your company, build lead forms and invite your sales team.</span>
          </span>
          <ChevronRight size={18} color="#8FA3B5" />
        </button>
        <button className="choice" onClick={() => nav('/invitations')}>
          <span className="ci" style={{ background: 'var(--violet-50)', color: 'var(--violet)' }}><UserPlus size={26} /></span>
          <span className="grow">
            <span className="row" style={{ gap: 8 }}><b style={{ fontSize: 16 }}>Join a group</b>{pending > 0 && <Badge cls="b-red">{pending} new</Badge>}</span>
            <span className="muted" style={{ display: 'block', marginTop: 4 }}>For salesmen. Accept an invitation from your admin to start capturing leads.</span>
          </span>
          <ChevronRight size={18} color="#8FA3B5" />
        </button>
        <div className="banner info"><Info size={18} />Ask your admin to invite {fmt.mobile(s.user?.mobile)}. Invitations appear in your inbox instantly.</div>
      </div>
    </div>
  );
}
