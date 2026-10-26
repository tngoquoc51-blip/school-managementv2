'use client';
import { useEffect, useState } from 'react';
import { api, Dispute, KtError, Meta, PayRow, qs, vnd } from '../_lib/cash';
import { Card, Chip, Empty, ErrorBox, Field, Loading, Modal, Pager, useApi } from '../../periods/_components/ui';
import { ReceiptModal } from './Receipt';

type Props = {
    meta: Meta; initialQ: string; initialSub: 'pay' | 'disp';
    onOpenStudent: (id: number) => void; onChanged: () => void;
    toast: { ok: (m: string) => void; fail: (m: string) => void };
};

const REJECT_QUICK = ['Không thấy tiền về tài khoản nhà trường', 'Số tiền chuyển không khớp với khai báo', 'Mã giao dịch không đúng', 'Khai báo trùng với khoản đã thu'];
const REPLY_QUICK = ['Phòng Kế toán đã kiểm tra lại, hóa đơn đúng theo quy định của đợt thu.', 'Phòng Kế toán đã ghi nhận và sẽ điều chỉnh. Em vui lòng kiểm tra lại sau 1 ngày làm việc.', 'Em vui lòng mang theo biên lai đến phòng Kế toán (tầng 1 nhà A) để đối chiếu.'];

export function Queue({ meta, initialQ, initialSub, onOpenStudent, onChanged, toast }: Props) {
    const [sub, setSub] = useState<'pay' | 'disp'>(initialSub);
    useEffect(() => setSub(initialSub), [initialSub]);
    return (
        <>
            <PaySection sub={sub} setSub={setSub} meta={meta} initialQ={initialQ} onOpenStudent={onOpenStudent} onChanged={onChanged} toast={toast} />
            {sub === 'disp' && <DisputeSection onOpenStudent={onOpenStudent} onChanged={onChanged} toast={toast} />}
        </>
    );
}

function SubTabs({ sub, setSub, pendingN, dispN }: { sub: string; setSub: (s: 'pay' | 'disp') => void; pendingN?: number; dispN?: number }) {
    return (
        <div className="pd-tabs solo" role="tablist">
            <button role="tab" aria-selected={sub === 'pay'} className={sub === 'pay' ? 'on' : ''} onClick={() => setSub('pay')}>Khoản học sinh khai báo{pendingN ? <em>{pendingN}</em> : null}</button>
            <button role="tab" aria-selected={sub === 'disp'} className={sub === 'disp' ? 'on' : ''} onClick={() => setSub('disp')}>Phản hồi về hóa đơn{dispN ? <em>{dispN}</em> : null}</button>
        </div>
    );
}

/* ================= khoản chờ xác nhận ================= */
function PaySection({ sub, setSub, meta, initialQ, onOpenStudent, onChanged, toast }: Omit<Props, 'initialSub'> & { sub: 'pay' | 'disp'; setSub: (s: 'pay' | 'disp') => void }) {
    const [q, setQ] = useState(initialQ);
    const [dq, setDq] = useState(initialQ);
    const [method, setMethod] = useState('');
    const [page, setPage] = useState(1);
    const [checked, setChecked] = useState<number[]>([]);
    const [confirm, setConfirm] = useState<PayRow | null>(null);
    const [reject, setReject] = useState<PayRow | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [receipt, setReceipt] = useState<number[] | null>(null);
    useEffect(() => { setQ(initialQ); setDq(initialQ); }, [initialQ]);
    useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 350); return () => clearTimeout(t); }, [q]);
    useEffect(() => { setPage(1); setChecked([]); }, [dq, method]);
    const res = useApi<{ items: PayRow[]; total: number; amount: number; pages: number }>(`cashier/pending${qs({ q: dq, method, page })}`);
    const disp = useApi<{ counts: { open: number } }>('cashier/disputes?status=open');
    const items = res.data?.items || [];
    const allOn = items.length > 0 && items.every((p) => checked.includes(p.id));
    const sumChecked = items.filter((p) => checked.includes(p.id)).reduce((s, p) => s + p.amount, 0);

    const doConfirm = async (p: PayRow) => {
        setBusy(true); setErr('');
        try { await api(`cashier/payments/${p.id}/confirm`, { method: 'POST' }); toast.ok(`Đã xác nhận ${vnd(p.amount)} của ${p.student.name}.`); setConfirm(null); setReceipt([p.id]); res.reload(); onChanged(); }
        catch (e) { setErr((e as KtError).message); } finally { setBusy(false); }
    };
    const doReject = async (p: PayRow) => {
        setBusy(true); setErr('');
        try { await api(`cashier/payments/${p.id}/reject`, { method: 'POST', body: { reason } }); toast.ok('Đã từ chối khoản thanh toán.'); setReject(null); setReason(''); res.reload(); onChanged(); }
        catch (e) { setErr((e as KtError).message); } finally { setBusy(false); }
    };
    const bulk = async () => {
        setBusy(true);
        try {
            const r = await api<{ confirmed: number[]; failed: { id: number; message: string }[] }>('cashier/payments/bulk-confirm', { method: 'POST', body: { ids: checked } });
            if (r.failed.length) toast.fail(`Xác nhận ${r.confirmed.length} khoản. ${r.failed.length} khoản không được: ${r.failed[0].message}`); else toast.ok(`Đã xác nhận ${r.confirmed.length} khoản.`);
            setChecked([]); res.reload(); onChanged();
        } catch (e) { toast.fail((e as KtError).message); } finally { setBusy(false); }
    };

    return (
        <>
            <SubTabs sub={sub} setSub={setSub} pendingN={res.data && !dq && !method ? res.data.total : undefined} dispN={disp.data?.counts.open} />
            {sub === 'pay' && (
                <Card pad={false} title="Khoản chờ đối chiếu"
                      right={res.data ? <span className="pd-muted">{res.data.total} khoản · {vnd(res.data.amount)}</span> : undefined}>
                    <div className="pd-inv-bar">
                        <div className="pd-filters" style={{ flex: '1 1 340px' }}>
                            <input className="pd-in" aria-label="Tìm khoản chờ xác nhận" placeholder="Tìm theo tên, mã học sinh, mã giao dịch, mã hóa đơn…" value={q} onChange={(e) => setQ(e.target.value)} />
                            <select className="pd-in" aria-label="Hình thức" value={method} onChange={(e) => setMethod(e.target.value)} style={{ flex: '0 1 170px' }}>
                                <option value="">Mọi hình thức</option>{meta.methods.filter((m) => m.needs_ref).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                            </select>
                        </div>
                        {checked.length > 0 && <button className="pd-btn sm" disabled={busy} onClick={bulk}>Xác nhận {checked.length} khoản ({vnd(sumChecked)})</button>}
                    </div>
                    <p className="pd-note cl-note">Đối chiếu từng khoản với sao kê ngân hàng trước khi xác nhận. Khoản được xác nhận sẽ tính vào công nợ ngay và học sinh nhận được phiếu thu.</p>
                    {res.loading && !res.data && <Loading />}
                    {res.err && <ErrorBox msg={res.err} retry={res.reload} />}
                    {res.data && (items.length === 0
                        ? <Empty text={dq || method ? 'Không có khoản nào khớp bộ lọc.' : 'Không có khoản nào đang chờ. Mọi khoản học sinh khai báo đã được xử lý.'} />
                        : (
                            <div className="pd-tw">
                                <table className="pd-table">
                                    <thead><tr>
                                        <th style={{ width: 34 }}><input type="checkbox" aria-label="Chọn tất cả" checked={allOn} onChange={() => setChecked(allOn ? [] : items.map((p) => p.id))} /></th>
                                        <th>Học sinh</th><th>Hóa đơn</th><th className="n">Số tiền khai báo</th><th>Hình thức / mã GD</th><th>Thời điểm chuyển</th><th style={{ width: 210 }} /></tr></thead>
                                    <tbody>
                                    {items.map((p) => (
                                        <tr key={p.id}>
                                            <td><input type="checkbox" aria-label={`Chọn ${p.receipt_code}`} checked={checked.includes(p.id)} onChange={() => setChecked((c) => c.includes(p.id) ? c.filter((x) => x !== p.id) : [...c, p.id])} /></td>
                                            <td><button className="cl-link" onClick={() => onOpenStudent(p.student.id)}><b>{p.student.name}</b></button><small>{p.student.code} · {p.student.class || '—'}</small></td>
                                            <td><span className="pd-mono">{p.invoice.code}</span><small>Còn phải thu {vnd(p.invoice.balance)}</small></td>
                                            <td className="n"><b>{vnd(p.amount)}</b>{p.amount > (p.invoice.balance ?? 0) && <small className="bad">Vượt số còn phải thu</small>}</td>
                                            <td>{p.method_label}<small className="pd-mono">{p.reference}</small></td>
                                            <td>{p.paid_at}{p.wait_days > 0 && <small className={p.wait_days >= 3 ? 'bad' : 'warn'}>Chờ {p.wait_days} ngày</small>}{p.note && <small>“{p.note}”</small>}</td>
                                            <td><div className="cl-rowact"><button className="pd-btn sm" onClick={() => { setErr(''); setConfirm(p); }}>Xác nhận</button><button className="pd-btn danger sm" onClick={() => { setErr(''); setReason(''); setReject(p); }}>Từ chối</button></div></td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    {res.data && res.data.pages > 1 && <div className="pd-tfoot"><span>Trang {page}/{res.data.pages}</span><Pager page={page} pages={res.data.pages} onChange={setPage} /></div>}
                </Card>
            )}

            {confirm && (
                <Modal title="Xác nhận khoản thanh toán" onClose={() => !busy && setConfirm(null)}
                       foot={<><button className="pd-btn ghost" disabled={busy} onClick={() => setConfirm(null)}>Để sau</button><button className="pd-btn" disabled={busy} onClick={() => doConfirm(confirm)}>{busy ? 'Đang xử lý…' : 'Đã đối chiếu, xác nhận'}</button></>}>
                    <dl className="pd-dl">
                        <div><dt>Học sinh</dt><dd><b>{confirm.student.name}</b> · {confirm.student.code} · {confirm.student.class || '—'}</dd></div>
                        <div><dt>Hóa đơn</dt><dd>{confirm.invoice.title} <span className="pd-mono">({confirm.invoice.code})</span></dd></div>
                        <div><dt>Số tiền</dt><dd><b>{vnd(confirm.amount)}</b> · hóa đơn còn phải thu {vnd(confirm.invoice.balance)}</dd></div>
                        <div><dt>Hình thức</dt><dd>{confirm.method_label} · mã GD <span className="pd-mono">{confirm.reference}</span></dd></div>
                        <div><dt>Thời điểm chuyển</dt><dd>{confirm.paid_at}</dd></div>
                        {confirm.note && <div><dt>Ghi chú của HS</dt><dd>{confirm.note}</dd></div>}
                    </dl>
                    <p className="pd-muted">Hãy mở sao kê ngân hàng và kiểm tra có đúng số tiền, đúng mã giao dịch này trước khi xác nhận.</p>
                    {err && <div className="pd-alert err" role="alert">{err}</div>}
                </Modal>
            )}
            {reject && (
                <Modal title="Từ chối khoản thanh toán" onClose={() => !busy && setReject(null)}
                       foot={<><button className="pd-btn ghost" disabled={busy} onClick={() => setReject(null)}>Hủy</button><button className="pd-btn danger" disabled={busy || reason.trim().length < 5} onClick={() => doReject(reject)}>{busy ? 'Đang xử lý…' : 'Từ chối khoản này'}</button></>}>
                    <p>Từ chối <b>{vnd(reject.amount)}</b> của <b>{reject.student.name}</b> (mã GD <span className="pd-mono">{reject.reference}</span>). Học sinh sẽ thấy lý do ở cổng học phí và có thể khai báo lại.</p>
                    <Field label="Lý do từ chối" hint="Từ 5 đến 200 ký tự" htmlFor="cl-rj"><textarea id="cl-rj" className="pd-in" rows={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
                    <div className="pd-quick">{REJECT_QUICK.map((r) => <button key={r} onClick={() => setReason(r)}>{r}</button>)}</div>
                    {err && <div className="pd-alert err" role="alert">{err}</div>}
                </Modal>
            )}
            {receipt && <ReceiptModal ids={receipt} title="Phiếu thu đã xác nhận" onClose={() => setReceipt(null)} />}
        </>
    );
}

/* ================= phản hồi hóa đơn ================= */
function DisputeSection({ onOpenStudent, onChanged, toast }: Pick<Props, 'onOpenStudent' | 'onChanged' | 'toast'>) {
    const [st, setSt] = useState<'open' | 'answered'>('open');
    const res = useApi<{ items: (Dispute & { student: { id: number; code: string; name: string } })[]; counts: { open: number; answered: number } }>(`cashier/disputes${qs({ status: st })}`);
    const [target, setTarget] = useState<Dispute | null>(null);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const send = async () => {
        if (!target) return;
        setBusy(true); setErr('');
        try { await api(`cashier/disputes/${target.id}/reply`, { method: 'POST', body: { reply: text } }); toast.ok('Đã gửi trả lời cho học sinh.'); setTarget(null); setText(''); res.reload(); onChanged(); }
        catch (e) { setErr((e as KtError).message); } finally { setBusy(false); }
    };
    return (
        <Card title="Phản hồi của học sinh về hóa đơn" pad={false}
              right={<div className="pd-chips">{(['open', 'answered'] as const).map((k) => <button key={k} className={st === k ? 'on' : ''} onClick={() => setSt(k)}>{k === 'open' ? 'Chưa trả lời' : 'Đã trả lời'}{res.data && <em>{res.data.counts[k]}</em>}</button>)}</div>}>
            {res.loading && !res.data && <Loading />}
            {res.err && <ErrorBox msg={res.err} retry={res.reload} />}
            {res.data && (res.data.items.length === 0
                ? <Empty text={st === 'open' ? 'Không có phản hồi nào đang chờ trả lời.' : 'Chưa có phản hồi nào được trả lời.'} />
                : (
                    <ul className="cl-disp">
                        {res.data.items.map((d) => (
                            <li key={d.id}>
                                <div className="cl-disp-h">
                                    <button className="cl-link" onClick={() => onOpenStudent(d.student.id)}><b>{d.student.name}</b></button>
                                    <span className="pd-muted">{d.student.code} · hóa đơn <span className="pd-mono">{d.invoice_code}</span> · {d.created_at}</span>
                                    <Chip tone={d.status === 'open' ? 'warn' : 'ok'}>{d.status === 'open' ? 'Chưa trả lời' : 'Đã trả lời'}</Chip>
                                </div>
                                <p className="cl-quote">“{d.message}”</p>
                                {d.reply && <p className="cl-reply"><b>{d.replied_by}</b> · {d.replied_at}<br />{d.reply}</p>}
                                {d.status === 'open' && <button className="pd-btn sm" onClick={() => { setErr(''); setText(''); setTarget(d); }}>Trả lời</button>}
                            </li>
                        ))}
                    </ul>
                ))}
            {target && (
                <Modal title="Trả lời phản hồi của học sinh" onClose={() => !busy && setTarget(null)}
                       foot={<><button className="pd-btn ghost" disabled={busy} onClick={() => setTarget(null)}>Hủy</button><button className="pd-btn" disabled={busy || text.trim().length < 5} onClick={send}>{busy ? 'Đang gửi…' : 'Gửi trả lời'}</button></>}>
                    <p className="cl-quote">“{target.message}”</p>
                    <Field label="Nội dung trả lời" hint="Từ 5 đến 1000 ký tự. Học sinh xem được ở cổng học phí." htmlFor="cl-rp"><textarea id="cl-rp" className="pd-in" rows={4} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} /></Field>
                    <div className="pd-quick">{REPLY_QUICK.map((r) => <button key={r} onClick={() => setText(r)}>{r.length > 48 ? r.slice(0, 48) + '…' : r}</button>)}</div>
                    {err && <div className="pd-alert err" role="alert">{err}</div>}
                </Modal>
            )}
        </Card>
    );
}