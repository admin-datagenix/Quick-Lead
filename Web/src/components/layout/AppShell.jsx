import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell, Check, ChevronsUpDown, FileText, Gauge, HelpCircle, History, Home, LayoutList, LogOut, Mail, Menu, Plus,
  Settings, User, Users,
} from 'lucide-react';
import { useSession } from '../../context/SessionContext';
import { api } from '../../lib/api';
import { Avatar, Badge, Modal, useUi } from '../ui';

export function BrandMark({ size = 34 }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }}>
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" />
        <path d="M14 14h3v3h-3zM20 20h-3" />
      </svg>
    </span>
  );
}

const ADMIN_NAV = [
  { to: '/', label: 'Dashboard', icon: Gauge, end: true },
  { to: '/leads', label: 'Leads', icon: LayoutList },
  { to: '/forms', label: 'Forms', icon: FileText },
  { to: '/salesmen', label: 'Salesmen', icon: Users },
  { to: '/logs', label: 'Logs', icon: History },
  { to: '/settings', label: 'Group settings', icon: Settings },
];

const SALES_NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/my-forms', label: 'My forms', icon: FileText },
  { to: '/my-leads', label: 'My leads', icon: LayoutList },
  { to: '/invitations', label: 'Invitations', icon: Mail, inbox: true },
];

const TITLES = {
  '/': ['Dashboard', 'Home'], '/leads': 'Leads', '/forms': 'Forms', '/salesmen': 'Salesmen', '/logs': 'Logs',
  '/settings': 'Group settings', '/my-forms': 'My forms', '/my-leads': 'My leads', '/notifications': 'Notifications',
  '/profile': 'Profile', '/help': 'Help & support', '/invitations': 'Invitations',
};

export default function AppShell({ children }) {
  const s = useSession();
  const loc = useLocation();
  const nav = useNavigate();
  const ui = useUi();
  const [open, setOpen] = useState(false);
  const [switcher, setSwitcher] = useState(false);

  const unread = useQuery({ queryKey: ['unread'], queryFn: api.unreadCount, refetchInterval: 60_000 });
  useEffect(() => setOpen(false), [loc.pathname]);

  const items = s.isAdmin ? ADMIN_NAV : SALES_NAV;
  const t = TITLES[loc.pathname];
  const title = Array.isArray(t) ? (s.isAdmin ? t[0] : t[1]) : t || '';
  const name = s.user?.fullName || `+91 ${s.user?.mobile}`;
  const pending = s.user?.pendingInvitations || 0;

  async function logout() {
    if (await ui.confirm({ title: 'Log out?', message: 'You can log in again with your mobile number.', confirmLabel: 'Log out' })) s.logout();
  }

  return (
    <div className={`shell ${open ? 'nav-open' : ''}`}>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className="sidebar" aria-label="Main navigation">
        <Link to="/" className="brand"><BrandMark /><span className="brand-name">Quick<b>Leads</b></span></Link>

        <button className="group-switch" onClick={() => setSwitcher(true)}>
          <Avatar name={s.active?.groupName} size={34} />
          <span className="grow">
            <span className="gs-name truncate" style={{ display: 'block' }}>{s.active?.groupName}</span>
            <span className="gs-role">{s.isAdmin ? 'Admin' : `Salesman · ${s.active?.salesmanCode}`}</span>
          </span>
          <ChevronsUpDown size={16} color="#8FA3B5" />
        </button>

        <div className="nav-label">{s.isAdmin ? 'Manage' : 'Capture'}</div>
        <nav className="nav">
          {items.map(({ to, label, icon: Icon, end, inbox }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon size={18} aria-hidden="true" />{label}
              {inbox && pending > 0 && <span className="count">{pending}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="nav-label" style={{ marginTop: 18 }}>Account</div>
        <nav className="nav">
          <NavLink to="/notifications"><Bell size={18} />Notifications{unread.data > 0 && <span className="count">{unread.data}</span>}</NavLink>
          <NavLink to="/profile"><User size={18} />Profile</NavLink>
          <NavLink to="/help"><HelpCircle size={18} />Help &amp; support</NavLink>
          <a href="#logout" onClick={(e) => { e.preventDefault(); logout(); }}><LogOut size={18} />Log out</a>
        </nav>

        <div className="sidebar-foot">QuickLeads by <b>DatagenixAI</b></div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={19} /></button>
          <span className="crumb">{s.active?.companyName}{title && <> &nbsp;/&nbsp; <b style={{ color: 'var(--ink)' }}>{title}</b></>}</span>
          <span className="spacer" />
          <button className="icon-btn" onClick={() => nav('/notifications')} aria-label={`Notifications${unread.data ? `, ${unread.data} unread` : ''}`}>
            <Bell size={18} />{unread.data > 0 && <span className="dot">{unread.data > 9 ? '9+' : unread.data}</span>}
          </button>
          <Link to="/profile" className="user-chip"><Avatar name={name} size={30} /><span>{name}</span></Link>
        </header>
        <main className="content">{children}</main>
      </div>

      {switcher && <GroupSwitcher onClose={() => setSwitcher(false)} />}
    </div>
  );
}

function GroupSwitcher({ onClose }) {
  const s = useSession();
  const nav = useNavigate();
  const pending = s.user?.pendingInvitations || 0;
  return (
    <Modal title="Switch group" subtitle="Your role and menu follow the selected group." onClose={onClose}>
      <div className="stack">
        {s.user.memberships.map((m) => {
          const on = m.groupId === s.activeGroupId;
          return (
            <button
              key={m.groupId}
              className="choice"
              style={{ padding: 14, borderColor: on ? 'var(--sky)' : undefined, background: on ? 'var(--sky-50)' : undefined }}
              onClick={() => { onClose(); if (!on) { s.selectGroup(m.groupId); nav('/'); } }}
            >
              <Avatar name={m.groupName} size={40} />
              <span className="grow">
                <b style={{ display: 'block' }}>{m.groupName}</b>
                <span className="muted small">{m.companyName}</span>
              </span>
              <Badge cls={m.role === 'Admin' ? 'b-sky' : 'b-violet'}>{m.role}</Badge>
              {on && <Check size={18} color="#0284C7" />}
            </button>
          );
        })}
      </div>
      <div className="divider" />
      <div className="wrap-row">
        <button className="btn btn-secondary" onClick={() => { onClose(); nav('/groups/new'); }}><Plus size={16} />Create new group</button>
        <button className="btn btn-secondary" onClick={() => { onClose(); nav('/invitations'); }}>
          <Mail size={16} />Join a group{pending > 0 && <Badge cls="b-red">{pending}</Badge>}
        </button>
      </div>
    </Modal>
  );
}
