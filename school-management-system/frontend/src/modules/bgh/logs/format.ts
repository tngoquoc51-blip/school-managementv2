import type { Severity, Status } from './types';

export const MODULES: Record<string, { label: string; color: string }> = {
    auth:         { label: 'Đăng nhập',   color: '#60a5fa' },
    student:      { label: 'Học sinh',    color: '#34d399' },
    teacher:      { label: 'Giáo viên',   color: '#a78bfa' },
    academic:     { label: 'Học vụ',      color: '#f59e0b' },
    exam:         { label: 'Điểm & thi',  color: '#f472b6' },
    attendance:   { label: 'Chuyên cần',  color: '#2dd4bf' },
    finance:      { label: 'Tài chính',   color: '#fbbf24' },
    notification: { label: 'Thông báo',   color: '#38bdf8' },
    report:       { label: 'Báo cáo',     color: '#c084fc' },
    system:       { label: 'Hệ thống',    color: '#94a3b8' },
    security:     { label: 'Bảo mật',     color: '#fb7185' },
};

export const SEVERITY: Record<Severity, { label: string; rank: number }> = {
    info:     { label: 'Thông tin',  rank: 0 },
    notice:   { label: 'Lưu ý',      rank: 1 },
    warning:  { label: 'Cảnh báo',   rank: 2 },
    critical: { label: 'Nghiêm trọng', rank: 3 },
};

export const STATUS: Record<Status, string> = { success: 'Thành công', failed: 'Thất bại', denied: 'Bị từ chối' };

export const ROLES: Record<string, string> = {
    super_admin: 'Quản trị hệ thống', principal: 'Hiệu trưởng', vice_principal: 'Phó Hiệu trưởng',
    academic: 'Giáo vụ', accountant: 'Kế toán', teacher: 'Giáo viên', student: 'Học sinh', system: 'Hệ thống',
};

export const moduleLabel = (m: string) => MODULES[m]?.label || m;
export const roleLabel = (r?: string | null) => (r ? ROLES[r] || r : '—');

export const nf = (n: number | string | null | undefined) => Number(n || 0).toLocaleString('vi-VN');
export const money = (n: number | string | null | undefined) => Number(n || 0).toLocaleString('vi-VN') + ' ₫';

/** '2026-11-03 08:15:30.000' → '03/11 08:15:30' (không dùng Date để khỏi lệch múi giờ) */
export function fmtTime(s?: string | null, withYear = false) {
    if (!s) return '—';
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
    if (!m) return s;
    return `${m[3]}/${m[2]}${withYear ? '/' + m[1] : ''} ${m[4]}:${m[5]}${m[6] ? ':' + m[6] : ''}`;
}

export function fmtDate(s?: string | null) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

export function ago(s?: string | null) {
    if (!s) return '—';
    const t = new Date(s.replace(' ', 'T')).getTime();
    if (isNaN(t)) return s;
    const d = Math.max(0, (Date.now() - t) / 1000);
    if (d < 60) return 'vừa xong';
    if (d < 3600) return `${Math.floor(d / 60)} phút trước`;
    if (d < 86400) return `${Math.floor(d / 3600)} giờ trước`;
    return `${Math.floor(d / 86400)} ngày trước`;
}

export function until(s?: string | null) {
    if (!s) return '—';
    const t = new Date(s.replace(' ', 'T')).getTime();
    const d = (t - Date.now()) / 1000;
    if (isNaN(t)) return s;
    if (d <= 0) return 'đã hết hạn';
    if (d < 3600) return `còn ${Math.ceil(d / 60)} phút`;
    return `còn ${Math.floor(d / 3600)} giờ ${Math.floor((d % 3600) / 60)} phút`;
}

export function pretty(v: unknown): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') return JSON.stringify(v, null, 0);
    return String(v);
}

export function delta(cur: number, prev: number) {
    if (!prev) return cur ? { pct: 100, up: true } : { pct: 0, up: true };
    const pct = Math.round(((cur - prev) / prev) * 100);
    return { pct: Math.abs(pct), up: pct >= 0 };
}

export function initials(name?: string | null) {
    const p = (name || '?').trim().split(/\s+/);
    return ((p[p.length - 2]?.[0] || '') + (p[p.length - 1]?.[0] || '')).toUpperCase() || '?';
}