'use client';

import { useState } from 'react';
import { apiError, finApi } from '@/services/adminFinanceService';
import { useToast } from '@/components/Toast';
import { Empty, ErrorBox, Icon, Modal, Skeleton, Spin, fmtDate, fmtDateTime, short, useFetch, vnd } from '../ui';
import type { Filters, PeriodRow } from '../types';
import s from '../finance.module.css';

const TERMS: Record<string, string> = { YEAR: 'Cả năm', HK1: 'Học kỳ 1', HK2: 'Học kỳ 2' };
const CAT: Record<string, string> = { tuition: 'Học phí', insurance: 'Bảo hiểm', fund: 'Quỹ', service: 'Dịch vụ', uniform: 'Đồng phục', other: 'Khác' };
const ST: Record<string, [string, string]> = { open: ['Đang thu', s.bOk], closed: ['Đã đóng', s.bMute], draft: ['Nháp', s.bInfo], cancelled: ['Đã hủy', s.bBad] };

export default function PeriodsTab({ f, onChanged }: { f: Filters; onChanged: () => void }) {
    const toast = useToast();
    const periods = useFetch(() => finApi.periods(f.year_id), [f.year_id]);
    const items = useFetch(() => finApi.feeItems(), []);
    const [ask, setAsk] = useState<PeriodRow | null>(null); const [view, setView] = useState<PeriodRow | null>(null); const [busy, setBusy] = useState(false);

    async function toggle() {
        if (!ask) return; const to = ask.status === 'open' ? 'closed' : 'open'; setBusy(true);
        try { await finApi.setPeriodStatus(ask.id, to); toast.success(to === 'closed' ? 'Đã đóng đợt thu' : 'Đã mở lại đợt thu', ask.name || ask.code); setAsk(null); await periods.reload(); onChanged(); }
        catch (e) { toast.error('Không đổi được trạng thái', apiError(e).message); } finally { setBusy(false); }
    }

    return (
        <div className={`${s.panel} ${s.stack}`}>
            <section className={s.card}>
                <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="calendar" /> Đợt thu</h3><div className={s.cardSub}>Đóng đợt để chốt sổ; mở lại khi cần thu bổ sung</div></div></div>
                {periods.error && !periods.data ? <ErrorBox message={periods.error} onRetry={periods.reload} /> : !periods.data ? <Skeleton h={48} n={4} /> : periods.data.length === 0 ? <Empty icon="🗓️" text="Năm học này chưa có đợt thu." /> : (
                    <div className={s.scroll}>
                        <table className={s.table}>
                            <thead><tr><th>Đợt thu</th><th>Kỳ</th><th>Thời hạn</th><th className={s.num}>Hóa đơn</th><th className={s.num}>Phải thu</th><th style={{ minWidth: 170 }}>Đã thu</th><th>Trạng thái</th><th /></tr></thead>
                            <tbody>{periods.data.map((p) => { const rate = p.invoiced ? Math.round((p.paid / p.invoiced) * 100) : 0; const [lb, cl] = ST[p.status] || [p.status, s.bMute]; return (
                                <tr key={p.id}>
                                    <td><b>{p.name || p.code}</b><div className={s.cardSub}>{p.code}</div></td><td>{TERMS[p.term] || p.term}</td>
                                    <td>{fmtDate(p.open_date)} → {fmtDate(p.due_date)}</td><td className={s.num}>{p.invoices_n}</td><td className={s.num}>{vnd(p.invoiced)}</td>
                                    <td><div className={s.bar}><div className={s.barFill} style={{ width: `${rate}%` }} /></div><div className={s.cardSub}>{short(p.paid)} ({rate}%) · còn {short(p.remaining)}</div></td>
                                    <td><span className={`${s.badge} ${cl}`}>{lb}</span>{p.closed_by && p.status === 'closed' && <div className={s.cardSub}>{p.closed_by}</div>}</td>
                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                        <button className={`${s.btn} ${s.btnS}`} onClick={() => setView(p)}>Chi tiết</button>{' '}
                                        {(p.status === 'open' || p.status === 'closed') && <button className={`${s.btn} ${s.btnS} ${p.status === 'open' ? s.btnD : ''}`} onClick={() => setAsk(p)}>{p.status === 'open' ? 'Đóng đợt' : 'Mở lại'}</button>}</td>
                                </tr>); })}</tbody>
                        </table>
                    </div>)}
            </section>

            <section className={s.card}>
                <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="money" /> Bảng giá các khoản thu</h3><div className={s.cardSub}>Danh mục khoản thu do Phòng Kế toán quản lý</div></div></div>
                {items.error && !items.data ? <ErrorBox message={items.error} onRetry={items.reload} /> : !items.data ? <Skeleton h={40} n={4} /> : (
                    <div className={s.scroll}><table className={s.table}>
                        <thead><tr><th>Mã</th><th>Khoản thu</th><th>Nhóm</th><th>Đơn vị</th><th>Khối</th><th className={s.num}>Mức thu</th><th>Bắt buộc</th></tr></thead>
                        <tbody>{items.data.map((x) => (
                            <tr key={x.id}><td><b>{x.code}</b></td><td>{x.name}{x.note && <div className={s.cardSub}>{x.note}</div>}</td><td><span className={`${s.badge} ${s.bInfo}`}>{CAT[x.category] || x.category}</span></td>
                                <td>{x.unit || '—'}</td><td>{x.grade ? `Khối ${x.grade}` : 'Tất cả'}</td><td className={s.num}><b>{vnd(x.amount)}</b></td>
                                <td>{Number(x.is_mandatory) ? <span className={`${s.badge} ${s.bWarn}`}>Bắt buộc</span> : <span className={`${s.badge} ${s.bMute}`}>Tự nguyện</span>}</td></tr>))}</tbody></table></div>)}
            </section>

            {ask && (
                <Modal title={ask.status === 'open' ? 'Đóng đợt thu?' : 'Mở lại đợt thu?'} onClose={() => setAsk(null)}>
                    <p>{ask.status === 'open' ? <>Đóng đợt <b>{ask.name || ask.code}</b>: còn <b>{vnd(ask.remaining)}</b> chưa thu. Hệ thống ghi nhận người đóng và thời điểm đóng.</> : <>Mở lại đợt <b>{ask.name || ask.code}</b> để tiếp tục thu tiền?</>}</p>
                    <div className={s.modalFoot}><button className={s.btn} onClick={() => setAsk(null)}>Hủy</button><button className={`${s.btn} ${ask.status === 'open' ? s.btnD : s.btnP}`} disabled={busy} onClick={toggle}>{busy && <Spin />} {ask.status === 'open' ? 'Đóng đợt' : 'Mở lại'}</button></div>
                </Modal>)}
            {view && (
                <Modal title={view.name || view.code} wide onClose={() => setView(null)}>
                    <div className={s.sumRow}>
                        <div className={s.sumBox}><b>{view.invoices_n}</b><span>Hóa đơn</span></div><div className={s.sumBox}><b>{vnd(view.invoiced)}</b><span>Phải thu</span></div>
                        <div className={s.sumBox}><b>{vnd(view.paid)}</b><span>Đã thu</span></div><div className={s.sumBox}><b style={{ color: 'var(--bad)' }}>{vnd(view.remaining)}</b><span>Còn lại</span></div>
                    </div>
                    <div className={s.cardSub} style={{ marginBottom: 10 }}>{TERMS[view.term] || view.term} · Mở {fmtDate(view.open_date)} · Hạn {fmtDate(view.due_date)}{view.closed_at ? ` · Đóng ${fmtDateTime(view.closed_at)} bởi ${view.closed_by || '—'}` : ''}{view.note ? ` · ${view.note}` : ''}</div>
                    <h4 style={{ margin: '4px 0 8px' }}>Các khoản thu trong đợt</h4>
                    {view.items.length === 0 ? <div className={s.cardSub}>Chưa cấu hình khoản thu cho đợt này.</div> : (
                        <table className={s.table}><thead><tr><th>Mã</th><th>Khoản thu</th><th>Nhóm</th><th className={s.num}>Mức thu</th></tr></thead>
                            <tbody>{view.items.map((x) => <tr key={x.code}><td><b>{x.code}</b></td><td>{x.name}</td><td>{CAT[x.category] || x.category}</td><td className={s.num}>{vnd(x.amount)}</td></tr>)}</tbody></table>)}
                </Modal>)}
        </div>
    );
}