import api from '@/services/api';

const d = (r: any) => r.data?.data;

/** Lấy thông điệp lỗi thân thiện từ response Laravel */
export function errMsg(e: any, fallback = 'Có lỗi xảy ra'): string {
    const r = e?.response;
    if (!r) return 'Không kết nối được máy chủ API. Kiểm tra Laragon đang chạy.';
    return r.data?.message || fallback;
}
export function fieldErrors(e: any): Record<string, string> {
    const errs = e?.response?.data?.errors || {};
    const out: Record<string, string> = {};
    Object.keys(errs).forEach((k) => (out[k] = Array.isArray(errs[k]) ? errs[k][0] : String(errs[k])));
    return out;
}

/**
 * Tự dò đường dẫn route của module Setting: thử /setting rồi /v1/setting,
 * nhớ lại tiền tố chạy được (phụ thuộc cách ModuleLoader & NEXT_PUBLIC_API_URL của dự án).
 */
let prefix: string | null = null;
const PREFIXES = ['/setting', '/v1/setting'];
async function call(method: string, path: string, opts: any = {}) {
    const list = prefix ? [prefix] : PREFIXES;
    let last: any;
    for (const p of list) {
        try {
            const r = await api.request({ method, url: p + path, ...opts });
            prefix = p;
            return r;
        } catch (e: any) {
            last = e;
            const miss = e?.response?.status === 404 && /could not be found|not found/i.test(String(e?.response?.data?.message || ''));
            if (!miss) throw e;
        }
    }
    throw last;
}
const get = (p: string, params?: any, o: any = {}) => call('get', p, { params, ...o });
const post = (p: string, data?: any) => call('post', p, { data });
const put = (p: string, data?: any) => call('put', p, { data });
const del = (p: string) => call('delete', p);

export const settingsApi = {
    overview: () => get('/overview').then(d),
    getGroup: (g: string) => get(`/groups/${g}`).then(d),
    saveGroup: (g: string, values: Record<string, any>) => put(`/groups/${g}`, { values }).then(d),
    mailTest: (to: string) => post('/mail/test', { to }).then((r) => r.data),
    maintenance: (enabled: boolean, message: string) => post('/maintenance', { enabled, message }).then((r) => r.data),
    clearCache: () => post('/cache/clear').then((r) => r.data),

    years: () => get('/school-years').then(d),
    saveYear: (id: number | null, v: any) => (id ? put(`/school-years/${id}`, v) : post('/school-years', v)),
    deleteYear: (id: number) => del(`/school-years/${id}`),
    currentYear: (id: number) => post(`/school-years/${id}/set-current`),
    saveSemester: (id: number | null, v: any) => (id ? put(`/semesters/${id}`, v) : post('/semesters', v)),
    deleteSemester: (id: number) => del(`/semesters/${id}`),
    currentSemester: (id: number) => post(`/semesters/${id}/set-current`),

    backups: () => get('/backups').then(d),
    createBackup: (type: string, note: string) => post('/backups', { type, note }),
    saveBackupSettings: (v: any) => put('/backup-settings', v),
    deleteBackup: (id: number) => del(`/backups/${id}`),
    restoreBackup: (id: number, confirm: string) => post(`/backups/${id}/restore`, { confirm }),
    downloadBackup: async (id: number, name: string) => {
        const r = await get(`/backups/${id}/download`, undefined, { responseType: 'blob' });
        saveBlob(r.data, name);
    },

    auditMeta: () => get('/audit-logs/meta').then(d),
    audit: (params: Record<string, any>) => get('/audit-logs', params).then(d),
    auditOne: (id: number) => get(`/audit-logs/${id}`).then(d),
    auditExport: async (params: Record<string, any>) => {
        const r = await get('/audit-logs/export', params, { responseType: 'blob' });
        saveBlob(r.data, `nhat-ky-he-thong-${new Date().toISOString().slice(0, 10)}.csv`);
    },

    sessions: (params: Record<string, any>) => get('/sessions', params).then(d),
    revokeSession: (id: number) => del(`/sessions/${id}`),
    revokeAll: (scope: 'others' | 'expired') => post('/sessions/revoke-all', { scope }),
};

function saveBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const fmtBytes = (n?: number | null) => {
    if (!n) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
    return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
};
export const fmtDT = (s?: string | null) => {
    if (!s) return '—';
    const x = new Date(s.replace(' ', 'T'));
    return isNaN(+x) ? s : x.toLocaleString('vi-VN', { hour12: false });
};
export const fmtDate = (s?: string | null) => {
    if (!s) return '—';
    const x = new Date(s.replace(' ', 'T'));
    return isNaN(+x) ? s : x.toLocaleDateString('vi-VN');
};
export const ago = (s?: string | null) => {
    if (!s) return 'Chưa từng';
    const t = new Date(s.replace(' ', 'T')).getTime();
    if (isNaN(t)) return s;
    const m = Math.floor((Date.now() - t) / 60000);
    if (m < 1) return 'Vừa xong';
    if (m < 60) return `${m} phút trước`;
    if (m < 1440) return `${Math.floor(m / 60)} giờ trước`;
    return `${Math.floor(m / 1440)} ngày trước`;
};