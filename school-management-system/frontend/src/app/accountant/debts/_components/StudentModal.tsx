'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, BUCKET_SHORT, BUCKET_TONE, DMeta, INV_STATE, KIND_LABEL, KtError, Note, PROMISE_STATE, StudentRes, vnd, fmtDate } from '../_lib/db';
import { Chip, ErrorBox, Field, Loading, Modal, Progress, useApi } from '../../periods/_components/ui';

type Props = { id: number; meta: DMeta; onClose: () => void; onChanged: () => void; toast: { ok: (m: string) => void; fail: (m: string) => void } };

/** Hồ sơ công nợ của một học sinh: hóa đơn còn nợ, lịch sử đóng, ghi chú liên hệ và hẹn trả. */
export function StudentModal({ id, meta, onClose, onChanged, toast }: Props) {
    const res = useApi<StudentRes>(`debts/students/${id}`);
    const [notes, setNotes] = useState<Note[] | null>(null);
    const [kind, setKind] = useState<'note' | 'contact' | 'promise'>('contact');
    const [channel, setChannel] = useState('phone');
    const [text, setText] = useState('');
    const [date, setDate] = useState('');
    const [amount, setAmount] = useState('');
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);
    const d = res.data;
    const list = notes ?? d?.notes ?? [];
    const bal = d?.summary.balance ?? 0;
    const hasOpen = list.some((n) => n.kind === 'promise' && (n.status === 'open' || n.status === 'late'));
    const addDays = (n: number) => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

    const submit = async () => {
        setBusy(true); setErrs({}); setMsg('');
        try {
            const body: Record<string, unknown> = { student_id: id, kind, note: text };
            if (kind !== 'note') body.channel = channel;
            if (kind === 'promise') { body.promise_date = date; body.promise_amount = Number(amount || 0); }
            const r = await api<{ notes: Note[] }>('debts/notes', { method: 'POST', body });
            setNotes(r.notes); setText(''); setDate(''); setAmount('');
            toast.ok(kind === 'promise' ? 'Đã ghi lời hẹn trả.' : kind === 'contact' ? 'Đã ghi nhận lần liên hệ.' : 'Đã lưu ghi chú.'); onChanged();
        } catch (e) { const x = e as KtError; setErrs(x.errors || {}); setMsg(Object.keys(x.errors || {}).length ? '' : x.message); } finally { setBusy(false); }
    };
    const resolve = async (nid: number, result: 'kept' | 'broken' | 'cancelled') => {
        setBusy(true);
        try { const r = await api<{ notes: Note[] }>(`debts/notes/${nid}/resolve`, { method: 'POST', body: { result } }); setNotes(r.notes); toast.ok('Đã cập nhật lời hẹn.'); onChanged(); }
        catch (e) { toast.fail((e as KtError).message); } finally { setBusy(false); }
    };

    return (
        <Modal wide title={d ? `Công nợ · ${d.student.name}` : 'Công nợ học sinh'} onClose={onClose}
               foot={<>{d && <Link href={`/accountant/collection?student=${d.student.id}`} className="pd-btn">Thu tiền học sinh này</Link>}<button className="pd-btn ghost" onClick={onClose}>Đóng</button></>}>
            {res.loading && !d && <Loading />}
            {res.err && <ErrorBox msg={res.err} retry={res.reload} />}
            {d && (
                <div className="dbt-detail">
                    <div className="dbt-who">
                        <div><b>{d.student.name}</b><small>{d.student.code} · Lớp {d.student.class || 'chưa xếp lớp'} · {d.student.gender} · sinh {fmtDate(d.student.birth_date)}</small></div>
                        {bal > 0 ? <Chip tone={d.summary.max_days > 0 ? 'err' : 'warn'}>{d.summary.max_days > 0 ? `Quá hạn ${d.summary.max_days} ngày` : 'Chưa đến hạn'}</Chip> : <Chip tone="ok">Đã đóng đủ</Chip>}
                    </div>
                    <div className="dbt-mini">
                        <div><span>Phải thu</span><b>{vnd(d.summary.billed)}</b></div>
                        <div><span>Đã thu</span><b className="ok">{vnd(d.summary.paid)}</b></div>
                        <div><span>Còn nợ</span><b className={bal > 0 ? 'bad' : 'ok'}>{vnd(bal)}</b></div>
                        <div><span>Quá hạn</span><b className={d.summary.overdue > 0 ? 'bad' : ''}>{vnd(d.summary.overdue)}</b></div>
                    </div>
                    <Progress paid={d.summary.paid} pending={d.summary.pending} total={Math.max(d.summary.billed, 1)} />
                    {d.summary.pending > 0 && <p className="pd-muted">Có {vnd(d.summary.pending)} học sinh đã khai báo nhưng chưa được xác nhận (tab Chờ xác nhận ở Thu học phí).</p>}

                    <h4>Hóa đơn</h4>
                    <div className="pd-tw"><table className="pd-table dbt-inv">
                        <thead><tr><th>Hóa đơn</th><th>Hạn nộp</th><th className="n">Phải thu</th><th className="n">Đã thu</th><th className="n">Còn nợ</th><th>Trạng thái</th></tr></thead>
                        <tbody>{d.invoices.map((i) => {
                            const [l, t] = INV_STATE[i.state];
                            return <tr key={i.id}><td><span className="pd-mono">{i.code}</span><small>{i.period || i.title} · {i.year}</small></td><td>{fmtDate(i.due_date)}{i.days > 0 && <small className="bad">quá {i.days} ngày</small>}</td>
                                <td className="n">{vnd(i.total)}</td><td className="n">{vnd(i.paid)}</td><td className="n"><b className={i.balance > 0 ? 'bad' : ''}>{vnd(i.balance)}</b></td>
                                <td><Chip tone={t}>{l}</Chip>{i.bucket && i.days > 0 && <small>{BUCKET_SHORT[i.bucket]}</small>}</td></tr>;
                        })}</tbody>
                    </table></div>

                    <div className="dbt-cols">
                        <section>
                            <h4>Lịch sử đã đóng</h4>
                            {d.payments.length === 0 ? <p className="pd-muted">Chưa có khoản nào được xác nhận.</p> : (
                                <ul className="dbt-pay">{d.payments.map((p) => <li key={p.id}><span className="pd-mono">{p.receipt_code}</span><b>{vnd(p.amount)}</b><small>{p.method} · {p.at} · {p.invoice}</small></li>)}</ul>
                            )}
                        </section>
                        <section>
                            <h4>Liên hệ phụ huynh</h4>
                            {bal > 0 ? (
                                <div className="dbt-form">
                                    <div className="pd-seg" role="group" aria-label="Loại ghi nhận">
                                        {(['contact', 'promise', 'note'] as const).map((k) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); setErrs({}); setMsg(''); }}>{KIND_LABEL[k]}</button>)}
                                    </div>
                                    {kind !== 'note' && (
                                        <Field label="Hình thức liên hệ" error={errs.channel} htmlFor="dbt-ch"><select id="dbt-ch" className="pd-in" value={channel} onChange={(e) => setChannel(e.target.value)}>{meta.channels.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Field>
                                    )}
                                    {kind === 'promise' && (
                                        hasOpen ? <div className="pd-alert warn">Học sinh đang có một lời hẹn chưa xử lý. Hãy đánh dấu kết quả lời hẹn đó ở danh sách bên dưới trước khi hẹn mới.</div> : (
                                            <div className="dbt-two">
                                                <Field label="Hẹn trả ngày" error={errs.promise_date} htmlFor="dbt-d"><input id="dbt-d" type="date" className="pd-in" min={meta.today} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
                                                <Field label="Số tiền hẹn (đ)" error={errs.promise_amount} htmlFor="dbt-a"><input id="dbt-a" className="pd-in" inputMode="numeric" value={amount ? Number(amount).toLocaleString('vi-VN') : ''} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder={`Tối đa ${vnd(bal)}`} /></Field>
                                                <div className="pd-quick" style={{ gridColumn: '1/-1' }}>
                                                    <button onClick={() => setDate(addDays(3))}>3 ngày nữa</button><button onClick={() => setDate(addDays(7))}>1 tuần nữa</button><button onClick={() => setDate(addDays(14))}>2 tuần nữa</button>
                                                    <button onClick={() => setAmount(String(bal))}>Trả toàn bộ</button><button onClick={() => setAmount(String(Math.ceil(bal / 2 / 1000) * 1000))}>Trả một nửa</button>
                                                </div>
                                            </div>
                                        )
                                    )}
                                    <Field label={kind === 'promise' ? 'Nội dung thỏa thuận' : kind === 'contact' ? 'Kết quả cuộc liên hệ' : 'Ghi chú nội bộ'} error={errs.note} htmlFor="dbt-n"><textarea id="dbt-n" className="pd-in" rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === 'contact' ? 'Ví dụ: Đã gọi cho mẹ, hẹn đóng sau khi nhận lương' : ''} /></Field>
                                    {msg && <div className="pd-alert err" role="alert">{msg}</div>}
                                    <button className="pd-btn" disabled={busy || text.trim().length < 3 || (kind === 'promise' && hasOpen)} onClick={submit}>{busy ? 'Đang lưu…' : kind === 'promise' ? 'Ghi lời hẹn' : 'Lưu'}</button>
                                </div>
                            ) : <p className="pd-muted">Học sinh đã đóng đủ, không cần liên hệ.</p>}
                        </section>
                    </div>

                    <h4>Nhật ký liên hệ ({list.length})</h4>
                    {list.length === 0 ? <p className="pd-muted">Chưa có ghi chú nào.</p> : (
                        <ul className="dbt-tl">{list.map((n) => {
                            const [pl, pt] = PROMISE_STATE[n.status] || ['', 'mut'];
                            return (
                                <li key={n.id}>
                                    <div className="dbt-tl-h"><Chip tone={n.kind === 'promise' ? 'info' : n.kind === 'contact' ? 'ok' : 'mut'}>{KIND_LABEL[n.kind]}</Chip>{n.channel_label && <span>{n.channel_label}</span>}{n.kind === 'promise' && pl && <Chip tone={pt}>{pl}</Chip>}<small>{n.at} · {n.by}</small></div>
                                    {n.kind === 'promise' && <p><b>Hẹn {fmtDate(n.promise_date || '')}</b> · {vnd(n.promise_amount || 0)}</p>}
                                    <p>{n.note}</p>
                                    {n.resolved_by && <small className="pd-muted">Đã xử lý bởi {n.resolved_by} lúc {n.resolved_at}</small>}
                                    {n.kind === 'promise' && (n.status === 'open' || n.status === 'late') && (
                                        <div className="dbt-act"><button className="pd-btn ghost sm" disabled={busy} onClick={() => resolve(n.id, 'kept')}>Đã giữ lời</button><button className="pd-btn ghost sm" disabled={busy} onClick={() => resolve(n.id, 'broken')}>Không giữ lời</button><button className="pd-btn ghost sm" disabled={busy} onClick={() => resolve(n.id, 'cancelled')}>Hủy hẹn</button></div>
                                    )}
                                </li>
                            );
                        })}</ul>
                    )}
                </div>
            )}
        </Modal>
    );
}