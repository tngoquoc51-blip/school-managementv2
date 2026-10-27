'use client';
import { useEffect, useState } from 'react';
import { api, downloadCsv, KtError, Meta, PAY_STATUS, PayRow, qs, vnd } from '../_lib/cash';
import { Card, Chip, Empty, ErrorBox, Field, Loading, Modal, Pager, useApi, Stat, Ico, ICON } from '../../periods/_components/ui';
import { ReceiptModal } from './Receipt';

type Res = { items: PayRow[]; total: number; page: number; pages: number; counts: Record<string, number>; amounts: Record<string, number> };
type Props = {
    meta: Meta; refreshKey: number; onOpenStudent: (id: number) => void; onChanged: () => void;
    toast: { ok: (m: string) => void; fail: (m: string) => void };
};

const CHIPS: [string, string][] = [['', 'Tất cả'], ['confirmed', 'Đã thu'], ['pending', 'Chờ xác nhận'], ['rejected', 'Đã từ chối'], ['voided', 'Đã hủy phiếu']];

export function History({ meta, refreshKey, onOpenStudent, onChanged, toast }: Props) {
    const [q, setQ] = useState('');
    const [dq, setDq] = useState('');
    const [status, setStatus] = useState('');
    const [method, setMethod] = useState('');
    const [cashier, setCashier] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [page, setPage] = useState(1);
    const [view, setView] = useState<number | null>(null);
    const [voidFor, setVoidFor] = useState<PayRow | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 350); return () => clearTimeout(t); }, [q]);
    useEffect(() => setPage(1), [dq, status, method, cashier, from, to]);
    const params = { q: dq, status, method, cashier, from, to };
    const res = useApi<Res>(`cashier/payments${qs({ ...params, page })}`);
    useEffect(() => { if (refreshKey) res.reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refreshKey]);
    const c = res.data?.counts; const a = res.data?.amounts;
    const filtered = !!(dq || status || method || cashier || from || to);

    const setRange = (days: number) => {
        const d = new Date(); const e = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
        const f = new Date(); f.setDate(f.getDate() - days); setFrom(e(f)); setTo(e(d));
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
            const rows: (string | number)[][] = [['Mã phiếu', 'Thời điểm', 'Mã HS', 'Họ tên', 'Lớp', 'Hóa đơn', 'Số tiền', 'Hình thức', 'Mã giao dịch', 'Người thu / duyệt', 'Trạng thái', 'Ghi chú / lý do']];
            let p = 1; let pages = 1;
            do {
                const r = await api<Res>(`cashier/payments${qs({ ...params, page: p, per_page: 500 })}`);
                pages = r.pages;
                r.items.forEach((x) => rows.push([x.receipt_code, x.confirmed_at || x.paid_at || '', x.student.code, x.student.name, x.student.class || '', x.invoice.code, x.amount, x.method_label, x.reference || '', x.confirmed_by || '', PAY_STATUS[x.status]?.label || x.status, x.reason || x.note || '']));
                p++;
            } while (p <= pages && p <= 20);
            downloadCsv(`lich-su-phieu-thu-${new Date().toISOString().slice(0, 10)}.csv`, rows);
            toast.ok(`Đã xuất ${rows.length - 1} dòng.`);
        } catch (e) { toast.fail((e as KtError).message); } finally { setBusy(false); }
    };

    return (
        <>
            <div className="pd-stats">
                <Stat label="Đã thu" value={vnd(a?.confirmed ?? 0)} hint={`${c?.confirmed ?? 0} phiếu`} tone="ok" icon={<Ico d={ICON.check} />} />
                <Stat label="Chờ xác nhận" value={vnd(a?.pending ?? 0)} hint={`${c?.pending ?? 0} khoản`} tone="warn" icon={<Ico d={ICON.hourglass} />} />
                <Stat label="Đã từ chối" value={vnd(a?.rejected ?? 0)} hint={`${c?.rejected ?? 0} khoản`} tone="err" icon={<Ico d={ICON.alert} />} />
                <Stat label="Đã hủy phiếu" value={vnd(a?.voided ?? 0)} hint={`${c?.voided ?? 0} phiếu`} tone="mut" icon={<Ico d={ICON.doc} />} />
            </div>
            <Card pad={false} title="Lịch sử phiếu thu" right={<button className="pd-btn ghost sm" disabled={busy || !res.data || res.data.total === 0} onClick={exportCsv}>Xuất Excel (CSV)</button>}>
                <div className="pd-inv-bar cl-hfilter">
                    <div className="pd-filters" style={{ flex: '1 1 100%' }}>
                        <input className="pd-in" aria-label="Tìm phiếu thu" placeholder="Tìm mã phiếu, mã giao dịch, mã hoặc tên học sinh, mã hóa đơn…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '2 1 280px' }} />
                        <select className="pd-in" aria-label="Hình thức" value={method} onChange={(e) => setMethod(e.target.value)}><option value="">Mọi hình thức</option>{meta.methods.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
                        <select className="pd-in" aria-label="Người thu" value={cashier} onChange={(e) => setCashier(e.target.value)}><option value="">Mọi người thu</option>{meta.cashiers.map((x) => <option key={x}>{x}</option>)}</select>
                        <input className="pd-in" type="date" aria-label="Từ ngày" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
                        <input className="pd-in" type="date" aria-label="Đến ngày" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
                    </div>
                    <div className="pd-chips" role="group" aria-label="Trạng thái">
                        {CHIPS.map(([k, l]) => <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}{c && k ? <em>{c[k] ?? 0}</em> : null}</button>)}
                    </div>
                    <div className="pd-quick" style={{ marginTop: 0 }}>
                        <button onClick={() => setRange(0)}>Hôm nay</button><button onClick={() => setRange(6)}>7 ngày qua</button><button onClick={() => setRange(29)}>30 ngày qua</button>
                        {filtered && <button onClick={() => { setQ(''); setStatus(''); setMethod(''); setCashier(''); setFrom(''); setTo(''); }}>Xóa bộ lọc</button>}
                    </div>
                </div>
                {res.loading && !res.data && <Loading />}
                {res.err && <ErrorBox msg={res.err} retry={res.reload} />}
                {res.data && (res.data.items.length === 0 ? <Empty text="Không có phiếu thu nào khớp bộ lọc." /> : (
                    <div className="pd-tw">
                        <table className="pd-table">
                            <thead><tr><th>Mã phiếu</th><th>Học sinh</th><th>Hóa đơn</th><th className="n">Số tiền</th><th>Hình thức</th><th>Thời điểm</th><th>Trạng thái</th><th style={{ width: 130 }} /></tr></thead>
                            <tbody>
                            {res.data.items.map((p) => (
                                <tr key={p.id}>
                                    <td><button className="cl-link mono" onClick={() => setView(p.id)}>{p.receipt_code}</button></td>
                                    <td><button className="cl-link" onClick={() => onOpenStudent(p.student.id)}><b>{p.student.name}</b></button><small>{p.student.code} · {p.student.class || '—'}</small></td>
                                    <td className="pd-mono">{p.invoice.code}</td>
                                    <td className="n"><b className={p.status === 'voided' || p.status === 'rejected' ? 'cl-strike' : ''}>{vnd(p.amount)}</b></td>
                                    <td>{p.method_label}{p.reference && <small className="pd-mono">{p.reference}</small>}</td>
                                    <td>{p.confirmed_at || p.paid_at}{p.confirmed_by && <small>{p.confirmed_by}</small>}</td>
                                    <td><Chip tone={PAY_STATUS[p.status]?.tone}>{PAY_STATUS[p.status]?.label}</Chip>{p.reason && <small>{p.reason}</small>}</td>
                                    <td><div className="cl-rowact">
                                        <button className="pd-btn ghost sm" onClick={() => setView(p.id)}>{p.status === 'confirmed' ? 'In phiếu' : 'Xem'}</button>
                                        {p.can_void && <button className="pd-btn danger sm" onClick={() => { setErr(''); setReason(''); setVoidFor(p); }}>Hủy</button>}
                                    </div></td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                ))}
                {res.data && <div className="pd-tfoot"><span>{res.data.total.toLocaleString('vi-VN')} bản ghi</span><Pager page={page} pages={res.data.pages} onChange={setPage} /></div>}
            </Card>

            {view && <ReceiptModal ids={[view]} onClose={() => setView(null)} />}
            {voidFor && (
                <Modal title="Hủy phiếu thu" onClose={() => !busy && setVoidFor(null)}
                       foot={<><button className="pd-btn ghost" disabled={busy} onClick={() => setVoidFor(null)}>Không hủy</button><button className="pd-btn danger" disabled={busy || reason.trim().length < 5} onClick={doVoid}>{busy ? 'Đang hủy…' : 'Hủy phiếu thu'}</button></>}>
                    <p>Hủy phiếu <b className="pd-mono">{voidFor.receipt_code}</b> · <b>{vnd(voidFor.amount)}</b> của <b>{voidFor.student.name}</b>. Công nợ của hóa đơn <span className="pd-mono">{voidFor.invoice.code}</span> sẽ được tính lại (tăng {vnd(voidFor.amount)}).</p>
                    <Field label="Lý do hủy phiếu" hint="Bắt buộc, từ 5 đến 180 ký tự. Được lưu vào nhật ký." htmlFor="cl-vr"><textarea id="cl-vr" className="pd-in" rows={3} maxLength={180} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
                    <div className="pd-quick">{['Thu nhầm hóa đơn', 'Nhập sai số tiền', 'Phụ huynh yêu cầu hủy', 'Lập trùng phiếu'].map((r) => <button key={r} onClick={() => setReason(r)}>{r}</button>)}</div>
                    <p className="pd-muted">Kế toán chỉ hủy được phiếu trong ngày. Phiếu của ngày trước do Hiệu trưởng hoặc Phó hiệu trưởng hủy.</p>
                    {err && <div className="pd-alert err" role="alert">{err}</div>}
                </Modal>
            )}
        </>
    );
}