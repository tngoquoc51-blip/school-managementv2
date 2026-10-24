'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import '../../fees.css';
import { feeApi, vnd } from '../../_shared/api';
import { Copy, Crumbs, ErrorBox, Loading, useFee } from '../../_shared/ui';

const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

export default function PayInvoice() {
    const { id } = useParams<{ id: string }>();
    const { data: v, err, reload } = useFee<any>(`invoices/${id}`);
    const [step, setStep] = useState(1);
    const [mode, setMode] = useState<'full' | 'half' | 'custom'>('full');
    const [custom, setCustom] = useState('');
    const [method, setMethod] = useState<'bank_transfer' | 'ewallet'>('bank_transfer');
    const [ref, setRef] = useState('');
    const [when, setWhen] = useState(nowLocal());
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);
    const [qrFail, setQrFail] = useState(false);

    const max = v?.remaining_payable ?? 0;
    const amount = useMemo(() => {
        if (mode === 'full') return max;
        if (mode === 'half') return Math.max(10000, Math.floor(max / 2 / 1000) * 1000);
        return Number(custom.replace(/\D/g, '')) || 0;
    }, [mode, custom, max]);

    if (err) return <div className="fe-page"><Crumbs items={[{ label: 'Học phí', href: '/student/fees' }, { label: 'Thanh toán' }]} /><ErrorBox msg={err} retry={reload} /></div>;
    if (!v) return <div className="fe-page"><Loading /></div>;

    if (!v.can_pay && !done) {
        return (
            <div className="fe-page">
                <Crumbs items={[{ label: 'Học phí', href: '/student/fees' }, { label: v.code, href: `/student/fees/${v.id}` }, { label: 'Thanh toán' }]} />
                <section className="fe-card"><div className="fe-done"><div className="tick">✓</div><h2>{v.status === 'paid' ? 'Hóa đơn đã thanh toán đủ' : 'Không còn khoản cần thanh toán'}</h2>
                    <p style={{ color: '#5b6f85', marginBottom: 16 }}>{v.pending > 0 ? 'Các khoản bạn đã gửi đang chờ kế toán xác nhận.' : 'Cảm ơn bạn đã hoàn thành học phí.'}</p>
                    <Link className="fe-btn" href={`/student/fees/${v.id}`}>Về chi tiết hóa đơn</Link></div></section>
            </div>
        );
    }
    const p = v.pay_info;
    const valid = amount >= 10000 && amount <= max;
    const qr = `https://img.vietqr.io/image/${p.bank_bin}-${p.account_no}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(p.content)}&accountName=${encodeURIComponent(p.account_name)}`;

    const submit = async () => {
        setBusy(true); setError('');
        try {
            await feeApi(`invoices/${id}/declare`, { method: 'POST', body: { amount, method, reference: ref, paid_at: new Date(when).toISOString(), note } });
            setDone(true); reload();
        } catch (e: any) { setError(e.message); } finally { setBusy(false); }
    };

    if (done) {
        return (
            <div className="fe-page">
                <Crumbs items={[{ label: 'Học phí', href: '/student/fees' }, { label: v.code, href: `/student/fees/${v.id}` }, { label: 'Thanh toán' }]} />
                <section className="fe-card"><div className="fe-done"><div className="tick">✓</div><h2>Đã gửi thông tin thanh toán</h2>
                    <p style={{ color: '#5b6f85', maxWidth: 480, margin: '0 auto 18px' }}>Số tiền <b>{vnd(amount)}</b> đang chờ phòng Kế toán đối chiếu sao kê. Khi được xác nhận, biên lai sẽ xuất hiện trong lịch sử thanh toán.</p>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}><Link className="fe-btn" href={`/student/fees/${v.id}`}>Xem hóa đơn</Link><Link className="fe-btn ghost" href="/student/fees/payments">Lịch sử thanh toán</Link></div></div></section>
            </div>
        );
    }

    return (
        <div className="fe-page">
            <Crumbs items={[{ label: 'Học phí', href: '/student/fees' }, { label: v.code, href: `/student/fees/${v.id}` }, { label: 'Thanh toán' }]} />
            <div className="fe-steps" aria-label="Các bước">
                {['Chọn số tiền', 'Chuyển khoản', 'Xác nhận đã chuyển'].map((l, i) => <span key={l} className={`fe-step ${step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''}`}><i>{step > i + 1 ? '✓' : i + 1}</i>{l}</span>)}
            </div>

            <div className="fe-grid fe-gmain">
                <div>
                    {step === 1 && (
                        <section className="fe-card"><div className="fe-card-h"><h2>Bạn muốn thanh toán bao nhiêu?</h2></div><div className="fe-card-b">
                            <div className="fe-choice">
                                <button className={`fe-opt ${mode === 'full' ? 'on' : ''}`} onClick={() => setMode('full')}><b>{vnd(max)}</b><span>Thanh toán toàn bộ</span></button>
                                <button className={`fe-opt ${mode === 'half' ? 'on' : ''}`} onClick={() => setMode('half')} disabled={max < 20000}><b>{vnd(Math.max(10000, Math.floor(max / 2 / 1000) * 1000))}</b><span>Thanh toán một nửa</span></button>
                                <button className={`fe-opt ${mode === 'custom' ? 'on' : ''}`} onClick={() => setMode('custom')}><b>Số khác</b><span>Tự nhập số tiền</span></button>
                            </div>
                            {mode === 'custom' && (
                                <div className="fe-field"><label htmlFor="amt">Số tiền (đồng)</label><input id="amt" className="fe-in" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))} placeholder="VD: 1000000" />
                                    <span className="hint">Tối thiểu 10.000đ, tối đa {vnd(max)}.{custom && amount > 0 ? ` Bạn nhập: ${vnd(amount)}` : ''}</span></div>
                            )}
                            {!valid && mode === 'custom' && custom !== '' && <div className="fe-note">Số tiền phải từ 10.000đ đến {vnd(max)}.</div>}
                            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}><button className="fe-btn" disabled={!valid} onClick={() => setStep(2)}>Tiếp tục</button><Link className="fe-btn ghost" href={`/student/fees/${v.id}`}>Quay lại</Link></div>
                        </div></section>
                    )}

                    {step === 2 && (
                        <section className="fe-card"><div className="fe-card-h"><h2>Chuyển khoản {vnd(amount)}</h2></div><div className="fe-card-b">
                            <div className="fe-grid fe-g2">
                                <div className="fe-bank">
                                    {[['Ngân hàng', p.bank_name], ['Số tài khoản', p.account_no], ['Chủ tài khoản', p.account_name], ['Số tiền', String(amount)], ['Nội dung chuyển khoản', p.content]].map(([k, val]) => (
                                        <div key={k} className="fe-bank-row"><div><small>{k}</small><b>{k === 'Số tiền' ? vnd(amount) : val}</b></div>{k !== 'Ngân hàng' && k !== 'Chủ tài khoản' && <Copy text={val} />}</div>
                                    ))}
                                </div>
                                <div className="fe-qr">
                                    {!qrFail ? <img src={qr} alt="Mã QR chuyển khoản" onError={() => setQrFail(true)} /> : <p style={{ color: '#5b6f85' }}>Không tải được mã QR. Hãy chuyển khoản theo thông tin bên cạnh.</p>}
                                    <small style={{ color: '#5b6f85' }}>Quét bằng ứng dụng ngân hàng, số tiền và nội dung điền sẵn.</small>
                                </div>
                            </div>
                            <div className="fe-note" style={{ marginTop: 14 }}>Hãy nhập <b>đúng nội dung chuyển khoản</b> để kế toán đối chiếu nhanh. {p.demo_note ? `(${p.demo_note})` : ''}</div>
                            <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}><button className="fe-btn" onClick={() => setStep(3)}>Tôi đã chuyển khoản</button><button className="fe-btn ghost" onClick={() => setStep(1)}>Đổi số tiền</button></div>
                        </div></section>
                    )}

                    {step === 3 && (
                        <section className="fe-card"><div className="fe-card-h"><h2>Xác nhận thông tin đã chuyển</h2></div><div className="fe-card-b">
                            {error && <div className="fe-error" role="alert">{error}</div>}
                            <div className="fe-field"><label>Hình thức</label>
                                <select className="fe-sel" value={method} onChange={(e) => setMethod(e.target.value as any)}><option value="bank_transfer">Chuyển khoản ngân hàng</option><option value="ewallet">Ví điện tử</option></select></div>
                            <div className="fe-field"><label htmlFor="ref">Mã giao dịch</label><input id="ref" className="fe-in" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="VD: FT26123456789" maxLength={60} /><span className="hint">Xem trong tin nhắn hoặc lịch sử giao dịch của ngân hàng.</span></div>
                            <div className="fe-field"><label htmlFor="when">Thời điểm chuyển</label><input id="when" type="datetime-local" className="fe-in" value={when} max={nowLocal()} onChange={(e) => setWhen(e.target.value)} /></div>
                            <div className="fe-field"><label htmlFor="note">Ghi chú (không bắt buộc)</label><input id="note" className="fe-in" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} /></div>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button className="fe-btn" disabled={busy || ref.trim().length < 4} onClick={submit}>{busy ? 'Đang gửi…' : `Gửi xác nhận ${vnd(amount)}`}</button><button className="fe-btn ghost" onClick={() => setStep(2)}>Quay lại</button></div>
                        </div></section>
                    )}
                </div>

                <aside>
                    <section className="fe-card"><div className="fe-card-h"><h2>Hóa đơn</h2></div><div className="fe-card-b fe-sum">
                        <div><span>{v.code}</span><b>{v.term_label}</b></div>
                        <div><span>Tổng hóa đơn</span><b>{vnd(v.total)}</b></div>
                        <div><span>Đã thanh toán</span><b>{vnd(v.paid)}</b></div>
                        {v.pending > 0 && <div><span>Đang chờ xác nhận</span><b>{vnd(v.pending)}</b></div>}
                        <div className="tot"><span>Có thể thanh toán</span><b>{vnd(max)}</b></div>
                    </div></section>
                    <section className="fe-card"><div className="fe-card-h"><h2>Nộp trực tiếp</h2></div><div className="fe-card-b"><p>{p.office}</p><p style={{ marginTop: 6 }}>Hotline: <b>{p.hotline}</b></p></div></section>
                </aside>
            </div>
        </div>
    );
}