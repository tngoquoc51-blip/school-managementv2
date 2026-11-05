'use client';
// Thư viện dùng chung cho module Giám sát hệ thống (/admin/health)
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';
export const SERVER_UTC = true; // Laravel lưu giờ UTC. Nếu đã đổi timezone trong config/app.php thì đặt false.

/* ---------------- phiên đăng nhập riêng cho khu giám sát ---------------- */
export type Staff = { id: number; username: string; name: string; role: string; role_label: string };
const TK = 'mon_token', UK = 'mon_user', OFF = 'mon_demo_off';
/* Dùng luôn phiên đăng nhập của cổng Quản trị / Ban giám hiệu → không hỏi đăng nhập lần 2.
   Nếu backend từ chối (401) thì tự hiện lại khung đăng nhập riêng. */
const mainSession = (): { token: string; staff: Staff } | null => {
    try {
        if (sessionStorage.getItem(OFF)) return null;
        const token = localStorage.getItem('token');
        if (!token) return null;
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        const role = String(localStorage.getItem('current_role') || localStorage.getItem('role') || u?.role || (Array.isArray(u?.roles) ? u.roles[0] : '') || '');
        const isAdmin = /admin/i.test(role);
        const isBgh = /bgh|principal|hieu/i.test(role);
        if (!isAdmin && !isBgh) return null;
        return {
            token,
            staff: {
                id: Number(u?.id) || 0,
                username: u?.username || u?.email || 'admin',
                name: u?.name || 'Quản trị viên',
                role,
                role_label: isAdmin ? 'Quản trị hệ thống' : 'Ban giám hiệu',
            },
        };
    } catch { return null; }
};
export const getToken = () => { try { return localStorage.getItem(TK) || mainSession()?.token || null; } catch { return null; } };
export const getUser = (): Staff | null => { try { const s = localStorage.getItem(UK); return s ? JSON.parse(s) : mainSession()?.staff ?? null; } catch { return null; } };
export const saveSession = (t: string, u: Staff) => { try { sessionStorage.removeItem(OFF); localStorage.setItem(TK, t); localStorage.setItem(UK, JSON.stringify(u)); } catch {} };
export const clearSession = () => { try { localStorage.removeItem(TK); localStorage.removeItem(UK); sessionStorage.setItem(OFF, '1'); } catch {} };

export class ApiError extends Error {
    status: number; errors?: Record<string, string>;
    constructor(m: string, status: number, errors?: Record<string, string>) { super(m); this.status = status; this.errors = errors; }
}

async function call<T>(url: string, method: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
        res = await fetch(url, {
            method,
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() ?? ''}` },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    } catch { throw new ApiError('Không kết nối được máy chủ. Hãy kiểm tra backend đang chạy.', 0); }
    let json: any = null;
    try { json = await res.json(); } catch {}
    if (res.status === 401) { clearSession(); if (typeof window !== 'undefined') window.dispatchEvent(new Event('mon-auth')); }
    if (!res.ok) throw new ApiError(json?.message || 'Có lỗi xảy ra, vui lòng thử lại.', res.status, json?.errors);
    return ((json && 'data' in json) ? json.data : json) as T;
}
export const mon = <T = any>(path: string, o: { method?: string; body?: unknown } = {}) => call<T>(`${BASE}/gv/monitor/${path}`, o.method || 'GET', o.body);
export const login = (username: string, password: string) =>
    call<{ token: string; staff: Staff }>(`${BASE}/gv/login`, 'POST', { username, password });

export const logoutServer = () => { call(`${BASE}/gv/logout`, 'POST').catch(() => {}); };

export const qs = (o: Record<string, string | number | null | undefined | boolean>) => {
    const p = new URLSearchParams();
    Object.entries(o).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '' && v !== false) p.set(k, String(v)); });
    const s = p.toString();
    return s ? `?${s}` : '';
};

/* ---------------- ngữ cảnh ---------------- */
export type Ctx = { staff: Staff; canWrite: boolean; toast: (m: string, kind?: 'ok' | 'err') => void; refreshBadge: () => void; setUpdated: (d: Date) => void };
export const MonCtx = createContext<Ctx>(null as any);
export const useMon = () => useContext(MonCtx);

/* ---------------- tải dữ liệu + tự làm mới ---------------- */
export function useLoad<T = any>(path: string | null, every = 0) {
    const { setUpdated } = useMon();
    const [data, setData] = useState<T | null>(null);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(true);
    const seq = useRef(0);
    const load = useCallback(async (silent = false) => {
        if (!path) return;
        const my = ++seq.current;
        if (!silent) setLoading(true);
        try {
            const d = await mon<T>(path);
            if (my === seq.current) { setData(d); setErr(''); setUpdated(new Date()); }
        } catch (e: any) { if (my === seq.current) setErr(e.message || 'Lỗi tải dữ liệu'); }
        finally { if (my === seq.current) setLoading(false); }
    }, [path, setUpdated]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        if (!every) return;
        const id = setInterval(() => { if (document.visibilityState === 'visible') load(true); }, every * 1000);
        return () => clearInterval(id);
    }, [every, load]);
    return { data, err, loading, reload: () => load(true), setData };
}

export const useDebounced = <T,>(v: T, ms = 350) => {
    const [x, setX] = useState(v);
    useEffect(() => { const t = setTimeout(() => setX(v), ms); return () => clearTimeout(t); }, [v, ms]);
    return x;
};

/* ---------------- thời gian ---------------- */
export const parseServer = (s?: string | null): Date | null => {
    if (!s) return null;
    const d = new Date(s.replace(' ', 'T') + (SERVER_UTC && !/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? 'Z' : ''));
    return isNaN(d.getTime()) ? null : d;
};
const p2 = (n: number) => String(n).padStart(2, '0');
export const hm = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
export const dmy = (d: Date) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
export const dt = (s?: string | null) => { const d = parseServer(s); return d ? `${hm(d)} ${dmy(d)}` : '—'; };
export const ago = (s?: string | null) => {
    const d = parseServer(s); if (!d) return '—';
    const t = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
    if (t < 45) return 'vừa xong';
    if (t < 3600) return `${Math.round(t / 60)} phút trước`;
    if (t < 86400) return `${Math.floor(t / 3600)} giờ trước`;
    return `${Math.floor(t / 86400)} ngày trước`;
};
export const dur = (sec: number) => {
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    return d ? `${d} ngày ${h} giờ` : h ? `${h} giờ ${m} phút` : `${m} phút`;
};
export const bytes = (b: number) => {
    const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let x = b;
    while (x >= 1024 && i < 3) { x /= 1024; i++; }
    return `${x.toFixed(i > 1 ? 1 : i ? 1 : 0)} ${u[i]}`;
};
export const num = (n: number | null | undefined) => (n ?? 0).toLocaleString('vi-VN');
export const toLocalInput = (s?: string | null) => { const d = parseServer(s); return d ? `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}` : ''; };
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : '');

export function downloadCsv(name: string, head: string[], rows: (string | number | null | undefined)[][]) {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = '﻿' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

/* ---------------- nhãn ---------------- */
export const LEVEL: Record<string, { label: string; tone: string }> = {
    info: { label: 'Thông tin', tone: 'blue' }, warn: { label: 'Cảnh báo', tone: 'amber' },
    error: { label: 'Lỗi', tone: 'red' }, security: { label: 'Bảo mật', tone: 'violet' },
};
export const STATE: Record<string, { label: string; tone: string }> = {
    ok: { label: 'Bình thường', tone: 'green' }, warn: { label: 'Cần chú ý', tone: 'amber' },
    fail: { label: 'Sự cố', tone: 'red' }, skip: { label: 'Chưa có dữ liệu', tone: 'gray' },
};

/* ---------------- thành phần giao diện ---------------- */
export const Pill = ({ tone = 'gray', children, dot }: { tone?: string; children: React.ReactNode; dot?: boolean }) => (
    <span className={`hl-pill t-${tone}`}>{dot && <i />}{children}</span>
);

export const Card = ({ title, sub, right, children, className = '', flush }: { title?: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string; flush?: boolean }) => (
    <section className={`hl-card ${className}`}>
        {(title || right) && (
            <header className="hl-card-h">
                <div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
                {right && <div className="hl-card-r">{right}</div>}
            </header>
        )}
        <div className={flush ? 'hl-card-b flush' : 'hl-card-b'}>{children}</div>
    </section>
);

export const Empty = ({ icon = '✓', title, text }: { icon?: string; title: string; text?: string }) => (
    <div className="hl-empty"><b>{icon}</b><strong>{title}</strong>{text && <span>{text}</span>}</div>
);

export const Loading = ({ rows = 3 }: { rows?: number }) => (
    <div className="hl-skel">{Array.from({ length: rows }).map((_, i) => <i key={i} style={{ width: `${92 - i * 11}%` }} />)}</div>
);

export const ErrorBox = ({ msg, retry }: { msg: string; retry?: () => void }) => (
    <div className="hl-err"><b>!</b><div><strong>Không tải được dữ liệu</strong><span>{msg}</span></div>{retry && <button className="hl-btn" onClick={retry}>Thử lại</button>}</div>
);

export function Ring({ value, tone, size = 150, label }: { value: number; tone: string; size?: number; label?: string }) {
    const r = size / 2 - 11, c = 2 * Math.PI * r;
    return (
        <div className={`hl-ring t-${tone}`} style={{ width: size, height: size }}>
            <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
                <circle cx={size / 2} cy={size / 2} r={r} className="bg" />
                <circle cx={size / 2} cy={size / 2} r={r} className="fg" strokeDasharray={`${(c * value) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
            </svg>
            <div><b>{value}</b><small>{label ?? '/ 100 điểm'}</small></div>
        </div>
    );
}

export function Spark({ values, tone = 'blue', h = 34 }: { values: number[]; tone?: string; h?: number }) {
    if (values.length < 2) return <div className="hl-spark-empty" style={{ height: h }} />;
    const w = 120, max = Math.max(...values, 1), min = Math.min(...values, 0);
    const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 3 - ((v - min) / (max - min || 1)) * (h - 8)}`).join(' ');
    return <svg className={`hl-spark t-${tone}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" height={h}><polyline points={pts} /></svg>;
}

/** Biểu đồ cột (lượt request) + đường (thời gian TB) + chấm đỏ (lỗi) */
export function TrafficChart({ data, unit = 'giờ' }: { data: { t: string; n: number; avg: number; err: number }[]; unit?: 'giờ' | 'ngày' | string }) {
    const [hov, setHov] = useState<number | null>(null);
    const W = 720, H = 210, L = 38, R = 38, T = 14, B = 26;
    const maxN = Math.max(...data.map((d) => d.n), 1), maxA = Math.max(...data.map((d) => d.avg), 100);
    const bw = (W - L - R) / data.length;
    const x = (i: number) => L + i * bw + bw / 2;
    const yN = (v: number) => T + (H - T - B) * (1 - v / maxN);
    const yA = (v: number) => T + (H - T - B) * (1 - v / maxA);
    const line = data.map((d, i) => `${x(i)},${yA(d.avg)}`).join(' ');
    const label = (t: string) => { const d = parseServer(t); return d ? (unit === 'ngày' ? `${p2(d.getDate())}/${p2(d.getMonth() + 1)}` : `${p2(d.getHours())}h`) : ''; };
    const step = Math.ceil(data.length / 12);
    const h = hov !== null ? data[hov] : null;
    return (
        <div className="hl-chart">
            <svg viewBox={`0 0 ${W} ${H}`} onMouseLeave={() => setHov(null)}>
                {[0, 0.5, 1].map((f) => (<g key={f}><line x1={L} x2={W - R} y1={T + (H - T - B) * f} y2={T + (H - T - B) * f} className="grid" />
                    <text x={L - 6} y={T + (H - T - B) * f + 4} className="ax" textAnchor="end">{Math.round(maxN * (1 - f))}</text>
                    <text x={W - R + 6} y={T + (H - T - B) * f + 4} className="ax r" textAnchor="start">{Math.round(maxA * (1 - f))}</text></g>))}
                {data.map((d, i) => (
                    <g key={i} onMouseEnter={() => setHov(i)}>
                        <rect x={L + i * bw} y={T} width={bw} height={H - T - B} fill="transparent" />
                        <rect x={L + i * bw + bw * 0.18} width={bw * 0.64} y={yN(d.n)} height={Math.max(0, H - B - yN(d.n))} rx={3} className={`bar${hov === i ? ' on' : ''}`} />
                        {d.err > 0 && <circle cx={x(i)} cy={T + 4} r={4} className="errdot" />}
                        {i % step === 0 && <text x={x(i)} y={H - 8} className="ax" textAnchor="middle">{label(d.t)}</text>}
                    </g>
                ))}
                <polyline points={line} className="avgline" />
                {hov !== null && <circle cx={x(hov)} cy={yA(data[hov].avg)} r={4} className="avgdot" />}
            </svg>
            <div className="hl-chart-tip">
                {h ? (<><b>{label(h.t)}{unit === 'giờ' ? ` · ${dmy(parseServer(h.t) || new Date())}` : ''}</b><span>{num(h.n)} request</span><span>TB {h.avg} ms</span><span className={h.err ? 'bad' : ''}>{h.err} lỗi 5xx</span></>)
                    : (<><i className="k bar" />Lượt request <i className="k line" />Thời gian TB (ms) <i className="k err" />Có lỗi 5xx</>)}
            </div>
        </div>
    );
}

export function HBars({ items, tone = 'blue', fmt }: { items: { label: string; value: number; sub?: string; tone?: string }[]; tone?: string; fmt?: (n: number) => string }) {
    const max = Math.max(...items.map((i) => i.value), 1);
    return (
        <ul className="hl-hbars">
            {items.map((it, i) => (
                <li key={i}>
                    <div><span title={it.label}>{it.label}</span><b>{fmt ? fmt(it.value) : num(it.value)}</b></div>
                    <em><i className={`t-${it.tone || tone}`} style={{ width: `${Math.max(2, (it.value / max) * 100)}%` }} /></em>
                    {it.sub && <small>{it.sub}</small>}
                </li>
            ))}
        </ul>
    );
}

export function Modal({ title, onClose, children, foot, wide }: { title: string; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode; wide?: boolean }) {
    useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
    return (
        <div className="hl-ov" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className={`hl-modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true">
                <header><h3>{title}</h3><button onClick={onClose} aria-label="Đóng">×</button></header>
                <div className="hl-modal-b">{children}</div>
                {foot && <footer>{foot}</footer>}
            </div>
        </div>
    );
}

export function Confirm({ title, text, danger, okText = 'Xác nhận', onOk, onClose }: { title: string; text: React.ReactNode; danger?: boolean; okText?: string; onOk: () => void | Promise<void>; onClose: () => void }) {
    const [busy, setBusy] = useState(false);
    return (
        <Modal title={title} onClose={onClose} foot={<>
            <button className="hl-btn" onClick={onClose}>Hủy</button>
            <button className={`hl-btn ${danger ? 'danger' : 'primary'}`} disabled={busy} onClick={async () => { setBusy(true); try { await onOk(); } finally { setBusy(false); } }}>{busy ? 'Đang xử lý…' : okText}</button>
        </>}><p className="hl-p">{text}</p></Modal>
    );
}

export const Pager = ({ page, last, total, onPage }: { page: number; last: number; total: number; onPage: (p: number) => void }) => (
    <div className="hl-pager"><span>{num(total)} bản ghi</span>
        <div><button disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Trước</button><b>{page} / {last}</b><button disabled={page >= last} onClick={() => onPage(page + 1)}>Sau ›</button></div></div>
);

export const Field = ({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) => (
    <label className={`hl-field${error ? ' bad' : ''}`}><span>{label}</span>{children}{error ? <em>{error}</em> : hint ? <small>{hint}</small> : null}</label>
);

export const Tabs = ({ items, value, onChange }: { items: { key: string; label: string; n?: number }[]; value: string; onChange: (k: string) => void }) => (
    <div className="hl-tabs" role="tablist">{items.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} className={value === t.key ? 'on' : ''} onClick={() => onChange(t.key)}>{t.label}{t.n !== undefined && <i>{t.n}</i>}</button>))}</div>
);

/** Chặn thao tác ghi nếu không phải Quản trị */
export const WriteNote = () => { const { canWrite } = useMon(); return canWrite ? null : <div className="hl-note">Bạn đang xem ở chế độ chỉ đọc. Chỉ tài khoản <b>Quản trị hệ thống</b> mới được thao tác thay đổi.</div>; };