import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setSessionExpiredHandler, tokens } from '../lib/api';

const K_GROUP = 'ql_active_group';
const K_DEVICE = 'ql_device_id';

const SessionContext = createContext(null);

function readLs(k) { try { return localStorage.getItem(k); } catch { return null; } }
function writeLs(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignore */ } }

export function deviceId() {
  let id = readLs(K_DEVICE);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    writeLs(K_DEVICE, id);
  }
  return id;
}

/**
 * status: 'loading' | 'loggedOut' | 'needsGroup' | 'ready'
 * The shown shell (admin or salesman) follows the user's role in the active group.
 */
export function SessionProvider({ children }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [activeGroupId, setActiveGroupId] = useState(readLs(K_GROUP));
  const [chooser, setChooser] = useState(false);

  const apply = useCallback((u, preferGroup) => {
    setUser(u);
    const ids = new Set(u.memberships.map((m) => m.groupId));
    let gid = preferGroup || readLs(K_GROUP);
    if (!gid || !ids.has(gid)) gid = u.memberships[0]?.groupId || null;
    writeLs(K_GROUP, gid);
    setActiveGroupId(gid);
    setStatus(gid ? 'ready' : 'needsGroup');
  }, []);

  const loggedOut = useCallback(() => {
    tokens.clear();
    writeLs(K_GROUP, null);
    setUser(null);
    setStatus('loggedOut');
    qc.clear();
  }, [qc]);

  useEffect(() => {
    setSessionExpiredHandler(loggedOut);
    if (!tokens.refresh) { setStatus('loggedOut'); return; }
    api.me().then((u) => apply(u)).catch((e) => (e.status === 401 || !tokens.refresh ? loggedOut() : setStatus('loggedOut')));
  }, [apply, loggedOut]);

  const value = useMemo(() => {
    const active = user?.memberships.find((m) => m.groupId === activeGroupId) || null;
    return {
      status: chooser && status === 'ready' ? 'needsGroup' : status,
      user,
      active,
      activeGroupId,
      isAdmin: active?.role === 'Admin',
      canGoBack: chooser && !!active,
      async signedIn(auth) {
        tokens.save(auth.accessToken, auth.refreshToken);
        apply(auth.user);
      },
      async refresh() {
        const u = await api.me();
        setUser(u);
        return u;
      },
      updateUser: (u) => setUser(u),
      async enterGroup(gid) {
        const u = await api.me();
        setChooser(false);
        qc.clear();
        apply(u, gid);
      },
      selectGroup(gid) {
        writeLs(K_GROUP, gid);
        setActiveGroupId(gid);
        setChooser(false);
        qc.clear();
      },
      openChooser: () => setChooser(true),
      closeChooser: () => setChooser(false),
      async logout() {
        try { await api.logout(tokens.refresh); } catch { /* best effort */ }
        loggedOut();
      },
    };
  }, [user, activeGroupId, status, chooser, apply, loggedOut, qc]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
