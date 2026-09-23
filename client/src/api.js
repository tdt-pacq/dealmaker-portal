import axios from 'axios';

const BASE = '/api';

function getAuthHeader() {
  const creds = sessionStorage.getItem('pacq_auth');
  if (creds) return { Authorization: `Basic ${creds}` };
  return {};
}

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use(config => {
  config.headers = { ...config.headers, ...getAuthHeader() };
  return config;
});

function isPublicSharePath() {
  return typeof window !== 'undefined' && /^\/engagements\/[^/]+$/.test(window.location.pathname);
}

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem('pacq_auth');
      // Sellers on a token URL have no credentials — do not bounce them to login.
      if (!isPublicSharePath()) {
        window.location.reload();
      }
    }
    return Promise.reject(err);
  }
);

export function setAuth(username, password) {
  sessionStorage.setItem('pacq_auth', btoa(`${username}:${password}`));
}

export function getAuth() {
  return sessionStorage.getItem('pacq_auth');
}

export function clearAuth() {
  sessionStorage.removeItem('pacq_auth');
}

// Deals
export const fetchDeals = (params) => api.get('/deals', { params });
export const fetchDeal = (id) => api.get(`/deals/${id}`);
export const createDeal = (data) => api.post('/deals', data);
export const updateDeal = (id, data) => api.patch(`/deals/${id}`, data);
export const deleteDeal = (id) => api.delete(`/deals/${id}`);
export const downloadUrl = (id, type) => `/api/deals/${id}/download/${type}`;

/** Authenticated blob download — raw <a href> skips the Basic Auth header and 401s. */
export async function downloadDealPdf(id, type) {
  let res;
  try {
    res = await api.get(`/deals/${id}/download/${type}`, { responseType: 'blob' });
  } catch (err) {
    const data = err.response?.data;
    if (data instanceof Blob) {
      try { err.response.data = JSON.parse(await data.text()); } catch { /* keep blob */ }
    }
    throw err;
  }
  const disposition = res.headers['content-disposition'] || '';
  const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1].replace(/"/g, '')) : `${type}.pdf`;
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Generate
export const generateBlindAd = (deal_id) => api.post('/generate/blind-ad', { deal_id });
export const generateFlyer = (deal_id) => api.post('/generate/flyer', { deal_id });
export const generateCbr = (deal_id) => api.post('/generate/cbr', { deal_id });

// Export to PDF
export const exportFlyer = (id) => api.post(`/export/flyer/${id}`);
export const exportCbr = (id) => api.post(`/export/cbr/${id}`);

// Extract interview fields from uploaded document or pasted text
export const extractInterview = (formData) =>
  api.post('/extract/interview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000 // 2 min — Claude may take 20-30s for large docs
  });

// Users
export const fetchCurrentUser = () => api.get('/users/me');
export const changePassword = (userId, password) =>
  api.patch(`/users/${userId}/password`, { password });

// Discovery (BIR / Business Intel hooks)
export const fetchDiscoveryRecent = () => api.get('/discovery/recent');
export const fetchDiscoveryReport = (id) => api.get(`/discovery/reports/${id}`);

// Seller Engagement Proposals
export const fetchProposals = () => api.get('/proposals');
export const fetchProposal = (id) => api.get(`/proposals/${id}`);
export const fetchProposalByToken = (token) => api.get(`/proposals/t/${token}`);
export const createProposal = (data) => api.post('/proposals', data);
export const updateProposal = (id, data) => api.patch(`/proposals/${id}`, data);
export const deleteProposal = (id) => api.delete(`/proposals/${id}`);

// Deal events / audit trail
export const fetchDealEvents = (id) => api.get(`/deals/${id}/events`);

// Annual Success Plans
export const fetchSuccessPlans = (year) => api.get('/success-plans', { params: year ? { year } : {} });
export const saveSuccessPlanCompany = (data) => api.put('/success-plans/company', data);
export const saveSuccessPlanPerson = (id, data) => api.put(`/success-plans/people/${id}`, data);
export const createSuccessPlanPerson = (data) => api.post('/success-plans/people', data);
export const archiveSuccessPlanPerson = (id, year) => api.post(`/success-plans/people/${id}/archive`, { year });
export const restoreSuccessPlanPerson = (id, year) => api.post(`/success-plans/people/${id}/restore`, { year });
export const createSuccessPlanYear = (year) => api.post('/success-plans/years', { year });
