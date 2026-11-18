'use client';

import { useEffect, useState } from 'react';
import { apiError, finApi } from '@/services/adminFinanceService';
import { useToast } from '@/components/Toast';
import { Empty, ErrorBox, Field, Icon, Modal, Pager, Skeleton, Spin, fmtDate, fmtDateTime, fp, overdueBadge, useDebounced, useFetch, vnd } from '../ui';
import type { DebtRow, Filters } from '../types';
import s from '../finance.module.css';

const KIND: Record<string, string> = { note: 'Ghi chú', contact: 'Đã liên hệ', promise: 'Hẹn trả' };
const CHANNEL: Record<string, string> = { phone: 'Điện thoại', zalo: 'Zalo', sms: 'SMS', direct: 'Gặp trực tiếp', email: 'Email', other: 'Khác' };
const NSTATUS: Record<string, [string, string]> = { open: ['Đang chờ', s.bWarn], kept: ['Đã giữ lời', s.bOk], broken: ['Lỡ hẹn', s.bBad], cancelled: ['Đã hủy', s.bMute], done: ['', s.bMute] };

export default function DebtsTab({ f, onChanged }: { f: Filters; onChanged: () => void }) {
    const toast = useToast();
    const [qIn, setQIn] = useState(''); const q = useDebounced(qIn);
    const [minDays, setMinDays] = useState(0); const [page, setPage] = useState(1);
    const [note, setNote] = useState<DebtRow | null>(null); const [exporting, setExporting] = useState(false);
    const key = JSON.stringify(f);
    useEffect(() => { setPage(1); }, [key, q, minDays]);
    const { data, loading, error, reload } = useFetch(() => finApi.debts(fp(f, { q, min_days: minDays, page, per_page: 15 })), [key, q, minDays, page]);

    async function exportCsv() {
        setExporting(true);
        try { await finApi.exportDebts(fp(f, { q, min_days: minDays })); toast.success('Đã xuất file công nợ', 'Mở bằng Excel để xem.'); }
        catch (e) { toast.error('Không xuất được file', apiError(e).message); } finally { setExporting(false); }
    }

    return (
        <div className={s.panel}>
            <section className={s.card}>
                <div className={s.cardHead}>
                    <div><h3 className={s.cardTitle}><Icon n="alert" /> Công nợ học sinh</h3><div className={s.cardSub}>Sắp xếp theo số tiền nợ giảm dần</div></div>
                    <button className={s.btn} onClick={exportCsv} disabled={exporting}>{exporting ? <Spin /> : <Icon n="download" size={16} />} Xuất Excel (CSV)</button>
                </div>
                {data && (
                    <div className={s.sumRow}>
                        <div className={s.sumBox}><b>{data.summary.students}</b><span>Học sinh còn nợ</span></div>
                        <div className={s.sumBox}><b style={{ color: 'var(--bad)' }}>{vnd(data.summary.debt)}</b><span>Tổng công nợ</span></div>
                        <div className={s.sumBox}><b>{data.summary.over90}</b><span>Nợ quá hạn từ 90 ngày</span></div>
                    </div>)}
                <div className={s.toolbar}>
                    <input className={s.input} style={{ minWidth: 240 }} placeholder="Tìm học sinh, mã HS…" value={qIn} onChange={(e) => setQIn(e.target.value)} />
                    <select className={s.select} value={minDays} onChange={(e) => setMinDays(Number(e.target.value))}>
                        <option value={0}>Mọi mức quá hạn</option><option value={1}>Đã quá hạn</option><option value={30}>Quá hạn từ 30 ngày</option><option value={60}>Quá hạn từ 60 ngày</option><option value={90}>Quá hạn từ 90 ngày</option><option value={180}>Quá hạn từ 180 ngày</option>
                    </select>
                </div>
                {error && !data ? <ErrorBox message={error} onRetry={reload} /> : !data ? <Skeleton h={48} n={6} /> : data.data.length === 0 ? <Empty icon="🎉" text="Không có học sinh nào còn nợ theo bộ lọc này." /> : (
                    <div className={s.scroll} style={{ opacity: loading ? 0.6 : 1 }}>
                        <table className={s.table}>
                            <thead><tr><th>Học sinh</th><th>Lớp</th><th className={s.num}>Hóa đơn nợ</th><th className={s.num}>Tổng nợ</th><th>Quá hạn</th><th>Hẹn trả</th><th /></tr></thead>
                            <tbody>{data.data.map((d) => (
                                <tr key={d.student_id}>
                                    <td><b>{d.student_name}</b><div className={s.cardSub}>{d.student_code}</div></td><td>{d.class_name || '—'}</td>
                                    <td className={s.num}>{d.invoices_n}</td><td className={s.num}><b style={{ color: 'var(--bad)' }}>{vnd(d.debt)}</b></td>
                                    <td>{overdueBadge(d.max_overdue) || <span className={`${s.badge} ${s.bOk}`}>Chưa quá hạn</span>}</td>
                                    <td>{d.promise_date ? <span className={`${s.badge} ${s.bInfo}`}>{fmtDate(d.promise_date)}</span> : <span className={s.cardSub}>—</span>}</td>
                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><button className={`${s.btn} ${s.btnS}`} onClick={() => setNote(d)}><Icon n="chat" size={14} /> Liên hệ{d.notes_n ? ` (${d.notes_n})` : ''}</button></td>
                                </tr>))}</tbody>
                        </table>
                    </div>)}
                {data && <Pager page={data.current_page} last={data.last_page} total={data.total} onPage={setPage} busy={loading} />}
            </section>
            {note && <NotesModal row={note} onClose={() => setNote(null)} onSaved={() => { reload(); onChanged(); }} />}
        </div>
    );
}

function NotesModal({ row, onClose, onSaved }: { row: DebtRow; onClose: () => void; onSaved: () => void }) {
    const toast = useToast();
    const { data, loading, reload } = useFetch(() => finApi.notes(row.student_id), [row.student_id]);
    const [f, setF] = useState({ kind: 'contact', channel: 'phone', note: '', promise_date: '', promise_amount: '' });
    const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);

    async function save() {
        setBusy(true); setErrs({});
        try {
            await finApi.addNote(row.student_id, { kind: f.kind, channel: f.channel, note: f.note, promise_date: f.kind === 'promise' ? f.promise_date : undefined, promise_amount: f.kind === 'promise' && f.promise_amount ? Number(f.promise_amount) : undefined });
            toast.success('Đã lưu ghi chú'); setF({ ...f, note: '', promise_date: '', promise_amount: '' }); await reload(); onSaved();
        } catch (e) { const r = apiError(e); setErrs(r.fields); toast.error('Không lưu được', r.message); } finally { setBusy(false); }
    }
    async function resolve(id: number, status: 'kept' | 'broken' | 'cancelled') {
        try { await finApi.resolveNote(id, status); toast.success('Đã cập nhật lịch hẹn'); await reload(); onSaved(); } catch (e) { toast.error('Không cập nhật được', apiError(e).message); }
    }

    return (
        <Modal title={`Liên hệ phụ huynh – ${row.student_name}`} wide onClose={onClose}>
            <div className={s.cardSub} style={{ marginBottom: 12 }}>{row.student_code} · Lớp {row.class_name || '—'} · Đang nợ <b style={{ color: 'var(--bad)' }}>{vnd(row.debt)}</b></div>
            <div className={s.card} style={{ boxShadow: 'none', marginBottom: 16 }}>
                <div className={s.row2}>
                    <Field label="Loại"><select className={s.select} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                    <Field label="Hình thức"><select className={s.select} value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>{Object.entries(CHANNEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                </div>
                {f.kind === 'promise' && (
                    <div className={s.row2}>
                        <Field label="Ngày hẹn trả" required error={errs.promise_date}><input type="date" className={s.input} value={f.promise_date} onChange={(e) => setF({ ...f, promise_date: e.target.value })} /></Field>
                        <Field label="Số tiền hẹn trả (₫)" error={errs.promise_amount}><input className={s.input} inputMode="numeric" value={f.promise_amount} onChange={(e) => setF({ ...f, promise_amount: e.target.value.replace(/\D/g, '') })} /></Field>
                    </div>)}
                <Field label="Nội dung" required error={errs.note}><textarea className={`${s.textarea} ${errs.note ? s.invalid : ''}`} style={{ minHeight: 70 }} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="VD: Đã gọi cho phụ huynh, hẹn nộp trước ngày 20" /></Field>
                <div className={s.modalFoot}><button className={`${s.btn} ${s.btnP}`} disabled={busy || !f.note.trim() || (f.kind === 'promise' && !f.promise_date)} onClick={save}>{busy ? <Spin /> : <Icon n="plus" size={16} />} Lưu ghi chú</button></div>
            </div>
            <h4 style={{ margin: '0 0 8px' }}>Lịch sử liên hệ</h4>
            {loading ? <Skeleton h={50} n={2} /> : !data?.length ? <div className={s.cardSub}>Chưa có ghi chú nào.</div> : data.map((n) => { const [lb, cl] = NSTATUS[n.status] || ['', s.bMute]; return (
                <div key={n.id} className={s.noteItem}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b>{KIND[n.kind] || n.kind}</b>{n.channel && <span className={`${s.badge} ${s.bMute}`}>{CHANNEL[n.channel] || n.channel}</span>}{lb && <span className={`${s.badge} ${cl}`}>{lb}</span>}</div>
                    <div style={{ margin: '4px 0' }}>{n.note}</div>
                    {n.kind === 'promise' && <div className={s.cardSub}>Hẹn trả {fmtDate(n.promise_date)}{n.promise_amount ? ` · ${vnd(n.promise_amount)}` : ''}</div>}
                    <div className={s.cardSub}>{n.created_by} · {fmtDateTime(n.created_at)}</div>
                    {n.kind === 'promise' && n.status === 'open' && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button className={`${s.btn} ${s.btnS}`} onClick={() => resolve(n.id, 'kept')}>Đã giữ lời</button>
                            <button className={`${s.btn} ${s.btnS} ${s.btnD}`} onClick={() => resolve(n.id, 'broken')}>Lỡ hẹn</button>
                            <button className={`${s.btn} ${s.btnS}`} onClick={() => resolve(n.id, 'cancelled')}>Hủy hẹn</button></div>)}
                </div>); })}
        </Modal>
    );
}