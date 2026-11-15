import axios from 'axios';

/**
 * Địa chỉ API:
 * - Nếu có NEXT_PUBLIC_API_URL thì dùng giá trị đó.
 * - Chạy trên máy cá nhân (localhost) thì dùng http://localhost:8000/api/v1.
 * - Chạy trên server của trường thì dùng /api/v1 cùng tên miền.
 */
function resolveBaseURL(): string {
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env) return env.replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:8000/api/v1';
    return '/api/v1';
  }
  return 'http://localhost:8000/api/v1';
}

const api = axios.create({
  baseURL: resolveBaseURL(),
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    // Đọc token ở cả hai nơi: "Ghi nhớ đăng nhập" bật (localStorage) hoặc tắt (sessionStorage)
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
// Hết phiên / token sai → về trang đăng nhập
api.interceptors.response.use(
    (res) => res,
    (err) => {
      if (typeof window !== 'undefined' && err?.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      return Promise.reject(err);
    },
);