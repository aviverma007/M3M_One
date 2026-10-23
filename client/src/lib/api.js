import axios from 'axios';

const TOKEN_KEY = 'm3m_one_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export const api = axios.create({ baseURL: '/v1' });

api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.includes('/auth/login')) {
      setToken(null);
      window.dispatchEvent(new Event('m3m:logout'));
    }
    return Promise.reject(err);
  },
);

// Unwrap { success, message, data }
export const get = async (url, params) => (await api.get(url, { params })).data.data;
export const post = async (url, body, cfg) => (await api.post(url, body, cfg)).data;
export const put = async (url, body) => (await api.put(url, body)).data;
export const del = async (url) => (await api.delete(url)).data;

export const errMsg = (e, fallback = 'Something went wrong') => e?.response?.data?.message || e?.message || fallback;

export async function download(url, filename, params) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 500);
}
