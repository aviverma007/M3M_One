import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { get, post, getToken, setToken } from './api';
import { DEFAULT_ACCESS, isAdmin } from './constants';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [access, setAccess] = useState({});

  const loadAccess = useCallback(async (u) => {
    if (!u || isAdmin(u)) { setAccess({}); return; }
    try {
      const roles = await get('/roles');
      const key = `${u.company || 'any'}:${u.department}`;
      const rec = roles.find((r) => r.roleName === key) || roles.find((r) => r.roleName === `any:${u.department}`);
      const map = {};
      for (const p of rec?.permissions || []) if (p.name?.startsWith('module:')) map[p.name.slice(7)] = p.access || 'none';
      setAccess(rec ? map : (DEFAULT_ACCESS[u.department] || {}));
    } catch { setAccess(DEFAULT_ACCESS[u.department] || {}); }
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); setReady(true); return; }
    try {
      const me = await get('/auth/me');
      setUser(me); await loadAccess(me);
    } catch { setToken(null); setUser(null); }
    setReady(true);
  }, [loadAccess]);

  useEffect(() => {
    refresh();
    const onLogout = () => setUser(null);
    window.addEventListener('m3m:logout', onLogout);
    return () => window.removeEventListener('m3m:logout', onLogout);
  }, [refresh]);

  const login = async (email, password) => {
    const res = await post('/auth/login', { email, password });
    setToken(res.data.accessToken);
    setUser(res.data.user);
    await loadAccess(res.data.user);
    return res.data.user;
  };
  const logout = () => { setToken(null); setUser(null); };

  // 'edit' | 'view' | 'none'
  const moduleAccess = (moduleName) => {
    if (isAdmin(user)) return 'edit';
    return access[moduleName] || 'none';
  };

  return <AuthCtx.Provider value={{ user, ready, login, logout, refresh, moduleAccess }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
