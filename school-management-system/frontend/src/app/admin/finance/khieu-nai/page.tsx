'use client';
// Khiếu nại học phí (/admin/finance/khieu-nai)
import React, { useState } from 'react';
import { Btn, Card, Empty, ErrorBox, Field, Ico, InvoiceDrawer, Loading, Modal, Pill, Tabs, dt, fi, useLoad, useTa, vnd } from '../_fi';

type D = { id: number; invoice_id: number; invoice: string; total: number; sname: string; scode: string; message: string; status: string; reply: string | null; replied_by: string | null; created_at: string | null; replied_at: string | null };
type Res = { counts: { open: number; done: number }; data: D[] };
const TPL = ['Nhà trường đã kiểm tra và điều chỉnh lại hóa đơn. Phụ huynh vui lòng xem lại số tiền mới.', 'Nhà trường đã đối chiếu: số tiền trên hóa đơn là chính xác theo thông báo thu đầu năm. Mọi thắc mắc xin liên hệ phòng Kế toán.', 'Khoản thanh toán của em đã được ghi nhận. Cảm ơn phụ huynh đã phản hồi.'];

export default function DisputesPage() {
    const { toast, refresh } = useTa();
    const [st, setSt] = useState('open'); const [reply, setReply] = useState<D | null>(null); const [inv, setInv] = useState<number | null>(null);
    const { data, err, loading, reload } = useLoad(() => fi<Res>(`disputes?status=${st}`), [st]);
    return (
        <div className="ta-page">
            <Tabs value={st} onChange={setSt} items={[{ key: 'open', label: 'Chờ trả lời', count: data?.counts.open, tone: 'rose' }, { key: 'done', label: 'Đã trả lời', count: data?.counts.done, tone: 'green' }, { key: '', label: 'Tất cả' }]} />
            {loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /> : data.data.length === 0 ? <Card><Empty icon="check" title={st === 'open' ? 'Không có khiếu nại nào đang chờ' : 'Chưa có khiếu nại'} text="Khi học sinh gửi khiếu nại về hóa đơn, nội dung sẽ hiện tại đây." /></Card> : (
                <div className="fi-cards">{data.data.map((d) => (
                    <div key={d.id} className={`fi-card t-${d.status === 'open' ? 'rose' : 'green'}`}>
                        <div className="fi-row" style={{ justifyContent: 'space-between' }}><Pill tone={d.status === 'open' ? 'rose' : 'green'} dot>{d.status === 'open' ? 'Chờ trả lời' : 'Đã trả lời'}</Pill><span className="ta-mute">{dt(d.created_at)}</span></div>
                        <h4>{d.sname} <span className="ta-mute" style={{ fontWeight: 500 }}>· {d.scode}</span></h4>
                        <p className="ta-mute">Hóa đơn {d.invoice} · {vnd(d.total)}</p>
                        <p>“{d.message}”</p>
                        {d.reply && <div className="fi-note"><b>{d.replied_by}</b> đã trả lời ({dt(d.replied_at)}):<p>{d.reply}</p></div>}
                        <footer><Btn size="sm" onClick={() => setInv(d.invoice_id)}><Ico n="doc" size={14} />Xem hóa đơn</Btn>{d.status === 'open' && <Btn size="sm" tone="primary" onClick={() => setReply(d)}><Ico n="send" size={14} />Trả lời</Btn>}</footer>
                    </div>))}</div>)}
            {reply && <ReplyModal d={reply} onClose={() => setReply(null)} onDone={() => { setReply(null); toast('Đã gửi trả lời cho học sinh.'); reload(); refresh(); }} />}
            {inv !== null && <InvoiceDrawer id={inv} onClose={() => setInv(null)} onChanged={reload} />}
        </div>
    );
}
function ReplyModal({ d, onClose, onDone }: { d: D; onClose: () => void; onDone: () => void }) {
    const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    const go = async () => { if (text.trim().length < 3) { setErr('Hãy nhập nội dung trả lời.'); return; } setBusy(true); try { await fi(`disputes/${d.id}/reply`, { method: 'POST', body: { reply: text.trim() } }); onDone(); } catch (e) { setErr((e as Error).message); setBusy(false); } };
    return (
        <Modal title="Trả lời khiếu nại" onClose={onClose} foot={<><Btn onClick={onClose}>Hủy</Btn><Btn tone="primary" busy={busy} onClick={go}><Ico n="send" size={15} />Gửi trả lời</Btn></>}>
            <div className="fi-note"><b>{d.sname}</b> – hóa đơn {d.invoice}<p>“{d.message}”</p></div>
            <Field label="Nội dung trả lời *"><textarea autoFocus rows={5} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} /></Field>
            <div className="fi-row">{TPL.map((t, i) => <Btn key={i} size="sm" onClick={() => setText(t)}>Mẫu {i + 1}</Btn>)}</div>
            {err && <p className="ta-ferr">{err}</p>}
        </Modal>
    );
}