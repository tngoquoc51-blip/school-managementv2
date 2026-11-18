'use client';
// Thư viện dùng chung cho module Tài chính & Học phí của Admin (/admin/finance)
// Dùng lại bộ thành phần giao diện của module Điểm danh (teacher/attendance/_ta.tsx) để cùng một phong cách.
import React, { createContext, useContext, useState } from 'react';
import { Btn, Confirm, Drawer, Empty, ErrorBox, Ico, Loading, Pill, tapi, dt, fmtD, num, useLoad, useTa } from '../../teacher/attendance/_ta';

export {
    Avatar, Bar, Btn, Card, Confirm, Donut, Drawer, Empty, ErrorBox, Field, Ico, Loading, Modal, Pager, Pill, Ring, Seg, Switch, Tabs, TaContext,
    addDays, dt, fmtD, fmtS, longDate, monthStart, num, pct, qs, todayStr, useDebounced, useLoad, useTa, ymd,
} from '../../teacher/attendance/_ta';

/** Tên quản trị viên đang đăng nhập (chỉ để hiển thị) */
export const adminName = (): string => {
    try { for (const k of ['user', 'admin_user', 'current_user']) { const v = localStorage.getItem(k); if (!v) continue; const u = JSON.parse(v); const n = u?.full_name || u?.name || u?.username || u?.email; if (n) return String(n); } } catch { /* bỏ qua */ }
    return 'Quản trị viên';
};

/** Gọi API tài chính: /api/admin/finance/... (trả về nguyên JSON máy chủ) */
export const fi = <T,>(path: string, o: { method?: string; body?: unknown } = {}) => tapi<unknown>(`admin/finance/${path}`, o) as unknown as Promise<T>;

/* ---------------- kiểu dữ liệu ---------------- */
export type Meta = {
    years: { id: number; label: string; current: boolean }[]; year_id: number; today: string; classes: { id: number; name: string; grade: number }[];
    categories: Record<string, string>; methods: Record<string, string>; terms: Record<string, string>; expense_categories: Record<string, string>;
};
export type FiCtx = { meta: Meta; yearId: number; setYearId: (n: number) => void };
export const FiContext = createContext<FiCtx | null>(null);
export const useFi = () => { const c = useContext(FiContext); if (!c) throw new Error('FiContext'); return c; };
export type Page = { total: number; page: number; per: number; pages: number };
export type Invoice = {
    id: number; code: string; title: string; term: string; term_label: string; student_id: number; scode: string; sname: string; class_id: number | null; class_name: string | null; grade: number | null;
    issue_date: string | null; due_date: string | null; subtotal: number; discount: number; total: number; paid: number; pending: number; balance: number; status: 'paid' | 'partial' | 'unpaid' | 'cancelled'; overdue_days: number;
};

/* ---------------- tiền & nhãn ---------------- */
export const vnd = (n: number | null | undefined) => `${(n ?? 0).toLocaleString('vi-VN')} ₫`;
export const short = (n: number | null | undefined) => {
    const v = n ?? 0, a = Math.abs(v);
    if (a >= 1e9) return `${(v / 1e9).toFixed(2).replace('.', ',')} tỷ`;
    if (a >= 1e6) return `${(v / 1e6).toFixed(1).replace('.', ',').replace(',0', '')} tr`;
    if (a >= 1e3) return `${Math.round(v / 1e3).toLocaleString('vi-VN')} k`;
    return String(v);
};
export const INV_ST: Record<string, { label: string; tone: string }> = {
    paid: { label: 'Đã thu đủ', tone: 'green' }, partial: { label: 'Thu một phần', tone: 'amber' }, unpaid: { label: 'Chưa thu', tone: 'rose' }, cancelled: { label: 'Đã hủy', tone: 'slate' },
};
export const PAY_ST: Record<string, { label: string; tone: string }> = {
    confirmed: { label: 'Đã xác nhận', tone: 'green' }, pending: { label: 'Chờ xác nhận', tone: 'amber' }, rejected: { label: 'Từ chối', tone: 'rose' }, cancelled: { label: 'Đã hủy', tone: 'slate' },
};
export const METHOD_ICON: Record<string, string> = { cash: 'coin', bank_transfer: 'school', card: 'tpl', ewallet: 'phone' };
export const rateTone = (r: number) => (r >= 90 ? 'green' : r >= 70 ? 'amber' : 'rose');
export const gradeLabel = (g: number | null | undefined) => (g ? `Khối ${g}` : 'Chưa xếp lớp');

export function InvStatus({ i }: { i: Pick<Invoice, 'status' | 'overdue_days'> }) {
    const s = INV_ST[i.status];
    return <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}><Pill tone={s.tone} dot>{s.label}</Pill>{i.overdue_days > 0 && <Pill tone="rose">Quá hạn {i.overdue_days} ngày</Pill>}</span>;
}

/* ---------------- xuất CSV (Excel mở được tiếng Việt) ---------------- */
export function downloadCsv(name: string, head: string[], rows: (string | number | null | undefined)[][]) {
    const esc = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const text = '﻿' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------------- biểu đồ ---------------- */
export function AreaChart({ points, height = 200, color = '#059669' }: { points: { label: string; value: number }[]; height?: number; color?: string }) {
    const W = 760, H = height, pl = 46, pr = 12, pt = 14, pb = 26;
    const max = Math.max(1, ...points.map((p) => p.value)); const nice = Math.pow(10, Math.floor(Math.log10(max))); const top = Math.ceil(max / nice) * nice;
    const x = (i: number) => pl + (points.length <= 1 ? 0 : (i * (W - pl - pr)) / (points.length - 1)); const y = (v: number) => pt + (1 - v / top) * (H - pt - pb);
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const area = `${line} L${x(points.length - 1).toFixed(1)},${H - pb} L${x(0).toFixed(1)},${H - pb} Z`;
    const gid = `ag${color.replace('#', '')}`;
    return (
        <svg className="fi-area" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Biểu đồ thu theo ngày">
            <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".32" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
            {[0, 1, 2, 3, 4].map((k) => { const v = (top * k) / 4; return <g key={k}><line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} className="gl" /><text x={pl - 6} y={y(v) + 4} textAnchor="end" className="gt">{short(v)}</text></g>; })}
            <path d={area} fill={`url(#${gid})`} /><path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {points.map((p, i) => <g key={i}><circle cx={x(i)} cy={y(p.value)} r="9" fill="transparent"><title>{`${p.label}: ${vnd(p.value)}`}</title></circle>{p.value > 0 && <circle cx={x(i)} cy={y(p.value)} r="3" fill="#fff" stroke={color} strokeWidth="2" pointerEvents="none" />}</g>)}
            {points.map((p, i) => (i % Math.ceil(points.length / 8) === 0 ? <text key={`l${i}`} x={x(i)} y={H - 7} textAnchor="middle" className="gt">{p.label}</text> : null))}
        </svg>
    );
}
export function GroupBars({ items, aLabel, bLabel, aColor = '#0ea5e9', bColor = '#059669', height = 170 }: { items: { label: string; a: number; b: number }[]; aLabel: string; bLabel: string; aColor?: string; bColor?: string; height?: number }) {
    const max = Math.max(1, ...items.flatMap((i) => [i.a, i.b]));
    return (
        <div>
            <div className="fi-legend"><span><i style={{ background: aColor }} />{aLabel}</span><span><i style={{ background: bColor }} />{bLabel}</span></div>
            <div className="fi-gb" style={{ height }}>
                {items.map((it) => (
                    <div key={it.label} title={`${it.label}\n${aLabel}: ${vnd(it.a)}\n${bLabel}: ${vnd(it.b)}`}>
                        <div className="bars"><i style={{ height: `${(it.a / max) * 100}%`, background: aColor }} /><i style={{ height: `${(it.b / max) * 100}%`, background: bColor }} /></div>
                        <small>{it.label}</small>
                    </div>
                ))}
            </div>
        </div>
    );
}
export function HBars({ items, tone = 'green' }: { items: { label: string; sub?: string; value: number; of?: number; right?: string }[]; tone?: string }) {
    const max = Math.max(1, ...items.map((i) => i.of ?? i.value));
    return <div className="fi-hb">{items.map((i) => (
        <div key={i.label}><span>{i.label}{i.sub && <small>{i.sub}</small>}</span><div className="trk"><i className={`t-${tone}`} style={{ width: `${Math.min(100, (i.value / max) * 100)}%` }} /></div><b>{i.right ?? short(i.value)}</b></div>
    ))}</div>;
}
/** Thanh nhiều đoạn (ví dụ: đã thu đủ / một phần / chưa thu) */
export function Segs({ items }: { items: { label: string; n: number; color: string }[] }) {
    const t = items.reduce((s, i) => s + i.n, 0) || 1;
    return (
        <div><div className="fi-segs">{items.map((i) => (i.n > 0 ? <i key={i.label} style={{ width: `${(i.n / t) * 100}%`, background: i.color }} title={`${i.label}: ${i.n}`} /> : null))}</div>
            <div className="fi-legend">{items.map((i) => <span key={i.label}><i style={{ background: i.color }} />{i.label} <b>{num(i.n)}</b></span>)}</div></div>
    );
}

/* ---------------- ngăn chi tiết hóa đơn (dùng chung nhiều trang) ---------------- */
type Detail = Invoice & {
    lines: { id: number; description: string; category_label: string; quantity: number; unit_price: number; discount: number; amount: number }[];
    payments: { id: number; code: string; amount: number; method_label: string; reference: string | null; note: string | null; status: string; paid_at: string | null; confirmed_by: string | null; reject_reason: string | null }[];
    disputes: { id: number; message: string; status: string; reply: string | null; replied_by: string | null; created_at: string | null }[];
    waivers: { id: number; label: string; percent: number; note: string | null }[];
};
export function InvoiceDrawer({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged?: () => void }) {
    const { toast } = useTa();
    const { data, err, loading, reload } = useLoad(() => fi<{ data: Detail }>(`invoices/${id}`), [id]);
    const [cancel, setCancel] = useState(false);
    const d = data?.data;
    return (
        <>
            <Drawer onClose={onClose} title={d ? `Hóa đơn ${d.code}` : 'Hóa đơn'} sub={d ? `${d.sname} · ${d.scode}${d.class_name ? ` · Lớp ${d.class_name}` : ''}` : undefined}
                    foot={d && d.status !== 'cancelled' ? <Btn tone="danger" onClick={() => setCancel(true)}><Ico n="trash" size={15} />Hủy hóa đơn</Btn> : undefined}>
                {loading && !d ? <Loading /> : err || !d ? <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /> : (
                    <div className="fi-dr">
                        <div className="fi-dr-top"><InvStatus i={d} /><span className="ta-mute">{d.title} · {d.term_label}</span></div>
                        <div className="fi-mini3"><div><small>Tổng phải thu</small><b>{vnd(d.total)}</b></div><div className="g"><small>Đã thu</small><b>{vnd(d.paid)}</b></div><div className={d.balance > 0 ? 'r' : 'g'}><small>Còn nợ</small><b>{vnd(d.balance)}</b></div></div>
                        <p className="ta-mute">Ngày phát hành {fmtD(d.issue_date)} · Hạn nộp <b style={{ color: d.overdue_days > 0 ? '#be123c' : undefined }}>{fmtD(d.due_date)}</b>{d.pending > 0 && <> · Đang chờ xác nhận {vnd(d.pending)}</>}</p>
                        <h4 className="fi-h4">Chi tiết khoản thu</h4>
                        <div className="ta-tablewrap"><table className="ta-tbl"><thead><tr><th>Khoản</th><th>SL</th><th>Đơn giá</th><th>Giảm</th><th>Thành tiền</th></tr></thead><tbody>
                        {d.lines.map((l) => <tr key={l.id}><td>{l.description}<small>{l.category_label}</small></td><td>{l.quantity}</td><td>{num(l.unit_price)}</td><td>{l.discount ? num(l.discount) : '—'}</td><td><b>{num(l.amount)}</b></td></tr>)}
                        {d.lines.length === 0 && <tr><td colSpan={5} className="ta-mute">Hóa đơn chưa có dòng chi tiết.</td></tr>}</tbody></table></div>
                        {d.waivers.length > 0 && <><h4 className="fi-h4">Miễn giảm của học sinh</h4>{d.waivers.map((w) => <div key={w.id} className="fi-note"><b>{w.label}</b> – giảm {w.percent}%{w.note ? ` · ${w.note}` : ''}</div>)}</>}
                        <h4 className="fi-h4">Lịch sử thanh toán ({d.payments.length})</h4>
                        {d.payments.length === 0 ? <p className="ta-mute">Chưa có phiếu thu nào.</p> : <ul className="fi-pays">{d.payments.map((p) => (
                            <li key={p.id}><div><b>{vnd(p.amount)}</b><small>{p.code} · {p.method_label}{p.reference ? ` · ${p.reference}` : ''}</small>{p.reject_reason && <small style={{ color: '#be123c' }}>Lý do từ chối: {p.reject_reason}</small>}</div>
                                <div style={{ textAlign: 'right' }}><Pill tone={PAY_ST[p.status]?.tone || 'gray'} dot>{PAY_ST[p.status]?.label || p.status}</Pill><small>{dt(p.paid_at)}</small></div></li>))}</ul>}
                        {d.disputes.length > 0 && <><h4 className="fi-h4">Khiếu nại</h4>{d.disputes.map((x) => <div key={x.id} className="fi-note"><b>{x.status === 'open' ? 'Đang chờ trả lời' : 'Đã trả lời'}:</b> {x.message}{x.reply && <p>↳ {x.replied_by}: {x.reply}</p>}</div>)}</>}
                    </div>
                )}
            </Drawer>
            {cancel && d && <Confirm title="Hủy hóa đơn này?" tone="danger" okText="Hủy hóa đơn" noteLabel="Lý do hủy" noteRequired
                                     text={<>Hóa đơn <b>{d.code}</b> của <b>{d.sname}</b> ({vnd(d.total)}) sẽ chuyển sang “Đã hủy” và không còn tính vào công nợ. Chỉ hủy được khi chưa có phiếu thu.</>}
                                     onClose={() => setCancel(false)} onOk={async (note) => { await fi(`invoices/${d.id}/cancel`, { method: 'POST', body: { reason: note } }); toast('Đã hủy hóa đơn.'); setCancel(false); onChanged?.(); reload(); }} />}
        </>
    );
}

export const EmptyRow = ({ cols, text = 'Không có dữ liệu phù hợp.' }: { cols: number; text?: string }) => <tr><td colSpan={cols}><Empty icon="search" title={text} /></td></tr>;