'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { errMsg, get, send } from './api';
import { CHANNEL_LABEL, fdate, fdt, METHOD_LABEL, num, TERM_LABEL, vnd, vndWords } from './format';
import { useSession } from './session';
import { notifyChanged } from './Shell';
import { useToast } from './Toast';
import type { Bank, DebtNote, Dispute, Invoice, InvoiceDetail, Receipt, Waiver } from './types';
import { Field, Icon, InvChip, Modal, MoneyInput, PayChip, Skeleton, Spinner } from './ui';

function Footer({ onClose, busy, label, tone = 'pri', disabled, form }: { onClose: () => void; busy: boolean; label: ReactNode; tone?: string; disabled?: boolean; form: string }) {
    return (
        <>
            <button type="button" className="fx-btn" onClick={onClose}>Hủy</button>
            <button type="submit" form={form} className={`fx-btn ${tone}`} disabled={busy || disabled}>{busy && <Spinner />} {label}</button>
        </>
    );
}

/* ====================== Mã QR chuyển khoản (VietQR) ====================== */
export function QrBox({ bank, amount, content }: { bank: Bank; amount: number; content: string }) {
    if (!bank.bank_bin || !bank.account_no) return null;
    const src = `https://img.vietqr.io/image/${bank.bank_bin}-${bank.account_no}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(content)}&accountName=${encodeURIComponent(bank.account_name || '')}`;
    return (
        <div className="fx-qr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="Mã QR chuyển khoản" />
            <div className="fx-col" style={{ gap: 4 }}>
                <b>Quét mã để chuyển khoản</b>
                <span className="fx-small">{bank.bank_name}</span>
                <span>STK: <b className="fx-num">{bank.account_no}</b></span>
                <span className="fx-small">Chủ TK: {bank.account_name}</span>
                <span className="fx-small">Số tiền: <b>{vnd(amount)}</b></span>
                <span className="fx-small">Nội dung: <b>{content}</b></span>
                {bank.demo_note && <span className="fx-tag w" style={{ whiteSpace: 'normal' }}>{bank.demo_note}</span>}
            </div>
        </div>
    );
}

/* ====================== Thu tiền ====================== */
export function CollectModal({ studentId, invoices, invoiceId, onClose, onDone }: {
    studentId: number; invoices: Invoice[]; invoiceId?: number | null; onClose: () => void; onDone: (paymentId: number) => void;
}) {
    const { meta } = useSession();
    const toast = useToast();
    const open = invoices.filter((i) => i.payable > 0);
    const [inv, setInv] = useState<number>(invoiceId && open.some((i) => i.id === invoiceId) ? invoiceId : open[0]?.id || 0);
    const cur = open.find((i) => i.id === inv);
    const [amount, setAmount] = useState<number | ''>(cur?.payable || '');
    const [method, setMethod] = useState('cash');
    const [ref, setRef] = useState('');
    const [note, setNote] = useState('');
    const [paidAt, setPaidAt] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => { setAmount(cur?.payable || ''); }, [inv]); // eslint-disable-line react-hooks/exhaustive-deps

    const submit = async (e: FormEvent) => {
        e.preventDefault(); setErr('');
        if (!cur) return setErr('Chọn hóa đơn cần thu.');
        if (!amount || amount < 1000) return setErr('Nhập số tiền thu (tối thiểu 1.000đ).');
        if (amount > cur.payable) return setErr(`Số tiền vượt quá số còn phải thu (${vnd(cur.payable)}).`);
        if (method !== 'cash' && !ref.trim()) return setErr('Nhập mã giao dịch / số tham chiếu.');
        setBusy(true);
        try {
            const r = await send<{ id: number; receipt_code: string }>('post', `/students/${studentId}/payments`, {
                invoice_id: inv, amount, method, reference: ref.trim() || null, payer_note: note.trim() || null,
                paid_at: paidAt ? paidAt.replace('T', ' ') + ':00' : null,
            });
            toast.success('Thu tiền thành công', `Phiếu thu ${r.data.receipt_code} · ${vnd(amount)}`);
            notifyChanged(); onDone(r.data.id);
        } catch (ex) { setErr(errMsg(ex)); toast.error('Không thu được tiền', errMsg(ex)); } finally { setBusy(false); }
    };

    return (
        <Modal title="Thu tiền học sinh" onClose={onClose} size="lg" footer={<Footer form="collect" onClose={onClose} busy={busy} tone="ok" disabled={!cur} label={<><Icon name="check" size={16} /> Xác nhận thu</>} />}>
            <form id="collect" onSubmit={submit} className="fx-col">
                {open.length === 0 ? <div className="fx-alert info"><Icon name="check" /><div className="grow">Học sinh không còn hóa đơn nào cần thu.</div></div> : (
                    <>
                        <Field label="Hóa đơn cần thu">
                            <select className="fx-sel" value={inv} onChange={(e) => setInv(Number(e.target.value))}>
                                {open.map((i) => <option key={i.id} value={i.id}>{i.code} · {i.title} · còn {vnd(i.payable)}</option>)}
                            </select>
                        </Field>
                        {cur && (
                            <div className="fx-grid fx-g3" style={{ gap: 10 }}>
                                <div className="fx-item"><div><div className="fx-muted fx-small">Tổng hóa đơn</div><b className="fx-num">{vnd(cur.total)}</b></div></div>
                                <div className="fx-item"><div><div className="fx-muted fx-small">Đã thu</div><b className="fx-num" style={{ color: 'var(--ok)' }}>{vnd(cur.paid)}</b></div></div>
                                <div className="fx-item"><div><div className="fx-muted fx-small">Còn phải thu</div><b className="fx-num" style={{ color: 'var(--bad)' }}>{vnd(cur.payable)}</b></div></div>
                            </div>
                        )}
                        {cur && cur.pending > 0 && <div className="fx-alert warn"><Icon name="clock" /><div className="grow">Có {vnd(cur.pending)} đang chờ xác nhận, đã được trừ khỏi số còn phải thu.</div></div>}
                        <Field label="Số tiền thu" hint={amount ? vndWords(Number(amount)) : undefined}>
                            <MoneyInput value={amount} onChange={setAmount} autoFocus />
                            {cur && (
                                <div className="fx-money-hint">
                                    <button type="button" className="fx-btn sm" onClick={() => setAmount(cur.payable)}>Thu đủ {num(cur.payable)}</button>
                                    {cur.payable >= 200000 && <button type="button" className="fx-btn sm" onClick={() => setAmount(Math.round(cur.payable / 2 / 1000) * 1000)}>Thu 50%</button>}
                                </div>
                            )}
                        </Field>
                        <div className="fx-grid fx-g2">
                            <Field label="Hình thức">
                                <select className="fx-sel" value={method} onChange={(e) => setMethod(e.target.value)}>
                                    {meta.payment_methods.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </Field>
                            <Field label="Thời điểm nộp" hint="Để trống = bây giờ"><input className="fx-in" type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} max={new Date().toISOString().slice(0, 16)} /></Field>
                        </div>
                        {method !== 'cash' && <Field label="Mã giao dịch / số tham chiếu"><input className="fx-in" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Ví dụ: FT23384337181" maxLength={60} /></Field>}
                        <Field label="Ghi chú (người nộp, nội dung…)"><input className="fx-in" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} /></Field>
                        {err && <div className="fx-alert bad"><Icon name="alert" /><div className="grow">{err}</div></div>}
                    </>
                )}
            </form>
        </Modal>
    );
}

/* ====================== Nhập lý do (từ chối / hủy phiếu) ====================== */
export function ReasonModal({ title, label, confirm, tone = 'bad', onClose, onSubmit }: {
    title: string; label: string; confirm: string; tone?: string; onClose: () => void; onSubmit: (reason: string) => Promise<void>;
}) {
    const [v, setV] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const go = async (e: FormEvent) => {
        e.preventDefault();
        if (v.trim().length < 3) return setErr('Vui lòng nhập lý do (ít nhất 3 ký tự).');
        setBusy(true);
        try { await onSubmit(v.trim()); } catch (ex) { setErr(errMsg(ex)); } finally { setBusy(false); }
    };
    return (
        <Modal title={title} onClose={onClose} footer={<Footer form="reason" onClose={onClose} busy={busy} tone={tone} label={confirm} />}>
            <form onSubmit={go} className="fx-col" id="reason">
                <Field label={label} error={err}><textarea className="fx-ta" autoFocus value={v} onChange={(e) => setV(e.target.value)} maxLength={255} /></Field>
            </form>
        </Modal>
    );
}

/* ====================== Miễn giảm ====================== */
export function WaiverModal({ studentId, yearId, edit, onClose, onDone }: { studentId: number; yearId: number; edit?: Waiver | null; onClose: () => void; onDone: () => void }) {
    const { meta } = useSession();
    const toast = useToast();
    const kinds = Object.entries(meta.waiver_kinds);
    const [year, setYear] = useState(edit?.school_year_id || yearId);
    const [kind, setKind] = useState(edit?.kind || kinds[0]?.[0] || 'other');
    const [label, setLabel] = useState(edit?.label || '');
    const [percent, setPercent] = useState<number | ''>(edit?.percent || 100);
    const [note, setNote] = useState(edit?.note || '');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    const submit = async (e: FormEvent) => {
        e.preventDefault(); setErr('');
        if (!percent || percent < 1 || percent > 100) return setErr('Tỷ lệ miễn giảm phải từ 1 đến 100%.');
        setBusy(true);
        try {
            if (edit) {
                await send('put', `/waivers/${edit.id}`, { label: label.trim() || edit.label, percent, note: note.trim() || null });
                toast.success('Đã cập nhật miễn giảm');
            } else {
                await send('post', `/students/${studentId}/waivers`, { school_year_id: year, kind, label: label.trim() || null, percent, note: note.trim() || null });
                toast.success('Đã thêm diện miễn giảm', `${percent}% · ${label.trim() || meta.waiver_kinds[kind]}`);
            }
            notifyChanged(); onDone();
        } catch (ex) { setErr(errMsg(ex)); } finally { setBusy(false); }
    };

    return (
        <Modal title={edit ? 'Sửa diện miễn giảm' : 'Thêm diện miễn giảm học phí'} onClose={onClose} footer={<Footer form="waiver" onClose={onClose} busy={busy} label="Lưu" />}>
            <form onSubmit={submit} className="fx-col" id="waiver">
                {!edit && (
                    <div className="fx-grid fx-g2">
                        <Field label="Năm học"><select className="fx-sel" value={year} onChange={(e) => setYear(Number(e.target.value))}>{meta.years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}</select></Field>
                        <Field label="Diện miễn giảm"><select className="fx-sel" value={kind} onChange={(e) => setKind(e.target.value)}>{kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
                    </div>
                )}
                <Field label="Tên hiển thị" hint="Để trống sẽ dùng tên diện mặc định"><input className="fx-in" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder={edit?.label || meta.waiver_kinds[kind]} /></Field>
                <Field label="Tỷ lệ miễn giảm (%)">
                    <input className="fx-in" type="number" min={1} max={100} value={percent} onChange={(e) => setPercent(e.target.value === '' ? '' : Number(e.target.value))} />
                    <div className="fx-money-hint">{[10, 30, 50, 70, 100].map((p) => <button type="button" key={p} className="fx-btn sm" onClick={() => setPercent(p)}>{p}%</button>)}</div>
                </Field>
                <Field label="Ghi chú / căn cứ hồ sơ"><textarea className="fx-ta" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} /></Field>
                <div className="fx-alert info"><Icon name="note" /><div className="grow">Miễn giảm được áp dụng khi lập hóa đơn ở các đợt thu sau. Hóa đơn đã phát hành không bị thay đổi số tiền.</div></div>
                {err && <div className="fx-alert bad"><Icon name="alert" /><div className="grow">{err}</div></div>}
            </form>
        </Modal>
    );
}

/* ====================== Ghi chú / liên hệ / hẹn trả ====================== */
export function NoteModal({ studentId, defaultKind = 'note', onClose, onDone }: { studentId: number; defaultKind?: DebtNote['kind']; onClose: () => void; onDone: () => void }) {
    const toast = useToast();
    const [kind, setKind] = useState<DebtNote['kind']>(defaultKind);
    const [channel, setChannel] = useState('phone');
    const [note, setNote] = useState('');
    const [date, setDate] = useState('');
    const [amount, setAmount] = useState<number | ''>('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const today = new Date().toISOString().slice(0, 10);

    const submit = async (e: FormEvent) => {
        e.preventDefault(); setErr('');
        if (note.trim().length < 3) return setErr('Vui lòng nhập nội dung.');
        if (kind === 'promise' && (!date || !amount)) return setErr('Chọn ngày hẹn và nhập số tiền hẹn trả.');
        setBusy(true);
        try {
            const r = await send('post', `/students/${studentId}/debt-notes`, {
                kind, channel: kind === 'note' ? null : channel, note: note.trim(),
                promise_date: kind === 'promise' ? date : null, promise_amount: kind === 'promise' ? amount : null,
            });
            toast.success(r.message); notifyChanged(); onDone();
        } catch (ex) { setErr(errMsg(ex)); } finally { setBusy(false); }
    };

    return (
        <Modal title="Ghi chú công nợ" onClose={onClose} footer={<Footer form="note" onClose={onClose} busy={busy} label="Lưu" />}>
            <form onSubmit={submit} className="fx-col" id="note">
                <div className="fx-seg">
                    {([['note', 'Ghi chú nội bộ'], ['contact', 'Đã liên hệ phụ huynh'], ['promise', 'Phụ huynh hẹn trả']] as const).map(([k, l]) => (
                        <button type="button" key={k} className={`fx-pill ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{l}</button>
                    ))}
                </div>
                {kind !== 'note' && (
                    <Field label="Kênh liên hệ"><select className="fx-sel" value={channel} onChange={(e) => setChannel(e.target.value)}>
                        {['phone', 'zalo', 'sms', 'direct', 'email', 'other'].map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}</select></Field>
                )}
                {kind === 'promise' && (
                    <div className="fx-grid fx-g2">
                        <Field label="Ngày hẹn trả"><input className="fx-in" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
                        <Field label="Số tiền hẹn trả"><MoneyInput value={amount} onChange={setAmount} /></Field>
                    </div>
                )}
                <Field label="Nội dung"><textarea className="fx-ta" autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Ví dụ: Gọi cho mẹ em, gia đình xin gia hạn đến cuối tháng…" /></Field>
                {err && <div className="fx-alert bad"><Icon name="alert" /><div className="grow">{err}</div></div>}
            </form>
        </Modal>
    );
}

/* ====================== Gửi nhắc nợ ====================== */
export function ReminderModal({ studentId, onClose, onDone }: { studentId: number; onClose: () => void; onDone: () => void }) {
    const { meta } = useSession();
    const toast = useToast();
    const [tpl, setTpl] = useState<number>(meta.templates[0]?.id || 0);
    const [channel, setChannel] = useState('inapp');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const seq = useRef(0);

    useEffect(() => {
        if (!tpl) return;
        const my = ++seq.current; setLoading(true); setErr('');
        send<{ subject: string; body: string }>('post', `/students/${studentId}/reminders/preview`, { template_id: tpl, channel })
            .then((r) => { if (my === seq.current) { setSubject(r.data.subject); setBody(r.data.body); } })
            .catch((e) => my === seq.current && setErr(errMsg(e)))
            .finally(() => my === seq.current && setLoading(false));
    }, [tpl, studentId]); // eslint-disable-line react-hooks/exhaustive-deps

    const submit = async (e: FormEvent) => {
        e.preventDefault(); setErr('');
        if (!subject.trim() || !body.trim()) return setErr('Tiêu đề và nội dung không được để trống.');
        setBusy(true);
        try {
            const r = await send('post', `/students/${studentId}/reminders`, { template_id: tpl || null, channel, subject, body });
            toast.success(r.message); notifyChanged(); onDone();
        } catch (ex) { setErr(errMsg(ex)); toast.error('Không gửi được nhắc nợ', errMsg(ex)); } finally { setBusy(false); }
    };

    return (
        <Modal title="Gửi nhắc nợ phụ huynh" size="lg" onClose={onClose} footer={<Footer form="remind" onClose={onClose} busy={busy} disabled={loading} label={<><Icon name="send" size={16} /> Gửi nhắc nợ</>} />}>
            <form onSubmit={submit} className="fx-col" id="remind">
                <div className="fx-grid fx-g2">
                    <Field label="Mẫu nhắc nợ"><select className="fx-sel" value={tpl} onChange={(e) => setTpl(Number(e.target.value))}>
                        {meta.templates.map((t) => <option key={t.id} value={t.id}>Cấp {t.level} · {t.name}</option>)}</select></Field>
                    <Field label="Kênh gửi"><select className="fx-sel" value={channel} onChange={(e) => setChannel(e.target.value)}>
                        {['inapp', 'zalo', 'sms', 'print'].map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}</select></Field>
                </div>
                {loading ? <><Skeleton h={40} /><Skeleton h={160} /></> : (
                    <>
                        <Field label="Tiêu đề"><input className="fx-in" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} /></Field>
                        <Field label="Nội dung (đã điền sẵn số liệu, có thể chỉnh sửa)"><textarea className="fx-ta" style={{ minHeight: 190 }} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1500} /></Field>
                    </>
                )}
                <div className="fx-alert info"><Icon name="send" /><div className="grow">Kênh “Thông báo trên ứng dụng” gửi ngay; SMS / Zalo / In giấy sẽ vào hàng chờ để bạn đánh dấu khi đã gửi.</div></div>
                {err && <div className="fx-alert bad"><Icon name="alert" /><div className="grow">{err}</div></div>}
            </form>
        </Modal>
    );
}

/* ====================== Trả lời khiếu nại ====================== */
export function ReplyModal({ dispute, onClose, onDone }: { dispute: Dispute; onClose: () => void; onDone: () => void }) {
    const toast = useToast();
    const [v, setV] = useState(dispute.reply || '');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (v.trim().length < 3) return setErr('Vui lòng nhập nội dung trả lời.');
        setBusy(true);
        try { const r = await send('post', `/disputes/${dispute.id}/reply`, { reply: v.trim() }); toast.success(r.message); notifyChanged(); onDone(); }
        catch (ex) { setErr(errMsg(ex)); } finally { setBusy(false); }
    };
    return (
        <Modal title={`Trả lời khiếu nại · ${dispute.invoice_code || ''}`} onClose={onClose} footer={<Footer form="reply" onClose={onClose} busy={busy} label="Gửi trả lời" />}>
            <form onSubmit={submit} className="fx-col" id="reply">
                <div className="fx-item"><div><div className="fx-muted fx-small">Nội dung khiếu nại · {fdt(dispute.created_at)}</div><div>{dispute.message}</div></div></div>
                <Field label="Trả lời của Phòng Kế toán" error={err}><textarea className="fx-ta" style={{ minHeight: 130 }} autoFocus value={v} onChange={(e) => setV(e.target.value)} maxLength={1000} /></Field>
            </form>
        </Modal>
    );
}

/* ====================== Chi tiết hóa đơn (ngăn kéo bên phải) ====================== */
export function InvoiceDrawer({ id, onClose, onCollect, onReceipt }: { id: number; onClose: () => void; onCollect: (invoiceId: number) => void; onReceipt: (paymentId: number) => void }) {
    const { meta, canWrite } = useSession();
    const [d, setD] = useState<InvoiceDetail | null>(null);
    const [err, setErr] = useState('');
    useEffect(() => { setD(null); get<InvoiceDetail>(`/invoices/${id}`).then(setD).catch((e) => setErr(errMsg(e))); }, [id]);
    const inv = d?.invoice;
    const lineSum = useMemo(() => d?.lines.reduce((s, l) => s + l.amount, 0) || 0, [d]);

    return (
        <Modal drawer title={inv ? `Hóa đơn ${inv.code}` : 'Hóa đơn'} onClose={onClose}
               footer={inv && canWrite && inv.payable > 0 ? <button className="fx-btn ok" onClick={() => onCollect(inv.id)}><Icon name="wallet" size={16} /> Thu tiền hóa đơn này</button> : undefined}>
            {err && <div className="fx-alert bad"><Icon name="alert" /><div className="grow">{err}</div></div>}
            {!d && !err && <><Skeleton h={80} /><Skeleton h={160} /><Skeleton h={100} /></>}
            {d && inv && (
                <>
                    <div className="fx-item" style={{ flexDirection: 'column', gap: 6 }}>
                        <div className="fx-between" style={{ width: '100%' }}><b>{inv.title}</b><InvChip s={inv.state} /></div>
                        <div className="fx-muted fx-small">{d.student.full_name} ({d.student.code}) · {TERM_LABEL[inv.term] || inv.term} · {inv.year_label}</div>
                        <div className="fx-muted fx-small">Phát hành {fdate(inv.issue_date)} · Hạn nộp {fdate(inv.due_date)}{inv.overdue_days > 0 && <b style={{ color: 'var(--bad)' }}> · quá hạn {inv.overdue_days} ngày</b>}</div>
                    </div>
                    <div className="fx-tw" style={{ border: '1px solid var(--line)' }}>
                        <table className="fx-table">
                            <thead><tr><th>Khoản thu</th><th className="fx-r">SL</th><th className="fx-r">Đơn giá</th><th className="fx-r">Giảm</th><th className="fx-r">Thành tiền</th></tr></thead>
                            <tbody>
                            {d.lines.map((l) => <tr key={l.id}><td>{l.description}</td><td className="fx-r">{l.quantity}</td><td className="fx-r fx-num">{num(l.unit_price)}</td><td className="fx-r fx-num">{l.discount ? `-${num(l.discount)}` : '—'}</td><td className="fx-r fx-num fx-strong">{num(l.amount)}</td></tr>)}
                            <tr><td colSpan={4} className="fx-r fx-muted">Cộng các dòng</td><td className="fx-r fx-num">{num(lineSum)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="fx-grid fx-g3" style={{ gap: 10 }}>
                        <div className="fx-item"><div><div className="fx-muted fx-small">Tổng phải thu</div><b className="fx-num">{vnd(inv.total)}</b></div></div>
                        <div className="fx-item"><div><div className="fx-muted fx-small">Đã thu</div><b className="fx-num" style={{ color: 'var(--ok)' }}>{vnd(inv.paid)}</b></div></div>
                        <div className="fx-item"><div><div className="fx-muted fx-small">Còn nợ</div><b className="fx-num" style={{ color: inv.outstanding ? 'var(--bad)' : 'var(--ok)' }}>{vnd(inv.outstanding)}</b></div></div>
                    </div>
                    {inv.discount > 0 && <div className="fx-muted fx-small">Đã áp dụng giảm/miễn {vnd(inv.discount)} trên tổng {vnd(inv.subtotal)}.</div>}

                    <div className="fx-h2">Phiếu thu của hóa đơn</div>
                    {d.payments.length === 0 ? <div className="fx-muted">Chưa có phiếu thu.</div> : d.payments.map((p) => (
                        <div key={p.id} className="fx-item" style={{ alignItems: 'center' }}>
                            <div style={{ flex: 1 }}><b>{p.receipt_code}</b> <PayChip s={p.status} /><div className="fx-muted fx-small">{fdt(p.paid_at)} · {METHOD_LABEL[p.method] || p.method}{p.reference ? ` · ${p.reference}` : ''}</div></div>
                            <b className="fx-num">{vnd(p.amount)}</b>
                            <button className="fx-btn sm" onClick={() => onReceipt(p.id)}><Icon name="print" size={14} /></button>
                        </div>
                    ))}
                    {d.disputes.length > 0 && (<><div className="fx-h2">Khiếu nại</div>{d.disputes.map((x) => <div key={x.id} className="fx-item"><div><div>{x.message}</div>{x.reply && <div className="fx-small" style={{ color: 'var(--ok)', marginTop: 4 }}>↳ {x.reply}</div>}</div></div>)}</>)}
                    {inv.outstanding > 0 && <QrBox bank={meta.bank} amount={inv.outstanding} content={`${inv.code} ${d.student.code}`} />}
                </>
            )}
        </Modal>
    );
}

/* ====================== Biên lai in ====================== */
export function ReceiptModal({ id, onClose }: { id: number; onClose: () => void }) {
    const [r, setR] = useState<Receipt | null>(null);
    const [err, setErr] = useState('');
    useEffect(() => { get<Receipt>(`/payments/${id}/receipt`).then(setR).catch((e) => setErr(errMsg(e))); }, [id]);
    const p = r?.payment;
    return (
        <Modal title="Biên lai thu tiền" size="lg" onClose={onClose}
               footer={<><button className="fx-btn" onClick={onClose}>Đóng</button><button className="fx-btn pri" disabled={!r} onClick={() => window.print()}><Icon name="print" size={16} /> In biên lai</button></>}>
            {err && <div className="fx-alert bad"><Icon name="alert" /><div className="grow">{err}</div></div>}
            {!r && !err && <Skeleton h={320} />}
            {r && p && (
                <div className="fx-print-area">
                    <div className="fx-receipt">
                        <div className="c"><b>{r.school.name}</b><br />{r.school.address}{r.school.hotline && ` · ĐT ${r.school.hotline}`}</div>
                        <h2>PHIẾU THU TIỀN</h2>
                        <div className="c">Số: <b>{p.receipt_code}</b> · Ngày {fdt(p.paid_at)}</div>
                        <p>Họ tên học sinh: <b>{r.student.full_name}</b> · Mã: <b>{r.student.code}</b> · Lớp: <b>{r.class_name || '—'}</b></p>
                        <table>
                            <thead><tr><th>Nội dung (hóa đơn)</th><th>Hình thức</th><th style={{ textAlign: 'right' }}>Số tiền</th></tr></thead>
                            <tbody><tr><td>{r.invoice.code} - {r.invoice.title}</td><td>{METHOD_LABEL[p.method] || p.method}{p.reference ? ` (${p.reference})` : ''}</td><td style={{ textAlign: 'right' }}><b>{vnd(p.amount)}</b></td></tr></tbody>
                        </table>
                        <p>Số tiền bằng chữ: <i>{vndWords(p.amount)}</i></p>
                        <p>Hóa đơn còn nợ sau phiếu này: <b>{vnd(r.invoice.outstanding)}</b></p>
                        {p.status !== 'confirmed' && <p style={{ color: '#b91c1c' }}><b>Phiếu ở trạng thái: {p.status === 'pending' ? 'chờ xác nhận' : p.status === 'cancelled' ? 'ĐÃ HỦY' : 'bị từ chối'}</b></p>}
                        <div className="sign"><div><b>Người nộp tiền</b><br /><i>(ký, ghi rõ họ tên)</i></div><div><b>{r.school.accountant}</b><br /><i>{p.confirmed_by || ''}</i></div><div><b>{r.school.treasurer}</b></div></div>
                        <p className="c" style={{ fontSize: 12 }}><i>{r.school.footer}</i></p>
                    </div>
                </div>
            )}
        </Modal>
    );
}