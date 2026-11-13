import axios from 'axios';
import { API_BASE_URL } from './config';

/* ------------------------------------------------------------------ token storage */
const K_ACCESS = 'ql_access';
const K_REFRESH = 'ql_refresh';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export const tokens = {
  get access() { return store.get(K_ACCESS); },
  get refresh() { return store.get(K_REFRESH); },
  save(access, refresh) { store.set(K_ACCESS, access); store.set(K_REFRESH, refresh); },
  clear() { store.del(K_ACCESS); store.del(K_REFRESH); },
};

let onSessionExpired = () => {};
export function setSessionExpiredHandler(fn) { onSessionExpired = fn; }

/* ------------------------------------------------------------------ errors */
export class ApiError extends Error {
  constructor(message, { status, errors, network } = {}) {
    super(message);
    this.status = status;
    this.errors = errors || {};
    this.network = !!network;
  }
  field(key) {
    const hit = Object.entries(this.errors).find(([k]) => k.toLowerCase() === key.toLowerCase());
    return hit ? hit[1]?.[0] : undefined;
  }
}

export function toApiError(err) {
  if (err instanceof ApiError) return err;
  if (axios.isAxiosError(err)) {
    if (!err.response) return new ApiError('Cannot reach the server. Check your connection.', { network: true });
    const data = err.response.data;
    if (data && typeof data === 'object' && 'message' in data) {
      return new ApiError(data.message || 'Something went wrong.', { status: err.response.status, errors: data.errors });
    }
    return new ApiError(`Request failed (${err.response.status}).`, { status: err.response.status });
  }
  return new ApiError(err?.message || 'Something went wrong.');
}

/* ------------------------------------------------------------------ client */
export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json', 'X-Device-Info': `QuickLeads Web · ${navigator.userAgent.slice(0, 160)}` },
  paramsSerializer: { indexes: null }, // formIds=a&formIds=b (ASP.NET list binding)
});

http.interceptors.request.use((cfg) => {
  const t = tokens.access;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

let refreshing = null;
async function refreshTokens() {
  const refresh = tokens.refresh;
  if (!refresh) return false;
  try {
    const res = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, { refreshToken: refresh });
    const d = res.data.data;
    tokens.save(d.accessToken, d.refreshToken);
    return true;
  } catch (e) {
    if (e?.response?.status === 401) { tokens.clear(); onSessionExpired(); }
    return false;
  }
}

http.interceptors.response.use(
  (r) => r,
  async (error) => {
    const cfg = error.config;
    const isAuth = cfg?.url?.includes('/auth/otp') || cfg?.url?.includes('/auth/refresh');
    if (error.response?.status === 401 && cfg && !cfg._retried && !isAuth && tokens.refresh) {
      cfg._retried = true;
      refreshing = refreshing || refreshTokens().finally(() => { refreshing = null; });
      if (await refreshing) {
        cfg.headers.Authorization = `Bearer ${tokens.access}`;
        return http(cfg);
      }
    }
    return Promise.reject(error);
  },
);

/** Unwraps the { success, message, data } envelope. Returns { data, message }. */
async function call(promise) {
  try {
    const res = await promise;
    const body = res.data;
    if (body && body.success) return { data: body.data, message: body.message || '' };
    throw new ApiError(body?.message || 'Request failed.', { status: res.status });
  } catch (e) {
    throw toApiError(e);
  }
}

const get = (url, params) => call(http.get(url, { params })).then((r) => r.data);
const post = (url, body) => call(http.post(url, body ?? {}));
const put = (url, body) => call(http.put(url, body ?? {}));
const patch = (url, body) => call(http.patch(url, body ?? {}));
const del = (url) => call(http.delete(url));

function clean(params) {
  const out = {};
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === null || v === undefined || v === '') return;
    if (Array.isArray(v) && v.length === 0) return;
    out[k] = v;
  });
  return out;
}

/* ------------------------------------------------------------------ endpoints */
export const api = {
  // auth
  requestOtp: (mobile) => post('/api/v1/auth/otp/request', { mobile }),
  verifyOtp: (mobile, code, deviceId) => post('/api/v1/auth/otp/verify', { mobile, code, deviceId, deviceInfo: 'Web' }),
  me: () => get('/api/v1/auth/me'),
  updateMe: (fullName) => put('/api/v1/auth/me', { fullName }),
  logout: (refreshToken) => post('/api/v1/auth/logout', { refreshToken }),

  // groups
  myGroups: () => get('/api/v1/groups'),
  group: (gid) => get(`/api/v1/groups/${gid}`),
  createGroup: (body) => post('/api/v1/groups', body),
  updateGroup: (gid, body) => put(`/api/v1/groups/${gid}`, body),
  dashboard: (gid) => get(`/api/v1/groups/${gid}/dashboard`),
  analytics: (gid, params) => get(`/api/v1/groups/${gid}/analytics`, clean(params)),

  // salesmen
  salesmen: (gid, search) => get(`/api/v1/groups/${gid}/salesmen`, clean({ search })),
  salesman: (gid, mid) => get(`/api/v1/groups/${gid}/salesmen/${mid}`),
  setSalesmanStatus: (gid, mid, isActive) => patch(`/api/v1/groups/${gid}/salesmen/${mid}/status`, { isActive }),
  removeSalesman: (gid, mid) => del(`/api/v1/groups/${gid}/salesmen/${mid}`),
  unassignSalesmanForm: (gid, mid, fid) => del(`/api/v1/groups/${gid}/salesmen/${mid}/forms/${fid}`),

  // invitations
  invite: (gid, mobiles, formId) => post(`/api/v1/groups/${gid}/invitations`, { mobiles, formId: formId || null }),
  groupInvitations: (gid, status = 'Pending') => get(`/api/v1/groups/${gid}/invitations`, clean({ status })),
  cancelInvitation: (gid, iid) => del(`/api/v1/groups/${gid}/invitations/${iid}`),
  inbox: () => get('/api/v1/invitations/inbox'),
  acceptInvitation: (iid, fullName) => post(`/api/v1/invitations/${iid}/accept`, { fullName }),
  declineInvitation: (iid) => post(`/api/v1/invitations/${iid}/decline`),

  // forms
  templates: () => get('/api/v1/form-templates'),
  forms: (gid) => get(`/api/v1/groups/${gid}/forms`),
  form: (fid) => get(`/api/v1/forms/${fid}`),
  createForm: (gid, body) => post(`/api/v1/groups/${gid}/forms`, body),
  updateForm: (fid, body) => put(`/api/v1/forms/${fid}`, body),
  publishForm: (fid) => post(`/api/v1/forms/${fid}/publish`),
  extendForm: (fid, endDate) => post(`/api/v1/forms/${fid}/extend`, { endDate }),
  duplicateForm: (fid) => post(`/api/v1/forms/${fid}/duplicate`),
  deleteForm: (fid) => del(`/api/v1/forms/${fid}`),
  assignments: (fid) => get(`/api/v1/forms/${fid}/assignments`),
  assign: (fid, memberIds) => post(`/api/v1/forms/${fid}/assignments`, { memberIds }),
  unassign: (fid, mid) => del(`/api/v1/forms/${fid}/assignments/${mid}`),
  setPrimary: (fid) => post(`/api/v1/forms/${fid}/primary`),
  formAnalytics: (fid) => get(`/api/v1/forms/${fid}/analytics`),
  qr: (fid, memberId) => get(`/api/v1/forms/${fid}/qr`, clean({ memberId })),

  // leads
  home: (gid) => get(`/api/v1/groups/${gid}/home`),
  captureLead: (gid, body) => post(`/api/v1/groups/${gid}/leads`, body),
  myLeads: (gid, page) => get(`/api/v1/groups/${gid}/leads/mine`, { page, pageSize: 30 }),
  leads: (gid, params) => get(`/api/v1/groups/${gid}/leads`, clean(params)),
  leadFilterOptions: (gid) => get(`/api/v1/groups/${gid}/leads/filter-options`),
  lead: (lid) => get(`/api/v1/leads/${lid}`),

  // exports & logs
  exportLeads: (gid, filter, format) => post(`/api/v1/groups/${gid}/leads/export`, { filter: clean(filter), format }),
  exportLogs: (gid, page = 1) => get(`/api/v1/groups/${gid}/exports`, { page, pageSize: 30 }),
  salesmanLogs: (gid, memberId, page = 1) => get(`/api/v1/groups/${gid}/logs/salesmen`, clean({ memberId, page, pageSize: 30 })),

  // notifications
  notifications: (page = 1) => get('/api/v1/notifications', { page, pageSize: 30 }),
  unreadCount: () => get('/api/v1/notifications/unread-count'),
  markRead: (id) => post(`/api/v1/notifications/${id}/read`),
  markAllRead: () => post('/api/v1/notifications/read-all'),
};

/** Download an export file with auth and save it in the browser. */
export async function downloadExport(id, fileName) {
  try {
    const res = await http.get(`/api/v1/exports/${id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) {
    throw toApiError(e);
  }
}
