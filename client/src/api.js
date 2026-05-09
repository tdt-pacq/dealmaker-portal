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

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem('pacq_auth');
      window.location.reload();
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
