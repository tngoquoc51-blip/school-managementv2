// Gọi API Đợt thu của Kế toán: /api/kt/*  (token nhân viên lưu ở localStorage: kt_token, kt_user)
// Nếu NEXT_PUBLIC_API_URL của dự án có đuôi /v1 (vd http://localhost:8000/api/v1) thì bỏ đuôi đó đi
const API = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api').replace(/\/+$/, '').replace(/\/v\d+$/, '');

export type Staff = { id: number; username: string; name: string; role: string; role_label: string; can_cancel: boolean };

export class KtError extends Error {
    status: number;
    errors: Record<string, string>;
    constructor(m: string, status: number, errors: Record<string, string> = {}) { super(m); this.status = status; this.errors = errors; }
}

const safe = {
    get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } },
    del: (k: string) => { try { localStorage.removeItem(k); } catch { /* bỏ qua */ } },
};

export const getToken = () => safe.get('kt_token');
export const getStaff = (): Staff | null => { try { return JSON.parse(safe.get('kt_user') || 'null'); } catch { return null; } };
export const saveSession = (token: string, staff: Staff) => { safe.set('kt_token', token); safe.set('kt_user', JSON.stringify(staff)); };
export const clearSession = () => { safe.del('kt_token'); safe.del('kt_user'); };

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
    const token = getToken();
    if (opts.auth !== false && !token) throw new KtError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 401);
    let res: Response;
    try {
        res = await fetch(`${API}/kt/${path}`, {
            method: opts.method || 'GET',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        });
    } catch {
        throw new KtError('Không kết nối được máy chủ. Hãy kiểm tra backend đang chạy.', 0);
    }
    const json: any = await res.json().catch(() => ({}));
    if (res.status === 401 && opts.auth !== false) {
        clearSession();
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('kt-unauth'));
    }
    if (!res.ok) throw new KtError(json?.message || 'Có lỗi xảy ra, vui lòng thử lại.', res.status, json?.errors || {});
    return (json?.data ?? json) as T;
}

export const qs = (o: Record<string, string | number | null | undefined>) => {
    const p = new URLSearchParams();
    Object.entries(o).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) p.set(k, String(v)); });
    const s = p.toString();
    return s ? `?${s}` : '';
};

export const vnd = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${Math.round(n).toLocaleString('vi-VN')}đ`);
export const vndShort = (n: number) => {
    const a = Math.abs(n);
    if (a >= 1e9) return `${(n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`;
    if (a >= 1e6) return `${(n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu`;
    return vnd(n);
};
export const pct = (n: number) => `${n.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;

export const fmtDate = (d?: string | null) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : d || '—');
export const fmtDateTime = (d?: string | null) => (d && d.length >= 16 ? `${d.slice(11, 16)} ${fmtDate(d)}` : fmtDate(d));
export const addDays = (iso: string, n: number) => {
    const t = new Date(`${iso}T00:00:00`);
    t.setDate(t.getDate() + n);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/** Trạng thái đợt thu (phase gồm cả "sắp đến hạn" và "quá hạn") */
export const PHASE: Record<string, { label: string; tone: string }> = {
    draft: { label: 'Bản nháp', tone: 'mut' },
    open: { label: 'Đang thu', tone: 'ok' },
    due_soon: { label: 'Sắp đến hạn', tone: 'warn' },
    overdue: { label: 'Quá hạn thu', tone: 'err' },
    closed: { label: 'Đã kết thúc', tone: 'info' },
    cancelled: { label: 'Đã hủy', tone: 'mut' },
};
export const INV_STATUS: Record<string, { label: string; tone: string }> = {
    paid: { label: 'Đã đóng đủ', tone: 'ok' },
    partial: { label: 'Đóng một phần', tone: 'warn' },
    unpaid: { label: 'Chưa đóng', tone: 'info' },
    cancelled: { label: 'Đã hủy', tone: 'mut' },
};
export const CATEGORY: Record<string, string> = { tuition: 'Học phí', insurance: 'Bảo hiểm', fund: 'Quỹ', service: 'Dịch vụ', uniform: 'Đồng phục', other: 'Khác' };
export const TERM_TITLE: Record<string, string> = { YEAR: 'Các khoản thu đầu năm học', HK1: 'Học phí và dịch vụ học kỳ 1', HK2: 'Học phí và dịch vụ học kỳ 2' };
export const ACTION_LABEL: Record<string, string> = { create: 'Tạo', update: 'Cập nhật', issue: 'Phát hành', extend: 'Gia hạn', close: 'Kết thúc', reopen: 'Mở lại', cancel: 'Hủy' };

/** Tải file CSV (có BOM để Excel mở đúng tiếng Việt) */
export function downloadCsv(name: string, rows: (string | number)[][]) {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}