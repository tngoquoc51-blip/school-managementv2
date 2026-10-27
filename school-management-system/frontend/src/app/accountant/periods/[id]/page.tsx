'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card, Chip, Empty, ErrorBox, Field, ICON, Ico, Loading, Modal, Pager, Progress, Stat, Toast, useApi, useStaff, useToast } from '../_components/ui';
import { ACTION_LABEL, CATEGORY, INV_STATUS, PHASE, addDays, api, downloadCsv, fmtDate, fmtDateTime, pct, qs, vnd, vndShort } from '../_lib/api';

const TABS: [string, string][] = [['overview', 'Tổng quan'], ['invoices', 'Hóa đơn'], ['items', 'Khoản thu'], ['log', 'Nhật ký']];
type Dlg = null | 'issue' | 'extend' | 'close' | 'reopen' | 'cancel';

export default function PeriodDetail() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { staff } = useStaff();
    const { data: p, err, loading, reload } = useApi<any>(`periods/${id}`);
    const [tab, setTab] = useState('overview');
    const [dlg, setDlg] = useState<Dlg>(null);
    const toast = useToast();
    useEffect(() => { const t = new URLSearchParams(window.location.search).get('tab'); if (t && TABS.some(([k]) => k === t)) setTab(t); }, []);
    const go = (t: string) => { setTab(t); try { window.history.replaceState(null, '', `?tab=${t}`); } catch { /* bỏ qua */ } };

    if (loading && !p) return <Loading />;
    if (err || !p) return <ErrorBox msg={err || 'Không tìm thấy đợt thu'} retry={reload} />;
    const ph = PHASE[p.phase] ?? PHASE.open;
    const s = p.stats;
    const a = p.actions;
    const dueTxt = p.status === 'open' ? (p.days_left < 0 ? `quá hạn ${-p.days_left} ngày` : p.days_left === 0 ? 'hạn nộp là hôm nay' : `còn ${p.days_left} ngày`) : '';

    const exportDebtors = async () => {
        try {
            const d = await api<any>(`periods/${p.id}/debtors`);
            downloadCsv(`cong-no-${p.code}.csv`, [
                ['Lớp', 'Mã học sinh', 'Họ và tên', 'Mã hóa đơn', 'Tổng phải đóng', 'Đã đóng', 'Còn nợ', 'Hạn nộp', 'Số ngày quá hạn'],
                ...d.items.map((r: any) => [r.class_name ?? '', r.student_code, r.student_name, r.code, r.total, r.paid, r.remaining, fmtDate(r.due_date), r.days_overdue]),
            ]);
            toast.ok(`Đã xuất ${d.items.length} học sinh còn nợ.`);
        } catch (e: any) { toast.fail(e.message); }
    };

    return (
        <>
            <div className="pd-head">
                <div>
                    <nav className="pd-crumb" aria-label="Đường dẫn"><Link href="/accountant/periods">Đợt thu / Kỳ thu</Link><i>›</i><b>{p.code}</b></nav>
                    <h1>{p.name} <Chip tone={ph.tone}>{ph.label}</Chip></h1>
                    <p>{p.year_label} · {p.term_label} · {p.scope_label}{p.note ? ` · ${p.note}` : ''}</p>
                </div>
                <div className="pd-head-act">
                    {a.edit && <Link className="pd-btn ghost" href={`/accountant/periods/${p.id}/edit`}>Sửa bản nháp</Link>}
                    {p.status !== 'draft' && p.status !== 'cancelled' && <button className="pd-btn ghost" onClick={exportDebtors}>Xuất danh sách còn nợ</button>}
                    {a.extend && <button className="pd-btn ghost" onClick={() => setDlg('extend')}>Gia hạn</button>}
                    {a.close && <button className="pd-btn ghost" onClick={() => setDlg('close')}>Kết thúc đợt</button>}
                    {a.reopen && <button className="pd-btn ghost" onClick={() => setDlg('reopen')}>Mở lại đợt</button>}
                    {a.cancel && <button className="pd-btn danger" onClick={() => setDlg('cancel')}>Hủy đợt</button>}
                    {a.issue && <button className="pd-btn" onClick={() => setDlg('issue')}>{p.status === 'draft' ? 'Phát hành hóa đơn' : 'Phát hành bổ sung'}</button>}
                </div>
            </div>

            <div className="pd-meta">
                <div><span>Ngày mở</span><b>{fmtDate(p.open_date)}</b></div>
                <div><span>Hạn nộp</span><b className={p.days_left < 0 && p.status === 'open' && s.remaining > 0 ? 'bad' : ''}>{fmtDate(p.due_date)}</b>{dueTxt && <em>{dueTxt}</em>}</div>
                <div><span>Hóa đơn</span><b>{s.invoices.toLocaleString('vi-VN')}</b><em>{s.students.toLocaleString('vi-VN')} học sinh</em></div>
                <div><span>Người tạo</span><b>{p.created_by || '—'}</b><em>{fmtDate(p.created_at?.slice(0, 10))}</em></div>
                {p.issued_at && <div><span>Phát hành</span><b>{fmtDate(p.issued_at.slice(0, 10))}</b></div>}
            </div>

            {p.status === 'draft' ? (
                <Card><Empty text="Đợt thu này đang là bản nháp, chưa có hóa đơn nào."><p className="pd-muted">Kiểm tra khoản thu ở thẻ “Khoản thu”, sau đó bấm “Phát hành hóa đơn”. Hệ thống sẽ cho xem trước số học sinh, tổng tiền và miễn giảm trước khi tạo.</p></Empty></Card>
            ) : (
                <>
                    <div className="pd-stats five">
                        <Stat label="Phải thu" value={vndShort(s.billed)} hint={vnd(s.billed)} tone="info" icon={<Ico d={ICON.cash} />} />
                        <Stat label="Đã thu" value={vndShort(s.paid)} hint={`${s.paid_count} hóa đơn đóng đủ`} tone="ok" icon={<Ico d={ICON.check} />} />
                        <Stat label="Còn lại" value={vndShort(s.remaining)} hint={`${s.partial_count + s.unpaid_count} hóa đơn chưa đủ`} tone="warn" icon={<Ico d={ICON.hourglass} />} />
                        <Stat label="Quá hạn" value={vndShort(s.overdue_amount)} hint={`${s.overdue_count} hóa đơn`} tone={s.overdue_count ? 'err' : 'mut'} icon={<Ico d={ICON.alert} />} />
                        <Stat label="Chờ xác nhận" value={vndShort(s.pending)} hint={`${p.pending_payments} khoản học sinh khai báo`} tone={s.pending ? 'pri' : 'mut'} icon={<Ico d={ICON.clock} />} />
                    </div>
                    <Card>
                        <div className="pd-bigprog">
                            <div className="pd-bigprog-h"><b>Tiến độ thu: {pct(s.rate)}</b><span>{vnd(s.paid)} / {vnd(s.billed)}</span></div>
                            <Progress paid={s.paid} pending={s.pending} total={s.billed} tall />
                            <div className="pd-legend"><i className="ok" />Đã thu<i className="pend" />Chờ xác nhận<i className="rest" />Còn lại</div>
                        </div>
                    </Card>
                    {(p.pending_payments > 0 || p.open_disputes > 0) && p.status !== 'cancelled' && (
                        <div className="pd-alert info" role="status">
                            {p.pending_payments > 0 && <span><b>{p.pending_payments}</b> khoản học sinh đã khai báo chuyển khoản đang chờ kế toán đối chiếu và xác nhận. <Link href="/accountant/collection">Mở trang Thu học phí</Link></span>}
                            {p.open_disputes > 0 && <span><b>{p.open_disputes}</b> thắc mắc về hóa đơn của đợt này chưa được trả lời.</span>}
                        </div>
                    )}
                </>
            )}

            <div className="pd-tabs solo" role="tablist">
                {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => go(k)}>{l}{k === 'invoices' && p.status !== 'draft' ? <em>{s.invoices}</em> : null}</button>)}
            </div>

            {tab === 'overview' && <Overview p={p} />}
            {tab === 'invoices' && (p.status === 'draft' ? <Card><Empty text="Chưa có hóa đơn. Phát hành đợt thu để tạo hóa đơn." /></Card> : <Invoices id={p.id} />)}
            {tab === 'items' && <Items p={p} />}
            {tab === 'log' && <Log p={p} />}

            {dlg && <Dialogs dlg={dlg} p={p} staffRole={staff?.role ?? ''} close={() => setDlg(null)} onDone={(msg, leave) => { setDlg(null); toast.ok(msg); if (leave) setTimeout(() => router.push('/accountant/periods'), 900); else reload(); }} onFail={toast.fail} />}
            <Toast t={toast.t} clear={toast.clear} />
        </>
    );
}

/* ====================================================== TỔNG QUAN */
function Overview({ p }: { p: any }) {
    if (p.status === 'draft') return null;
    const max = Math.max(1, ...p.daily.map((d: any) => d.amount));
    return (
        <div className="pd-cols">
            <Card title="Tiến độ theo khối" pad={false}>
                <div className="pd-tw"><table className="pd-table"><thead><tr><th>Khối</th><th className="n">Hóa đơn</th><th>Tiến độ</th><th className="n">Còn lại</th></tr></thead><tbody>
                {p.by_grade.map((g: any) => <tr key={g.key}><td><b>{g.label}</b></td><td className="n">{g.invoices}</td><td><div className="pd-mini"><Progress paid={g.paid} total={g.billed} /><span>{pct(g.rate)}</span></div></td><td className="n">{vndShort(g.remaining)}</td></tr>)}
                </tbody></table></div>
            </Card>
            <Card title="Thu theo ngày" right={<span className="pd-muted">{p.daily.length ? `${p.daily.length} ngày có thu` : ''}</span>}>
                {p.daily.length === 0 ? <p className="pd-muted">Chưa có khoản thu nào được xác nhận.</p> : (
                    <div className="pd-chart" role="img" aria-label="Biểu đồ số tiền thu theo ngày">
                        {p.daily.map((d: any) => <div key={d.date} className="pd-bar" title={`${fmtDate(d.date)}: ${vnd(d.amount)} (${d.count} giao dịch)`}><i style={{ height: `${Math.max(4, (d.amount / max) * 100)}%` }} /><span>{d.date.slice(8, 10)}/{d.date.slice(5, 7)}</span></div>)}
                    </div>
                )}
            </Card>
            <Card title="Tiến độ theo lớp" pad={false} className="wide">
                <div className="pd-tw"><table className="pd-table"><thead><tr><th>Lớp</th><th className="n">Hóa đơn</th><th className="n">Đóng đủ</th><th>Tiến độ</th><th className="n">Còn lại</th></tr></thead><tbody>
                {p.by_class.map((c: any) => <tr key={c.key}><td><b>{c.label}</b></td><td className="n">{c.invoices}</td><td className="n">{c.paid_count}/{c.invoices}</td><td><div className="pd-mini"><Progress paid={c.paid} total={c.billed} /><span>{pct(c.rate)}</span></div></td><td className="n">{vnd(c.remaining)}</td></tr>)}
                </tbody></table></div>
            </Card>
            <Card title="Hình thức thanh toán">
                {p.methods.length === 0 ? <p className="pd-muted">Chưa có giao dịch.</p> : <ul className="pd-bars">{p.methods.map((m: any) => <li key={m.method}><span>{m.label}</span><div><i style={{ width: `${(m.amount / p.methods[0].amount) * 100}%` }} /></div><b>{vndShort(m.amount)}</b><em>{m.count} giao dịch</em></li>)}</ul>}
            </Card>
            <Card title="Miễn giảm đã áp dụng">
                <div className="pd-big"><b>{p.waivers.invoices}</b><span>hóa đơn được giảm</span></div>
                <p className="pd-muted">Tổng tiền giảm {vnd(p.waivers.amount)}. Quản lý danh sách miễn giảm ở mục “Miễn giảm học phí” trong menu.</p>
            </Card>
        </div>
    );
}

/* ====================================================== HÓA ĐƠN CỦA ĐỢT */
function Invoices({ id }: { id: number }) {
    const [status, setStatus] = useState('');
    const [classId, setClassId] = useState('');
    const [sort, setSort] = useState('class');
    const [q, setQ] = useState('');
    const [dq, setDq] = useState('');
    const [page, setPage] = useState(1);
    useEffect(() => { const t = setTimeout(() => { setDq(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
    const { data, err, loading, reload } = useApi<any>(`periods/${id}/invoices${qs({ status, class_id: classId, sort, q: dq, page, per: 20 })}`);
    const chips: [string, string][] = [['', 'Tất cả'], ['paid', 'Đóng đủ'], ['partial', 'Đóng một phần'], ['unpaid', 'Chưa đóng'], ['overdue', 'Quá hạn'], ['pending', 'Chờ xác nhận']];
    return (
        <Card pad={false}>
            <div className="pd-inv-bar">
                <div className="pd-chips">{chips.map(([k, l]) => <button key={k} className={status === k ? 'on' : ''} onClick={() => { setStatus(k); setPage(1); }}>{l}{data && <em>{k === '' ? data.counts.all : data.counts[k]}</em>}</button>)}</div>
                <div className="pd-filters">
                    <input className="pd-in" placeholder="Tìm học sinh, mã HS, mã hóa đơn…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm hóa đơn" />
                    <select className="pd-in" value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1); }} aria-label="Lớp"><option value="">Tất cả lớp</option>{data?.classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <select className="pd-in" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sắp xếp"><option value="class">Theo lớp</option><option value="remaining">Còn nợ nhiều nhất</option></select>
                </div>
            </div>
            {err ? <div className="pd-pad"><ErrorBox msg={err} retry={reload} /></div> : loading && !data ? <Loading /> : !data || data.items.length === 0 ? <Empty text="Không có hóa đơn phù hợp." /> : (
                <>
                    <div className="pd-tw"><table className="pd-table"><thead><tr><th>Mã hóa đơn</th><th>Học sinh</th><th>Lớp</th><th className="n">Phải đóng</th><th className="n">Đã đóng</th><th className="n">Còn lại</th><th>Hạn nộp</th><th>Trạng thái</th></tr></thead><tbody>
                    {data.items.map((r: any) => {
                        const st = INV_STATUS[r.status];
                        return (
                            <tr key={r.id}>
                                <td className="pd-mono">{r.code}</td>
                                <td>{r.student_id ? <Link href={`/accountant/collection?student=${r.student_id}`} title="Mở quầy thu học phí của học sinh này"><b>{r.student_name}</b></Link> : <b>{r.student_name}</b>}<small>{r.student_code}</small></td>
                                <td>{r.class_name ?? '—'}</td>
                                <td className="n">{vnd(r.total)}</td><td className="n">{vnd(r.paid)}</td><td className="n"><b>{vnd(r.remaining)}</b></td>
                                <td>{fmtDate(r.due_date)}{r.overdue && <small className="bad">Quá {r.days_overdue} ngày</small>}</td>
                                <td><Chip tone={r.overdue ? 'err' : st.tone}>{r.overdue ? 'Quá hạn' : st.label}</Chip>{r.pending > 0 && <small className="warn">Chờ xác nhận {vnd(r.pending)}</small>}</td>
                            </tr>
                        );
                    })}
                    </tbody></table></div>
                    <div className="pd-tfoot"><span>Tổng <b>{data.total}</b> hóa đơn</span><Pager page={data.page} pages={data.pages} onChange={setPage} /></div>
                </>
            )}
        </Card>
    );
}

/* ====================================================== KHOẢN THU */
function Items({ p }: { p: any }) {
    const sumByGrade = useMemo(() => [10, 11, 12].map((g) => ({ g, v: p.items.filter((i: any) => i.grade === null || i.grade === g).reduce((x: number, i: any) => x + i.amount, 0) })).filter((x) => !p.grade || x.g === p.grade), [p]);
    return (
        <div className="pd-cols">
            <Card title="Khoản thu của đợt" pad={false} className="wide">
                <div className="pd-tw"><table className="pd-table"><thead><tr><th>Khoản thu</th><th>Loại</th><th>Áp dụng</th><th className="n">Đơn giá đợt này</th><th className="n">Giá trong danh mục</th></tr></thead><tbody>
                {p.items.map((i: any) => <tr key={i.fee_item_id}><td><b>{i.name}</b><small>{i.code} · thu theo {i.unit}</small></td><td>{CATEGORY[i.category] ?? i.category}</td><td>{i.grade ? `Khối ${i.grade}` : 'Mọi khối'}</td><td className="n"><b>{vnd(i.amount)}</b></td><td className="n">{i.amount !== i.default_amount ? <span className="warn">{vnd(i.default_amount)} (đã điều chỉnh)</span> : vnd(i.default_amount)}</td></tr>)}
                </tbody></table></div>
            </Card>
            <Card title="Tổng mỗi học sinh">
                <ul className="pd-bars plain">{sumByGrade.map((x) => <li key={x.g}><span>Khối {x.g}</span><b>{vnd(x.v)}</b></li>)}</ul>
                <p className="pd-muted">Chưa trừ miễn giảm. Học sinh thuộc diện miễn giảm được giảm theo tỉ lệ trên khoản học phí.</p>
            </Card>
        </div>
    );
}

/* ====================================================== NHẬT KÝ */
function Log({ p }: { p: any }) {
    return (
        <Card title="Nhật ký thao tác">
            {p.log.length === 0 ? <p className="pd-muted">Chưa có thao tác nào.</p> : (
                <ol className="pd-log">{p.log.map((l: any) => <li key={l.id} className={l.action}><i aria-hidden /><div><b>{ACTION_LABEL[l.action] ?? l.action}</b><span>{l.detail}</span><small>{l.actor} · {fmtDateTime(l.created_at)}</small></div></li>)}</ol>
            )}
        </Card>
    );
}

/* ====================================================== HỘP THOẠI THAO TÁC */
function Dialogs({ dlg, p, staffRole, close, onDone, onFail }: { dlg: Exclude<Dlg, null>; p: any; staffRole: string; close: () => void; onDone: (m: string, leave?: boolean) => void; onFail: (m: string) => void }) {
    const [busy, setBusy] = useState(false);
    const [reason, setReason] = useState('');
    const [due, setDue] = useState(addDays(p.due_date, 14));
    const [prev, setPrev] = useState<any>(null);
    const [pe, setPe] = useState('');
    useEffect(() => {
        if (dlg !== 'issue') return;
        api<any>(`periods/${p.id}/preview`, { method: 'POST', body: {} }).then(setPrev).catch((e) => setPe(e.message));
    }, [dlg, p.id]);

    const call = async (path: string, body?: unknown, leave = false) => {
        setBusy(true);
        try { const r = await api<any>(`periods/${p.id}/${path}`, { method: 'POST', body: body ?? {} }); onDone(r.message || 'Đã thực hiện.' , leave); }
        catch (e: any) { onFail(e.message); setBusy(false); }
    };
    const need = reason.trim().length >= 5;

    if (dlg === 'issue') {
        const first = p.status === 'draft';
        return (
            <Modal title={first ? 'Phát hành hóa đơn cho học sinh' : 'Phát hành bổ sung'} onClose={close} foot={<><button className="pd-btn ghost" onClick={close}>Để sau</button><button className="pd-btn" disabled={busy || !prev || (first && prev.summary.to_create === 0)} onClick={() => call('issue')}>{busy ? 'Đang tạo hóa đơn…' : first ? `Phát hành ${prev ? prev.summary.to_create : ''} hóa đơn` : 'Phát hành bổ sung'}</button></>}>
                {pe && <div className="pd-alert err">{pe}</div>}
                {!prev && !pe && <Loading text="Đang tính toán…" />}
                {prev && (
                    <>
                        <p>{first ? 'Hệ thống sẽ tạo hóa đơn cho học sinh trong phạm vi của đợt. Học sinh xem được ngay trong cổng học sinh.' : 'Chỉ tạo hóa đơn cho học sinh chưa có hóa đơn trong đợt này (ví dụ học sinh mới nhập lớp). Hóa đơn đã có không bị thay đổi.'}</p>
                        <dl className="pd-dl">
                            <div><dt>Hóa đơn sẽ tạo</dt><dd><b>{prev.summary.to_create}</b>{prev.summary.already ? ` (đã có ${prev.summary.already})` : ''}</dd></div>
                            <div><dt>Tổng phải thu</dt><dd><b>{vnd(prev.summary.total)}</b></dd></div>
                            <div><dt>Miễn giảm tự động</dt><dd>{vnd(prev.summary.discount)} · {prev.summary.waived_students} học sinh</dd></div>
                            <div><dt>Hạn nộp</dt><dd>{fmtDate(p.due_date)}</dd></div>
                        </dl>
                        {prev.warnings.length > 0 && <div className="pd-alert warn"><ul>{prev.warnings.map((w: string) => <li key={w}>{w}</li>)}</ul></div>}
                    </>
                )}
            </Modal>
        );
    }
    if (dlg === 'extend') {
        return (
            <Modal title="Gia hạn hạn nộp" onClose={close} foot={<><button className="pd-btn ghost" onClick={close}>Hủy</button><button className="pd-btn" disabled={busy || !need || due <= p.due_date} onClick={() => call('extend', { due_date: due, reason })}>Gia hạn</button></>}>
                <p>Hạn hiện tại: <b>{fmtDate(p.due_date)}</b>. Hạn mới áp dụng cho đợt và mọi hóa đơn chưa đóng đủ. Hóa đơn đã đóng đủ không đổi.</p>
                <Field label="Hạn nộp mới" htmlFor="x-due" error={due <= p.due_date ? 'Hạn mới phải sau hạn hiện tại.' : undefined}>
                    <input id="x-due" type="date" className="pd-in" value={due} min={addDays(p.due_date, 1)} onChange={(e) => setDue(e.target.value)} />
                    <div className="pd-quick">{[7, 14, 30].map((n) => <button key={n} type="button" onClick={() => setDue(addDays(p.due_date, n))}>+{n} ngày</button>)}</div>
                </Field>
                <Field label="Lý do gia hạn" htmlFor="x-r" hint="Ghi vào nhật ký để đối chiếu sau này."><textarea id="x-r" className="pd-in" rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            </Modal>
        );
    }
    if (dlg === 'close') {
        const s = p.stats;
        return (
            <Modal title="Kết thúc đợt thu" onClose={close} foot={<><button className="pd-btn ghost" onClick={close}>Hủy</button><button className="pd-btn" disabled={busy} onClick={() => call('close')}>Kết thúc đợt</button></>}>
                <p>Sau khi kết thúc, học sinh không thể khai báo thanh toán mới cho đợt này (có thể mở lại bất cứ lúc nào).</p>
                <dl className="pd-dl"><div><dt>Đã thu</dt><dd><b>{vnd(s.paid)}</b> ({pct(s.rate)})</dd></div><div><dt>Còn nợ</dt><dd><b className={s.remaining ? 'bad' : ''}>{vnd(s.remaining)}</b> · {s.partial_count + s.unpaid_count} hóa đơn</dd></div></dl>
                {p.pending_payments > 0 && <div className="pd-alert warn">Còn {p.pending_payments} khoản đang chờ xác nhận. Hãy xử lý hết trước khi kết thúc.</div>}
            </Modal>
        );
    }
    if (dlg === 'reopen') {
        return (
            <Modal title="Mở lại đợt thu" onClose={close} foot={<><button className="pd-btn ghost" onClick={close}>Hủy</button><button className="pd-btn" disabled={busy} onClick={() => call('reopen')}>Mở lại</button></>}>
                <p>Học sinh sẽ khai báo thanh toán được trở lại cho các hóa đơn của đợt này.</p>
            </Modal>
        );
    }
    const bgh = ['principal', 'vice_principal', 'super_admin'].includes(staffRole);
    return (
        <Modal title="Hủy đợt thu" onClose={close} foot={<><button className="pd-btn ghost" onClick={close}>Không hủy</button><button className="pd-btn danger" disabled={busy || !need} onClick={() => call('cancel', { reason }, true)}>Xác nhận hủy</button></>}>
            <p>{p.status === 'draft' ? 'Bản nháp sẽ được đánh dấu là đã hủy.' : 'Toàn bộ hóa đơn của đợt sẽ bị hủy và học sinh không còn thấy khoản phải đóng. Chỉ hủy được khi chưa có giao dịch thanh toán nào.'}</p>
            {p.status === 'open' && !bgh && <div className="pd-alert err">Chỉ Ban giám hiệu hoặc quản trị mới được hủy đợt đã phát hành.</div>}
            <Field label="Lý do hủy" htmlFor="c-r"><textarea id="c-r" className="pd-in" rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </Modal>
    );
}