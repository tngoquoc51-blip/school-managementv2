'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, digits, group, initial, Invoice, KtError, Meta, nowInput, Overview, PAY_STATUS, qs, StudentDetail, StudentRow, STATE, toServerTime, vnd } from '../_lib/cash';
import { Card, Chip, Empty, ErrorBox, Field, Loading, Modal, Pager, Stat, useApi, Ico, ICON } from '../../periods/_components/ui';
import { ReceiptModal } from './Receipt';

type Props = {
    meta: Meta; overview: Overview | null; studentId: number | null;
    onSelect: (id: number | null) => void; onChanged: () => void;
    onGo: (target: 'queue' | 'disputes', q?: string) => void;
    toast: { ok: (m: string) => void; fail: (m: string) => void };
};

const DEBT_CHIPS: [string, string][] = [['all', 'Tất cả'], ['overdue', 'Nợ quá hạn'], ['owing', 'Còn nợ'], ['pending', 'Có khoản chờ duyệt']];

export function Counter({ meta, overview, studentId, onSelect, onChanged, onGo, toast }: Props) {
    /* ---------- tìm học sinh ---------- */
    const [q, setQ] = useState('');
    const [dq, setDq] = useState('');
    const [classId, setClassId] = useState('');
    const [grade, setGrade] = useState('');
    const [debt, setDebt] = useState('all');
    const [page, setPage] = useState(1);
    useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 350); return () => clearTimeout(t); }, [q]);
    useEffect(() => setPage(1), [dq, classId, grade, debt]);
    const hasFilter = !!(dq || classId || grade || debt !== 'all');
    const list = useApi<{ items: StudentRow[]; total: number; pages: number; hint?: string }>(hasFilter ? `cashier/students${qs({ q: dq, class_id: classId, grade, debt, page })}` : null);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const it = list.data?.items;
        if (hasFilter && it && it.length === 1 && dq && it[0].code.toLowerCase() === dq.toLowerCase() && studentId !== it[0].id) onSelect(it[0].id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [list.data]);

    const pick = (id: number) => {
        onSelect(id);
        if (typeof window !== 'undefined' && window.innerWidth < 1000) setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    };
    const classesShown = meta.classes.filter((c) => !grade || String(c.grade) === grade);

    /* ---------- hồ sơ + chọn hóa đơn để thu ---------- */
    const det = useApi<StudentDetail>(studentId ? `cashier/students/${studentId}` : null);
    const d = studentId ? det.data : null;
    const [sel, setSel] = useState<Record<number, string>>({});
    const [openLines, setOpenLines] = useState<Record<number, boolean>>({});
    const [showPaid, setShowPaid] = useState(false);
    const [method, setMethod] = useState('cash');
    const [ref, setRef] = useState('');
    const [note, setNote] = useState('');
    const [paidAt, setPaidAt] = useState('');
    const [tendered, setTendered] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [done, setDone] = useState<{ ids: number[]; total: number } | null>(null);
    const [view, setView] = useState<number | null>(null);
    const [qrBad, setQrBad] = useState(false);

    useEffect(() => { setSel({}); setOpenLines({}); setShowPaid(false); setRef(''); setNote(''); setPaidAt(''); setTendered(''); setErrs({}); setMethod('cash'); }, [studentId]);

    const openInv = useMemo(() => (d ? d.invoices.filter((i) => i.balance > 0).sort((a, b) => a.due_iso.localeCompare(b.due_iso)) : []), [d]);
    const paidInv = useMemo(() => (d ? d.invoices.filter((i) => i.balance === 0) : []), [d]);
    const shown: Invoice[] = showPaid ? [...openInv, ...paidInv] : openInv;
    const byId = useMemo(() => Object.fromEntries((d?.invoices || []).map((i) => [i.id, i])), [d]);
    const picked = Object.keys(sel).map(Number).filter((id) => byId[id]);
    const total = picked.reduce((s, id) => s + digits(sel[id]), 0);
    const m = meta.methods.find((x) => x.key === method);
    const needRef = !!m?.needs_ref;

    const toggle = (i: Invoice) => setSel((s) => { const n = { ...s }; if (i.id in n) delete n[i.id]; else n[i.id] = String(i.collectable); return n; });
    const setAmt = (i: Invoice, v: string) => setSel((s) => ({ ...s, [i.id]: String(Math.min(i.collectable, digits(v))) }));
    const pickAll = (onlyOverdue: boolean) => setSel(Object.fromEntries(openInv.filter((i) => i.collectable > 0 && (!onlyOverdue || i.overdue)).map((i) => [i.id, String(i.collectable)])));

    const problems: string[] = [];
    picked.forEach((id) => {
        const i = byId[id]; const a = digits(sel[id]);
        if (a <= 0) problems.push(`Nhập số tiền thu cho hóa đơn ${i.code}.`);
        else if (a < meta.limits.min_amount && a !== i.collectable) problems.push(`Hóa đơn ${i.code}: tối thiểu ${vnd(meta.limits.min_amount)} (trừ khi thu hết số còn lại).`);
    });
    if (total > meta.limits.max_total) problems.push(`Tổng một lần thu tối đa ${vnd(meta.limits.max_total)}.`);
    if (needRef && (ref.trim().length < 4 || ref.trim().length > 60)) problems.push('Nhập mã giao dịch từ 4 đến 60 ký tự.');
    if (paidAt && paidAt > nowInput()) problems.push('Thời điểm thu không được ở tương lai.');
    const canSubmit = picked.length > 0 && total > 0 && problems.length === 0;
    const give = digits(tendered);
    const firstInv = picked.length ? byId[picked[0]] : null;

    const qrUrl = method === 'bank_transfer' && meta.pay_info.bank_bin && meta.pay_info.account_no && total > 0 && d
        ? `https://img.vietqr.io/image/${meta.pay_info.bank_bin}-${meta.pay_info.account_no}-compact2.png?amount=${total}&addInfo=${encodeURIComponent(`${d.student.code} ${firstInv?.code || ''}`.trim())}&accountName=${encodeURIComponent(meta.pay_info.account_name)}`
        : '';
    useEffect(() => setQrBad(false), [qrUrl]);

    const submit = async () => {
        if (!d) return;
        setBusy(true); setErrs({});
        try {
            const r = await api<{ total: number; payments: { id: number }[] }>('cashier/collect', {
                method: 'POST',
                body: { student_id: d.student.id, method, reference: needRef ? ref.trim() : '', note: note.trim(), paid_at: paidAt ? toServerTime(paidAt) : undefined, items: picked.map((id) => ({ invoice_id: id, amount: digits(sel[id]) })) },
            });
            setConfirming(false);
            setDone({ ids: r.payments.map((p) => p.id), total: r.total });
        } catch (e) {
            const x = e as KtError;
            setConfirming(false); setErrs(x.errors || {}); toast.fail(x.message);
        } finally { setBusy(false); }
    };
    const finish = () => {
        setDone(null); setSel({}); setRef(''); setNote(''); setTendered(''); setPaidAt('');
        det.reload(); onChanged();
    };

    /* ---------- hiển thị ---------- */
    return (
        <div className="cl-counter">
            <aside className="cl-find" aria-label="Tìm học sinh">
                <Card title="Tìm học sinh" className="cl-find-card">
                    <div className="cl-search">
                        <input className="pd-in" aria-label="Tìm học sinh" placeholder="Mã học sinh hoặc họ tên…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
                        <div className="cl-search-row">
                            <select className="pd-in" aria-label="Khối" value={grade} onChange={(e) => { setGrade(e.target.value); setClassId(''); }}>
                                <option value="">Mọi khối</option>{[10, 11, 12].map((g) => <option key={g} value={g}>Khối {g}</option>)}
                            </select>
                            <select className="pd-in" aria-label="Lớp" value={classId} onChange={(e) => setClassId(e.target.value)}>
                                <option value="">Mọi lớp</option>{classesShown.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="pd-chips" role="group" aria-label="Lọc theo công nợ">
                            {DEBT_CHIPS.map(([k, l]) => <button key={k} className={debt === k ? 'on' : ''} onClick={() => setDebt(k)}>{l}</button>)}
                        </div>
                    </div>
                    {!hasFilter && (
                        <div className="cl-hint">
                            <p>Nhập <b>mã học sinh</b> hoặc <b>họ tên</b>, hoặc chọn lớp / bộ lọc công nợ để bắt đầu thu.</p>
                            {overview && overview.top_debtors.length > 0 && (
                                <>
                                    <h4 className="cl-h4">Nợ quá hạn nhiều nhất</h4>
                                    <ul className="cl-res">
                                        {overview.top_debtors.slice(0, 6).map((t) => (
                                            <li key={t.id}><button className={studentId === t.id ? 'on' : ''} onClick={() => pick(t.id)}>
                                                <i className="cl-av" aria-hidden>{initial(t.name)}</i>
                                                <span><b>{t.name}</b><small>{t.code} · {t.class || '—'} · quá hạn {t.max_days} ngày</small></span>
                                                <em className="bad">{vnd(t.overdue)}</em>
                                            </button></li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    )}
                    {hasFilter && list.loading && <Loading text="Đang tìm…" />}
                    {hasFilter && list.err && <ErrorBox msg={list.err} retry={list.reload} />}
                    {hasFilter && !list.loading && list.data && (
                        list.data.items.length === 0
                            ? <Empty text={list.data.hint || 'Không tìm thấy học sinh phù hợp.'} />
                            : (
                                <>
                                    <p className="cl-count">{list.data.total.toLocaleString('vi-VN')} học sinh</p>
                                    <ul className="cl-res">
                                        {list.data.items.map((s) => (
                                            <li key={s.id}><button className={studentId === s.id ? 'on' : ''} onClick={() => pick(s.id)}>
                                                <i className="cl-av" aria-hidden>{initial(s.name)}</i>
                                                <span><b>{s.name}</b><small>{s.code} · {s.class || '—'}{s.pending > 0 ? ` · ${vnd(s.pending)} chờ duyệt` : ''}</small></span>
                                                {s.balance > 0 ? <em className={s.overdue > 0 ? 'bad' : 'warn'}>{vnd(s.balance)}</em> : <Chip tone={STATE[s.state].tone}>{STATE[s.state].label}</Chip>}
                                            </button></li>
                                        ))}
                                    </ul>
                                    <Pager page={page} pages={list.data.pages} onChange={setPage} />
                                </>
                            )
                    )}
                </Card>
            </aside>

            <div className="cl-work" ref={panelRef}>
                {!studentId && (
                    <div className="cl-welcome">
                        <i aria-hidden><Ico d={ICON.cash} s={30} /></i>
                        <h2>Chọn một học sinh để thu tiền</h2>
                        <p>Công nợ hiển thị theo từng hóa đơn. Anh/chị chọn hóa đơn, nhập số tiền, chọn hình thức thanh toán rồi ghi nhận. Hệ thống tạo phiếu thu và cho in ngay.</p>
                        <ol>
                            <li>Tìm học sinh bằng mã hoặc họ tên</li>
                            <li>Tích chọn hóa đơn cần thu (có thể thu một phần)</li>
                            <li>Chọn hình thức, kiểm tra lại và xác nhận thu</li>
                        </ol>
                    </div>
                )}
                {studentId && det.loading && !d && <Card><Loading text="Đang tải hồ sơ thu của học sinh…" /></Card>}
                {studentId && det.err && <ErrorBox msg={det.err} retry={det.reload} />}

                {d && (
                    <>
                        <section className="cl-banner">
                            <i className="cl-av lg" aria-hidden>{initial(d.student.name)}</i>
                            <div className="cl-banner-info">
                                <h2>{d.student.name}</h2>
                                <p>Mã <b>{d.student.code}</b> · Lớp <b>{d.student.class || 'chưa xếp lớp'}</b> · Năm học {d.student.year}{d.student.birth_date ? ` · Sinh ${d.student.birth_date}` : ''}</p>
                                {d.waivers.length > 0 && <div className="cl-waivers">{d.waivers.map((w) => <span key={w.id} title={`Năm học ${w.year}`}>Giảm {w.percent}% học phí · {w.label}</span>)}</div>}
                            </div>
                            <div className="cl-banner-debt">
                                <span>Tổng còn nợ</span>
                                <b className={d.totals.balance > 0 ? 'debt' : ''}>{vnd(d.totals.balance)}</b>
                                <Chip tone={d.totals.overdue > 0 ? 'err' : d.totals.balance > 0 ? 'warn' : 'ok'}>{d.totals.overdue > 0 ? `Quá hạn ${vnd(d.totals.overdue)}` : d.totals.balance > 0 ? 'Chưa đến hạn' : 'Đã đóng đủ'}</Chip>
                            </div>
                            <button className="cl-banner-x" onClick={() => onSelect(null)} aria-label="Bỏ chọn học sinh">×</button>
                        </section>

                        <div className="pd-stats cl-mini">
                            <Stat label="Tổng phải thu" value={vnd(d.totals.billed)} tone="info" icon={<Ico d={ICON.doc} />} />
                            <Stat label="Đã thu" value={vnd(d.totals.paid)} tone="ok" icon={<Ico d={ICON.check} />} />
                            <Stat label="Chờ xác nhận" value={vnd(d.totals.pending)} tone="warn" icon={<Ico d={ICON.hourglass} />} />
                            <Stat label="Quá hạn" value={vnd(d.totals.overdue)} tone={d.totals.overdue > 0 ? 'err' : 'mut'} icon={<Ico d={ICON.alert} />} />
                        </div>

                        {d.disputes.some((x) => x.status === 'open') && (
                            <div className="pd-alert warn">
                                <b>Học sinh có phản hồi về hóa đơn chưa được trả lời.</b>
                                <ul>{d.disputes.filter((x) => x.status === 'open').map((x) => <li key={x.id}>Hóa đơn {x.invoice_code}: “{x.message}”</li>)}</ul>
                                <button className="pd-btn ghost sm" onClick={() => onGo('disputes')}>Mở danh sách phản hồi</button>
                            </div>
                        )}
                        {d.totals.pending > 0 && (
                            <div className="pd-alert info">
                                <span>Có <b>{vnd(d.totals.pending)}</b> học sinh đã khai báo chuyển khoản, đang chờ đối chiếu. Phần này chưa tính vào số được thu tại quầy để tránh thu trùng.</span>
                                <button className="pd-btn ghost sm" onClick={() => onGo('queue', d.student.code)}>Đối chiếu ngay</button>
                            </div>
                        )}

                        <Card title="Hóa đơn cần thu" right={
                            <div className="cl-quickpick">
                                <button className="pd-quick-b" onClick={() => pickAll(false)} disabled={!openInv.some((i) => i.collectable > 0)}>Chọn tất cả</button>
                                <button className="pd-quick-b" onClick={() => pickAll(true)} disabled={!openInv.some((i) => i.overdue && i.collectable > 0)}>Chỉ quá hạn</button>
                                <button className="pd-quick-b" onClick={() => setSel({})} disabled={picked.length === 0}>Bỏ chọn</button>
                            </div>} pad={false}>
                            {shown.length === 0 ? <Empty text={d.invoices.length === 0 ? 'Học sinh chưa có hóa đơn nào. Hóa đơn được tạo khi phát hành Đợt thu.' : 'Học sinh đã đóng đủ mọi hóa đơn. Không còn khoản nào cần thu.'} /> : (
                                <ul className="cl-inv">
                                    {shown.map((i) => {
                                        const on = i.id in sel; const blocked = i.collectable <= 0;
                                        return (
                                            <li key={i.id} className={`${on ? 'sel' : ''} ${blocked ? 'off' : ''} ${i.overdue ? 'late' : ''}`}>
                                                <label className="cl-inv-pick">
                                                    <input type="checkbox" checked={on} disabled={blocked} onChange={() => toggle(i)} aria-label={`Chọn hóa đơn ${i.code}`} />
                                                    <span className="cl-inv-main">
                            <b>{i.title}</b>
                            <small><span className="pd-mono">{i.code}</span> · {i.year} · hạn {i.due_date}</small>
                            <span className="cl-tags">
                              {i.overdue && <Chip tone="err">Quá hạn {i.overdue_days} ngày</Chip>}
                                {i.status === 'partial' && <Chip tone="warn">Đã đóng một phần</Chip>}
                                {i.status === 'paid' && <Chip tone="ok">Đã đóng đủ</Chip>}
                                {i.pending > 0 && <Chip tone="info">{vnd(i.pending)} chờ xác nhận</Chip>}
                                {i.period?.status === 'closed' && <Chip tone="mut">Đợt thu đã kết thúc</Chip>}
                                {!i.current_year && <Chip tone="mut">Năm học trước</Chip>}
                            </span>
                          </span>
                                                </label>
                                                <div className="cl-inv-nums">
                                                    <div><span>Phải thu</span><b>{vnd(i.total)}</b></div>
                                                    <div><span>Đã thu</span><b className="ok">{vnd(i.paid)}</b></div>
                                                    <div><span>Còn lại</span><b className={i.balance > 0 ? 'bad' : 'ok'}>{vnd(i.balance)}</b></div>
                                                </div>
                                                <div className="cl-inv-amt">
                                                    <label htmlFor={`amt-${i.id}`}>Thu lần này</label>
                                                    <div><input id={`amt-${i.id}`} className="pd-in" inputMode="numeric" disabled={!on} placeholder={blocked ? '—' : '0'} value={on ? group(digits(sel[i.id])) : ''} onChange={(e) => setAmt(i, e.target.value)} /><span>đ</span></div>
                                                    {on && <button className="cl-link" onClick={() => setAmt(i, String(i.collectable))}>Thu đủ {vnd(i.collectable)}</button>}
                                                </div>
                                                <button className="cl-link cl-inv-more" onClick={() => setOpenLines((o) => ({ ...o, [i.id]: !o[i.id] }))} aria-expanded={!!openLines[i.id]}>{openLines[i.id] ? 'Ẩn chi tiết' : 'Xem chi tiết khoản thu'}</button>
                                                {openLines[i.id] && (
                                                    <table className="cl-lines">
                                                        <thead><tr><th>Khoản thu</th><th className="n">SL</th><th className="n">Đơn giá</th><th className="n">Miễn giảm</th><th className="n">Thành tiền</th></tr></thead>
                                                        <tbody>{i.lines.map((l, k) => <tr key={k}><td>{l.description}</td><td className="n">{l.quantity}</td><td className="n">{vnd(l.unit_price)}</td><td className="n">{l.discount ? `-${vnd(l.discount)}` : '—'}</td><td className="n">{vnd(l.amount)}</td></tr>)}</tbody>
                                                    </table>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                            {paidInv.length > 0 && (
                                <div className="cl-foldbar"><button className="cl-link" onClick={() => setShowPaid((v) => !v)}>{showPaid ? 'Ẩn' : 'Hiện'} {paidInv.length} hóa đơn đã đóng đủ</button></div>
                            )}
                        </Card>

                        <Card title="Thanh toán">
                            <div className="cl-pay">
                                <div className="cl-pay-l">
                                    <div className="pd-field"><label>Hình thức thanh toán</label>
                                        <div className="pd-seg" role="radiogroup" aria-label="Hình thức thanh toán">
                                            {meta.methods.map((x) => (
                                                <button key={x.key} role="radio" aria-checked={method === x.key} className={method === x.key ? 'on' : ''} onClick={() => setMethod(x.key)}>{x.label}<em>{x.needs_ref ? 'Cần mã giao dịch' : 'Nhận tại quầy'}</em></button>
                                            ))}
                                        </div>
                                    </div>
                                    {needRef && (
                                        <Field label={method === 'card' ? 'Số chuẩn chi / mã giao dịch POS' : 'Mã giao dịch'} error={errs.reference} hint="Dùng để đối soát với sao kê. Mỗi mã chỉ ghi nhận một lần." htmlFor="cl-ref">
                                            <input id="cl-ref" className="pd-in" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={60} placeholder="Ví dụ: FT26298123456" />
                                        </Field>
                                    )}
                                    <div className="pd-row">
                                        <Field label="Ghi chú (không bắt buộc)" htmlFor="cl-note"><input id="cl-note" className="pd-in" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} placeholder="Ví dụ: Phụ huynh nộp thay" /></Field>
                                        <Field label="Thời điểm thu" hint="Để trống là thời điểm hiện tại" htmlFor="cl-at"><input id="cl-at" type="datetime-local" className="pd-in" value={paidAt} max={nowInput()} onChange={(e) => setPaidAt(e.target.value)} /></Field>
                                    </div>
                                    {method === 'cash' && total > 0 && (
                                        <div className="cl-change">
                                            <Field label="Tiền khách đưa" htmlFor="cl-give"><input id="cl-give" className="pd-in" inputMode="numeric" value={group(give)} onChange={(e) => setTendered(e.target.value)} placeholder="0" /></Field>
                                            <div className="cl-quickcash">{[total, 100000, 200000, 500000, 1000000].filter((v, i, a) => a.indexOf(v) === i && v >= total).slice(0, 4).map((v) => <button key={v} onClick={() => setTendered(String(v))}>{vnd(v)}</button>)}</div>
                                            {give > 0 && <p className={give >= total ? 'ok' : 'bad'}>{give >= total ? <>Tiền thối lại: <b>{vnd(give - total)}</b></> : <>Còn thiếu: <b>{vnd(total - give)}</b></>}</p>}
                                        </div>
                                    )}
                                    {qrUrl && !qrBad && (
                                        <div className="cl-qr">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={qrUrl} alt="Mã QR chuyển khoản" width={140} height={140} onError={() => setQrBad(true)} />
                                            <div><b>Quét mã để chuyển khoản</b><span>{meta.pay_info.bank_short} · {meta.pay_info.account_no}</span><span>{meta.pay_info.account_name}</span>{meta.pay_info.demo_note && <small>{meta.pay_info.demo_note}</small>}</div>
                                        </div>
                                    )}
                                </div>
                                <div className="cl-pay-r">
                                    <span>Tổng thu lần này</span>
                                    <b>{vnd(total)}</b>
                                    <small>{picked.length} hóa đơn · {m?.label}</small>
                                    {problems.length > 0 && picked.length > 0 && <ul className="cl-problems">{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>}
                                    <button className="pd-btn cl-submit" disabled={!canSubmit} onClick={() => setConfirming(true)}>Ghi nhận thu &amp; in phiếu</button>
                                    {picked.length === 0 && <small>Hãy tích chọn ít nhất một hóa đơn ở trên.</small>}
                                </div>
                            </div>
                        </Card>

                        <Card title="Giao dịch gần đây của học sinh" pad={false}>
                            {d.recent_payments.length === 0 ? <Empty text="Học sinh chưa có giao dịch nào." /> : (
                                <div className="pd-tw">
                                    <table className="pd-table">
                                        <thead><tr><th>Mã phiếu</th><th>Hóa đơn</th><th>Hình thức</th><th className="n">Số tiền</th><th>Thời điểm</th><th>Trạng thái</th></tr></thead>
                                        <tbody>
                                        {d.recent_payments.map((p) => (
                                            <tr key={p.id}>
                                                <td><button className="cl-link mono" onClick={() => setView(p.id)}>{p.receipt_code}</button></td>
                                                <td className="pd-mono">{p.invoice.code}</td>
                                                <td>{p.method_label}{p.reference && <small>{p.reference}</small>}</td>
                                                <td className="n"><b>{vnd(p.amount)}</b></td>
                                                <td>{p.confirmed_at || p.paid_at}{p.confirmed_by && <small>{p.confirmed_by}</small>}</td>
                                                <td><Chip tone={PAY_STATUS[p.status]?.tone}>{PAY_STATUS[p.status]?.label}</Chip>{p.reason && <small>{p.reason}</small>}</td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card>
                    </>
                )}
            </div>

            {confirming && d && (
                <Modal title="Xác nhận ghi nhận thu" onClose={() => !busy && setConfirming(false)}
                       foot={<><button className="pd-btn ghost" disabled={busy} onClick={() => setConfirming(false)}>Kiểm tra lại</button><button className="pd-btn" disabled={busy} onClick={submit}>{busy ? 'Đang ghi nhận…' : `Xác nhận thu ${vnd(total)}`}</button></>}>
                    <p>Thu của học sinh <b>{d.student.name}</b> ({d.student.code}, lớp {d.student.class || '—'}) bằng <b>{m?.label.toLowerCase()}</b>{needRef && <> · mã GD <span className="pd-mono">{ref.trim()}</span></>}:</p>
                    <table className="cl-lines">
                        <tbody>
                        {picked.map((id) => <tr key={id}><td>{byId[id].title}<small className="pd-mono">{byId[id].code}</small></td><td className="n"><b>{vnd(digits(sel[id]))}</b>{digits(sel[id]) < byId[id].balance && <small>còn lại {vnd(byId[id].balance - digits(sel[id]))}</small>}</td></tr>)}
                        <tr className="sum"><td>Tổng cộng</td><td className="n"><b>{vnd(total)}</b></td></tr>
                        </tbody>
                    </table>
                    <p className="pd-muted">Phiếu thu được lập ngay và tính vào công nợ của học sinh. Nếu nhập nhầm, Kế toán có thể hủy phiếu trong ngày (có ghi lý do).</p>
                </Modal>
            )}
            {done && <ReceiptModal ids={done.ids} title="Đã ghi nhận thu" onClose={finish} banner={<div className="pd-alert info cl-okbar"><b>Đã thu {vnd(done.total)}.</b><span>Bấm “In” để in phiếu thu giao cho phụ huynh.</span></div>} />}
            {view && <ReceiptModal ids={[view]} onClose={() => setView(null)} />}
        </div>
    );
}