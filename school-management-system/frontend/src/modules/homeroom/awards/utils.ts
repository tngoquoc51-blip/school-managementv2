import { useEffect, useState } from 'react';

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

const pad = (n: number) => String(n).padStart(2, '0');

export function fmtDate(d?: string | null): string {
    if (!d) return '—';
    const x = new Date(d.length <= 10 ? d + 'T00:00:00' : d.replace(' ', 'T'));
    return isNaN(x.getTime()) ? '—' : `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`;
}

export function fmtDateTime(d?: string | null): string {
    if (!d) return '—';
    const x = new Date(d.replace(' ', 'T'));
    return isNaN(x.getTime()) ? '—' : `${pad(x.getHours())}:${pad(x.getMinutes())} · ${fmtDate(d)}`;
}

export function relTime(d?: string | null): string {
    if (!d) return '';
    const t = new Date(d.replace(' ', 'T')).getTime();
    if (isNaN(t)) return '';
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return 'Vừa xong';
    if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
    if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
    if (s < 86400 * 30) return `${Math.floor(s / 86400)} ngày trước`;
    return fmtDate(d);
}

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Ngày mặc định khi ghi nhận: hôm nay, nhưng kẹp trong khoảng [min, max] của năm học */
export function clampDate(min: string, max: string): string {
    const today = toISO(new Date());
    return today < min ? min : today > max ? max : today;
}

export function initials(name: string): string {
    const p = name.trim().split(/\s+/);
    return ((p[p.length - 2]?.[0] ?? '') + (p[p.length - 1]?.[0] ?? '')).toUpperCase() || '?';
}

export function avatarStyle(name: string): { background: string } {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
    return { background: `linear-gradient(135deg, hsl(${h} 62% 48%), hsl(${(h + 40) % 360} 62% 40%))` };
}

export const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export const levelLabel = (l: string) => (l === 'school' ? 'Cấp trường' : l === 'district' ? 'Cấp huyện' : 'Cấp lớp');

export const semLabel = (s: number) => (s === 0 ? 'Cả năm' : `Học kỳ ${s}`);

export const roleLabel = (r: string) =>
    ({ super_admin: 'Quản trị hệ thống', principal: 'Hiệu trưởng', vice_principal: 'Phó hiệu trưởng', academic: 'Giáo vụ', teacher: 'Giáo viên chủ nhiệm' } as Record<string, string>)[r] ?? r;

/** Xuất CSV có BOM để Excel đọc đúng tiếng Việt */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const blob = new Blob(['\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export function useDebounced<T>(value: T, ms = 300): T {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}

export const removeAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();