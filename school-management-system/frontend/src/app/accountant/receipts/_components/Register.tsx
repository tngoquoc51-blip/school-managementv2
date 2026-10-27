'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, downloadCsv, KtError, METHOD_TONE, qs, quickRange, Receipt, RegisterRes, RMeta, vnd } from '../_lib/rc';
import { Card, Chip, Empty, ErrorBox, Field, Loading, Modal, Pager, useApi } from '../../periods/_components/ui';
import { ReceiptModal } from '../../collection/_components/Receipt';

type Props = {
    meta: RMeta; refreshKey: number; onChanged: () => void;
    toast: { ok: (m: string) => void; fail: (m: string) => void };
};

const SORTS: [string, string][] = [['new', 'Mới nhất'], ['old', 'Cũ nhất'], ['amount_desc', 'Số tiền giảm dần'], ['amount_asc', 'Số tiền tăng dần']];

/** Sổ phiếu thu: tra cứu, lọc nhiều tiêu chí, in một hoặc nhiều phiếu, hủy phiếu, xuất Excel. */
export function Register({ meta, refreshKey, onChanged, toast }: Props) {
    const [q, setQ] = useState('');
    const [dq, setDq] = useState('');
    const [status, setStatus] = useState('valid');
    const [method, setMethod] = useState('');
    const [cashier, setCashier] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [yearId, setYearId] = useState('');
    const [periodId, setPeriodId] = useState('');
    const [grade, setGrade] = useState('');
    const [classId, setClassId] = useState('');
    const [min, setMin] = useState('');
    const [max, setMax] = useState('');
    const [sort, setSort] = useState('new');
    const [page, setPage] = useState(1);
    const [adv, setAdv] = useState(false);
    const [sel, setSel] = useState<number[]>([]);
    const [view, setView] = useState<number[] | null>(null);
    const [voidFor, setVoidFor] = useState<Receipt | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 350); return () => clearTimeout(t); }, [q]);
    const params = { q: dq, status, method, cashier, from, to, year_id: yearId, period_id: periodId, grade, class_id: classId, min, max, sort };
    const key = JSON.stringify(params);
    useEffect(() => { setPage(1); setSel([]); }, [key]);
    const res = useApi<RegisterRes>(`receipts${qs({ ...params, page })}`);
    useEffect(() => { if (refreshKey) res.reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refreshKey]);
    const d = res.data;
    const sm = d?.summary;
    const items = d?.items || [];
    const periods = useMemo(() => meta.periods.filter((p) => !yearId || String(p.year_id) === yearId), [meta, yearId]);
    const classes = useMemo(() => meta.classes.filter((c) => !grade || String(c.grade) === grade), [meta, grade]);
    const activeAdv = [yearId, periodId, grade, classId, min, max].filter(Boolean).length;
    const filtered = !!(dq || method || cashier || from || to || activeAdv || status !== 'valid');
    const allOn = items.length > 0 && items.every((r) => sel.includes(r.id));
    const selected = items.filter((r) => sel.includes(r.id));
    const selSum = selected.reduce((s, r) => s + r.amount, 0);

    const range = (k: 'today' | '7d' | 'month' | 'lastmonth') => { const [a, b] = quickRange(k); setFrom(a); setTo(b); };
    const reset = () => { setQ(''); setStatus('valid'); setMethod(''); setCashier(''); setFrom(''); setTo(''); setYearId(''); setPeriodId(''); setGrade(''); setClassId(''); setMin(''); setMax(''); setSort('new'); };

    const afterPrint = async (ids: number[]) => {
        try { await api('receipts/print', { method: 'POST', body: { ids } }); res.reload(); } catch { /* không chặn việc in */ }
    };
    const doVoid = async () => {
        if (!voidFor) return;
        setBusy(true); setErr('');
        try { await api(`cashier/payments/${voidFor.id}/void`, { method: 'POST', body: { reason } }); toast.ok(`Đã hủy phiếu ${voidFor.receipt_code}.`); setVoidFor(null); setReason(''); res.reload(); onChanged(); }
        catch (e) { setErr((e as KtError).message); } finally { setBusy(false); }
    };
    const exportCsv = async () => {
        setBusy(true);
        try {
            const rows: (string | number)[][] = [['Mã phiếu', 'Ngày thu', 'Giờ', 'Mã HS', 'Họ tên', 'Lớp', 'Hóa đơn', 'Đợt thu', 'Số tiền', 'Hình thức', 'Mã giao dịch', 'Người thu', 'Đối soát', 'Số lần in', 'Trạng thái', 'Ghi chú / lý do']];
            let p = 1; let pages = 1;
            do {
                const r = await api<RegisterRes>(`receipts${qs({ ...params, page: p, per_page: 500 })}`);
                pages = r.pages;
                r.items.forEach((x) => rows.push([x.receipt_code, x.day.split('-').reverse().join('/'), (x.confirmed_at || x.paid_at || '').slice(0, 5), x.student.code, x.student.name, x.student.class || '', x.invoice.code, x.period?.name || '', x.amount, x.method_label, x.reference || '', x.cashier || '',
                    x.needs_recon ? (x.recon ? 'Đã đối soát' : 'Chưa đối soát') : '', x.prints, x.status === 'voided' ? 'Đã hủy' : 'Hợp lệ', x.reason || x.note || '']));
                p++;
            } while (p <= pages && p <= 20);
            downloadCsv(`so-phieu-thu-${new Date().toISOString().slice(0, 10)}.csv`, rows);
            toast.ok(`Đã xuất ${rows.length - 1} phiếu.`);
        } catch (e) { toast.fail((e as KtError).message); } finally { setBusy(false); }
    };

    return (
        <>
            <Card pad={false} title="Sổ phiếu thu"
                  right={<div className="pd-head-act"><button className="pd-btn ghost sm" disabled={busy || !d || d.total === 0} onClick={exportCsv}>Xuất Excel (CSV)</button><Link href="/accountant/collection" className="pd-btn sm">+ Lập phiếu thu</Link></div>}>
                <div className="pd-inv-bar rc-filters">
                    <div className="pd-filters" style={{ flex: '1 1 100%' }}>
                        <input className="pd-in" aria-label="Tìm phiếu thu" placeholder="Tìm số phiếu, mã giao dịch, mã hoặc tên học sinh, mã hóa đơn…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '3 1 300px' }} />
                        <select className="pd-in" aria-label="Hình thức" value={method} onChange={(e) => setMethod(e.target.value)}><option value="">Mọi hình thức</option>{meta.methods.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
                        <select className="pd-in" aria-label="Người thu" value={cashier} onChange={(e) => setCashier(e.target.value)}><option value="">Mọi người thu</option>{meta.cashiers.map((x) => <option key={x}>{x}</option>)}</select>
                        <input className="pd-in" type="date" aria-label="Từ ngày" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
                        <input className="pd-in" type="date" aria-label="Đến ngày" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
                    </div>
                    <div className="rc-row">
                        <div className="pd-chips" role="group" aria-label="Trạng thái phiếu">
                            {([['valid', 'Hợp lệ', sm?.valid.count], ['voided', 'Đã hủy', sm?.voided.count], ['all', 'Tất cả', sm ? sm.valid.count + sm.voided.count : undefined]] as [string, string, number | undefined][]).map(([k, l, n]) => (
                                <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}{n !== undefined ? <em>{n.toLocaleString('vi-VN')}</em> : null}</button>
                            ))}
                        </div>
                        <div className="pd-quick" style={{ marginTop: 0 }}>
                            <button onClick={() => range('today')}>Hôm nay</button><button onClick={() => range('7d')}>7 ngày qua</button><button onClick={() => range('month')}>Tháng này</button><button onClick={() => range('lastmonth')}>Tháng trước</button>
                            <button className={adv ? 'rc-on' : ''} onClick={() => setAdv((v) => !v)}>Bộ lọc nâng cao{activeAdv ? ` (${activeAdv})` : ''} {adv ? '▴' : '▾'}</button>
                            {filtered && <button onClick={reset}>Xóa bộ lọc</button>}
                        </div>
                    </div>
                    {adv && (
                        <div className="rc-adv">
                            <Field label="Năm học" htmlFor="rc-y"><select id="rc-y" className="pd-in" value={yearId} onChange={(e) => { setYearId(e.target.value); setPeriodId(''); }}><option value="">Tất cả năm học</option>{meta.years.map((y) => <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' (hiện tại)' : ''}</option>)}</select></Field>
                            <Field label="Đợt thu" htmlFor="rc-p"><select id="rc-p" className="pd-in" value={periodId} onChange={(e) => setPeriodId(e.target.value)}><option value="">Tất cả đợt thu</option>{periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
                            <Field label="Khối" htmlFor="rc-g"><select id="rc-g" className="pd-in" value={grade} onChange={(e) => { setGrade(e.target.value); setClassId(''); }}><option value="">Mọi khối</option>{meta.grades.map((g) => <option key={g} value={g}>Khối {g}</option>)}</select></Field>
                            <Field label="Lớp (năm học hiện tại)" htmlFor="rc-c"><select id="rc-c" className="pd-in" value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">Mọi lớp</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                            <Field label="Số tiền từ (đ)" htmlFor="rc-mn"><input id="rc-mn" className="pd-in" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} placeholder="0" /></Field>
                            <Field label="Đến (đ)" htmlFor="rc-mx"><input id="rc-mx" className="pd-in" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} placeholder="Không giới hạn" /></Field>
                            <Field label="Sắp xếp" htmlFor="rc-s"><select id="rc-s" className="pd-in" value={sort} onChange={(e) => setSort(e.target.value)}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
                        </div>
                    )}
                </div>

                {sel.length > 0 && (
                    <div className="rc-selbar" role="status">
                        <span><b>{sel.length}</b> phiếu đã chọn · tổng <b>{vnd(selSum)}</b></span>
                        <div>
                            <button className="pd-btn sm" disabled={sel.length > 50} onClick={() => setView(sel)}>In {sel.length} phiếu</button>
                            <button className="pd-btn ghost sm" onClick={() => setSel([])}>Bỏ chọn</button>
                            {sel.length > 50 && <small className="bad">Mỗi lần in tối đa 50 phiếu</small>}
                        </div>
                    </div>
                )}

                {res.loading && !d && <Loading />}
                {res.err && <ErrorBox msg={res.err} retry={res.reload} />}
                {d && (items.length === 0 ? <Empty text={filtered ? 'Không có phiếu thu nào khớp bộ lọc.' : 'Chưa có phiếu thu nào. Phiếu thu được tạo khi thu tiền ở trang Thu học phí.'} /> : (
                    <div className="pd-tw">
                        <table className="pd-table rc-table">
                            <thead><tr>
                                <th style={{ width: 34 }}><input type="checkbox" aria-label="Chọn tất cả phiếu trên trang" checked={allOn} onChange={() => setSel(allOn ? [] : items.map((r) => r.id))} /></th>
                                <th>Số phiếu</th><th>Học sinh</th><th>Hóa đơn / đợt thu</th><th className="n">Số tiền</th><th>Hình thức</th><th>Thời điểm / người thu</th><th>Trạng thái</th><th style={{ width: 120 }} /></tr></thead>
                            <tbody>
                            {items.map((r) => (
                                <tr key={r.id} className={r.status === 'voided' ? 'rc-void' : ''}>
                                    <td><input type="checkbox" aria-label={`Chọn phiếu ${r.receipt_code}`} checked={sel.includes(r.id)} onChange={() => setSel((s) => s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id])} /></td>
                                    <td><button className="cl-link mono" onClick={() => setView([r.id])}>{r.receipt_code}</button></td>
                                    <td><Link href={`/accountant/collection?student=${r.student.id}`} title="Mở quầy thu của học sinh này"><b>{r.student.name}</b></Link><small>{r.student.code} · {r.student.class || '—'}</small></td>
                                    <td><span className="pd-mono">{r.invoice.code}</span>{r.period && <small>{r.period.name}</small>}</td>
                                    <td className="n"><b className={r.status === 'voided' ? 'cl-strike' : ''}>{vnd(r.amount)}</b></td>
                                    <td><Chip tone={METHOD_TONE[r.method] || 'mut'}>{r.method_label}</Chip>{r.reference && <small className="pd-mono">{r.reference}</small>}</td>
                                    <td>{r.confirmed_at || r.paid_at}<small>{r.cashier}</small></td>
                                    <td>
                                        {r.status === 'voided' ? <Chip tone="mut">Đã hủy phiếu</Chip> : <Chip tone="ok">Hợp lệ</Chip>}
                                        {r.status === 'voided' && r.reason && <small>{r.reason}</small>}
                                        {r.needs_recon && <small className={r.recon ? 'ok' : 'warn'}>{r.recon ? `Đã đối soát · ${r.recon.by}` : 'Chưa đối soát'}</small>}
                                        {r.prints > 1 && <small>Đã in {r.prints} lần</small>}
                                    </td>
                                    <td><div className="cl-rowact">
                                        <button className="pd-btn ghost sm" onClick={() => setView([r.id])}>{r.status === 'valid' ? 'Xem / In' : 'Xem'}</button>
                                        {r.can_void && <button className="pd-btn danger sm" onClick={() => { setErr(''); setReason(''); setVoidFor(r); }}>Hủy</button>}
                                    </div></td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                ))}
                {d && (
                    <div className="pd-tfoot">
                        <span>{d.total.toLocaleString('vi-VN')} phiếu · tổng <b>{vnd(d.filtered_amount)}</b></span>
                        <Pager page={page} pages={d.pages} onChange={setPage} />
                    </div>
                )}
            </Card>

            {view && <ReceiptModal ids={view} title={view.length > 1 ? `In ${view.length} phiếu thu` : 'Phiếu thu'} onClose={() => setView(null)} onPrint={afterPrint} />}
            {voidFor && (
                <Modal title="Hủy phiếu thu" onClose={() => !busy && setVoidFor(null)}
                       foot={<><button className="pd-btn ghost" disabled={busy} onClick={() => setVoidFor(null)}>Không hủy</button><button className="pd-btn danger" disabled={busy || reason.trim().length < 5} onClick={doVoid}>{busy ? 'Đang hủy…' : 'Hủy phiếu thu'}</button></>}>
                    <p>Hủy phiếu <b className="pd-mono">{voidFor.receipt_code}</b> · <b>{vnd(voidFor.amount)}</b> của <b>{voidFor.student.name}</b>. Công nợ của hóa đơn <span className="pd-mono">{voidFor.invoice.code}</span> sẽ tăng lại {vnd(voidFor.amount)}.</p>
                    <Field label="Lý do hủy phiếu" hint="Bắt buộc, từ 5 đến 180 ký tự. Được lưu vào nhật ký." htmlFor="rc-vr"><textarea id="rc-vr" className="pd-in" rows={3} maxLength={180} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
                    <div className="pd-quick">{['Thu nhầm hóa đơn', 'Nhập sai số tiền', 'Phụ huynh yêu cầu hủy', 'Lập trùng phiếu'].map((x) => <button key={x} onClick={() => setReason(x)}>{x}</button>)}</div>
                    <p className="pd-muted">Kế toán chỉ hủy được phiếu trong ngày. Phiếu của ngày trước do Hiệu trưởng hoặc Phó hiệu trưởng hủy.</p>
                    {err && <div className="pd-alert err" role="alert">{err}</div>}
                </Modal>
            )}
        </>
    );
}