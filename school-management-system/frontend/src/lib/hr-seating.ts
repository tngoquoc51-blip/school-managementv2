import { useCallback, useEffect, useRef, useState } from 'react';

/** API Sơ đồ & Sĩ số lớp: /api/v1/homeroom/seating (NEXT_PUBLIC_API_URL mặc định /api). */
const API = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');
const BASE = `${API}/v1/homeroom/seating`;
const TOKEN_KEYS = ['gv_token', 'staff_token', 'token', 'access_token'];

export class ApiError extends Error {
    status: number;
    data: any;
    constructor(message: string, status: number, data?: any) {
        super(message);
        this.status = status;
        this.data = data;
    }
}

export function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    for (const k of TOKEN_KEYS) {
        const v = localStorage.getItem(k);
        if (v && v !== 'demo-token') return v;
    }
    return null;
}

export type Params = Record<string, string | number | undefined | null>;

async function call<T>(method: string, path: string, body?: unknown, params?: Params): Promise<{ data: T; message: string }> {
    const token = getToken();
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, String(v)); });
    const res = await fetch(`${BASE}${path}${q.toString() ? '?' + q.toString() : ''}`, {
        method,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: 'no-store',
    });
    let json: any = null;
    try { json = await res.json(); } catch { /* không phải JSON */ }
    if (!res.ok || json?.success === false) {
        const first = json?.errors && typeof json.errors === 'object' ? (Object.values(json.errors)[0] as any)?.[0] : null;
        throw new ApiError(first || json?.message || `Lỗi máy chủ (${res.status})`, res.status, json);
    }
    return { data: json?.data as T, message: json?.message || '' };
}

export const hrGet = async <T>(path: string, params?: Params) => (await call<T>('GET', path, undefined, params)).data;
export const hrSend = <T = any>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown, params?: Params) => call<T>(method, path, body, params);
export const errText = (e: any): string => e?.message || 'Có lỗi xảy ra, vui lòng thử lại.';

/** Tải dữ liệu có loading / error / reload; tự tải lại khi path hoặc params đổi. */
export function useApi<T>(path: string | null, params: Params = {}) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState<boolean>(!!path);
    const [error, setError] = useState<any>(null);
    const seq = useRef(0);
    const key = path + '|' + JSON.stringify(params);
    const load = useCallback(async () => {
        if (!path) return;
        const id = ++seq.current;
        setLoading(true);
        setError(null);
        try {
            const d = await hrGet<T>(path, params);
            if (id === seq.current) setData(d);
        } catch (e) {
            if (id === seq.current) setError(e);
        } finally {
            if (id === seq.current) setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    useEffect(() => { load(); }, [load]);
    return { data, loading, error, reload: load, setData };
}

// ---------- Tiện ích ----------
export const num = (v: unknown): number => (v === null || v === undefined || v === '' ? 0 : Number(v));
export const fixed = (v: unknown, d = 1): string => (v === null || v === undefined || v === '' ? '–' : Number(v).toFixed(d).replace('.', ','));
export const LEVELS = ['Tốt', 'Khá', 'Đạt', 'Chưa đạt'] as const;
export const LEVEL_COLOR: Record<string, string> = { 'Tốt': '#0fa968', 'Khá': '#1d6fe0', 'Đạt': '#f59e0b', 'Chưa đạt': '#e5484d' };
export const LEVEL_TONE: Record<string, string> = { 'Tốt': 'ok', 'Khá': 'primary', 'Đạt': 'warn', 'Chưa đạt': 'bad' };
export const OFFICER_SHORT: Record<string, string> = { monitor: 'Lớp trưởng', deputy_study: 'Lớp phó HT', deputy_labor: 'Lớp phó LĐ', deputy_culture: 'Lớp phó VT', secretary: 'Bí thư', treasurer: 'Thủ quỹ' };

export function hueOf(text: string): number {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
    return h;
}
export function timeAgo(s?: string | null): string {
    if (!s) return '';
    const t = new Date(s.replace(' ', 'T')).getTime();
    if (isNaN(t)) return s;
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'vừa xong';
    if (m < 60) return `${m} phút trước`;
    if (m < 1440) return `${Math.floor(m / 60)} giờ trước`;
    return `${Math.floor(m / 1440)} ngày trước`;
}
export const fmtDate = (s?: string | null) => { if (!s) return '–'; const d = new Date(s.replace(' ', 'T')); return isNaN(d.getTime()) ? s : d.toLocaleDateString('vi-VN'); };
export const seatKey = (r: number, c: number, p: number) => `${r}-${c}-${p}`;
export const shortName = (full: string) => { const p = full.trim().split(/\s+/); return p.length <= 2 ? full : `${p[0][0]}. ${p.slice(-2).join(' ')}`; };

/** Tải file CSV (có BOM để Excel đọc đúng tiếng Việt). */
export function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const blob = new Blob(['\ufeff' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
}

// ---------- Kiểu dữ liệu ----------
export interface Flags { vision: boolean; hearing: boolean; tall: boolean; front_required: boolean; avoid_ids: number[]; note: string | null }
export interface GroupRef { id: number; number: number; name: string; color: string }
export interface Student {
    id: number; code: string; full_name: string; ten: string; gender: string; birth_date: string; age: number; days_to_birthday: number;
    avg_score: number | null; min_score: number | null; level: string | null; conduct: string | null; group: GroupRef | null;
    officer_roles: string[]; flags: Flags; seat: { row: number; col: number; pos: number; locked: boolean } | null;
    absent_30d: number | null; absent_today: boolean | null;
}
export interface Summary {
    total: number; male: number; female: number; avg_age: number | null; avg_score: number | null; levels: Record<string, number>; groups: Record<string, number>;
    flagged: number; seated: number; unseated: number; birthdays_month: { id: number; full_name: string; birth_date: string; days: number }[];
    attendance_linked: boolean; absent_today: number | null;
}
export interface Seat { row: number; col: number; pos: number; student_id: number; locked: boolean; note: string | null }
export interface Layout {
    id: number; class_id: number; semester: number; name: string; room_label: string | null; rows_n: number; cols_n: number; seats_per_desk: number;
    blocked: string[]; status: string; is_active: boolean; note: string | null; version: number; created_by_name: string | null;
    created_at: string; updated_at: string; published_at: string | null; seated: number; seats?: Seat[];
}
export interface Group { id?: number; number: number; name: string; color: string; leader_student_id: number | null; members: number[] }
export interface Warning { level: 'error' | 'warn' | 'info'; code: string; text: string; students: string[]; ids?: number[] }
export interface Meta {
    staff: { id: number; username: string; name: string; role: string }; is_manager: boolean; resolved_by: string | null;
    class: { id: number; name: string; grade: number }; classes: { id: number; name: string; grade: number; homeroom?: string | null }[];
    year_id: number; year_label: string; semester: number; officer_roles: Record<string, string>;
}
export interface EventRow { id: number; layout_id: number | null; action: string; detail: string | null; actor_name: string | null; created_at: string }

/** Kiểm tra nhanh phía trình duyệt (cùng quy tắc với máy chủ) để báo lỗi ngay khi kéo thả. */
export function clientCheck(seats: Record<string, { student_id: number }>, students: Student[], dims: { rows: number; cols: number; per: number }): { level: 'error' | 'warn' | 'info'; code: string; text: string; ids: number[] }[] {
    const by = new Map(students.map((s) => [s.id, s]));
    const seatOf = new Map<number, { r: number; c: number; p: number }>();
    Object.entries(seats).forEach(([k, v]) => { const [r, c, p] = k.split('-').map(Number); seatOf.set(v.student_id, { r, c, p }); });
    const out: { level: 'error' | 'warn' | 'info'; code: string; text: string; ids: number[] }[] = [];
    const unseated = students.filter((s) => !seatOf.has(s.id)).map((s) => s.id);
    if (unseated.length) out.push({ level: 'warn', code: 'unseated', text: `${unseated.length} học sinh chưa được xếp chỗ`, ids: unseated });
    const far: number[] = [], tall: number[] = [];
    seatOf.forEach((pos, id) => {
        const f = by.get(id)?.flags;
        if (!f) return;
        if ((f.front_required || f.vision || f.hearing) && pos.r > 1) far.push(id);
        if (f.tall && pos.r <= 1 && dims.rows > 2) tall.push(id);
    });
    if (far.length) out.push({ level: 'warn', code: 'front', text: `${far.length} em cận thị / nghe kém đang ngồi xa bảng`, ids: far });
    if (tall.length) out.push({ level: 'info', code: 'tall', text: `${tall.length} em cao đang ngồi bàn đầu`, ids: tall });
    const pairs: number[] = [];
    const byRow = new Map<number, { idx: number; id: number }[]>();
    seatOf.forEach((pos, id) => { const a = byRow.get(pos.r) || []; a.push({ idx: pos.c * dims.per + pos.p, id }); byRow.set(pos.r, a); });
    byRow.forEach((cells) => {
        cells.sort((a, b) => a.idx - b.idx);
        for (let i = 1; i < cells.length; i++) {
            if (cells[i].idx - cells[i - 1].idx !== 1) continue;
            const a = by.get(cells[i - 1].id), b = by.get(cells[i].id);
            if (a && b && (a.flags.avoid_ids.includes(b.id) || b.flags.avoid_ids.includes(a.id))) pairs.push(a.id, b.id);
        }
    });
    if (pairs.length) out.push({ level: 'error', code: 'avoid', text: `${pairs.length / 2} cặp "không nên ngồi cạnh" đang ngồi sát nhau`, ids: pairs });
    return out;
}