'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, BUCKET_COLOR, BUCKET_SHORT, BUCKET_TONE, DMeta, downloadCsv, KtError, ListRes, qs, STATE_LABEL, vnd } from '../_lib/db';
import { Card, Chip, Empty, ErrorBox, Field, Loading, Pager, Progress, useApi } from '../../periods/_components/ui';

export type Preset = { state?: string; bucket?: string; promise?: string; grade?: string; class_id?: string };
type Props = { meta: DMeta; preset: Preset; refreshKey: number; onOpen: (id: number) => void; toast: { ok: (m: string) => void; fail: (m: string) => void } };

const SORTS: [string, string][] = [['overdue_desc', 'Nợ quá hạn nhiều nhất'], ['balance_desc', 'Còn nợ nhiều nhất'], ['days_desc', 'Quá hạn lâu nhất'], ['class', 'Theo lớp'], ['name', 'Theo tên A–Z']];

/** Danh sách học sinh còn nợ: lọc nhiều tiêu chí, xem tuổi nợ, mở hồ sơ, xuất CSV. */
export function List({ meta, preset, refreshKey, onOpen, toast }: Props) {
    const [q, setQ] = useState('');
    const [dq, setDq] = useState('');
    const [state, setState] = useState(preset.state || 'all');
    const [bucket, setBucket] = useState(preset.bucket || '');
    const [promise, setPromise] = useState(preset.promise || '');
    const [grade, setGrade] = useState(preset.grade || '');
    const [classId, setClassId] = useState(preset.class_id || '');
    const [yearId, setYearId] = useState('');
    const [periodId, setPeriodId] = useState('');
    const [min, setMin] = useState('');
    const [sort, setSort] = useState('overdue_desc');
    const [page, setPage] = useState(1);
    const [adv, setAdv] = useState(!!(preset.bucket || preset.promise));
    const [sel, setSel] = useState<number[]>([]);
    const [busy, setBusy] = useState(false);
    useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 350); return () => clearTimeout(t); }, [q]);
    const base = { q: dq, grade, class_id: classId, year_id: yearId, period_id: periodId };
    const params = { ...base, state, bucket, promise, min, sort };
    const key = JSON.stringify(params);
    useEffect(() => { setPage(1); setSel([]); }, [key]);
    const res = useApi<ListRes>(`debts${qs({ ...params, page })}`);
    useEffect(() => { if (refreshKey) res.reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refreshKey]);
    const d = res.data;
    const items = d?.items || [];
    const periods = useMemo(() => meta.periods.filter((p) => !yearId || String(p.year_id) === yearId), [meta, yearId]);
    const classes = useMemo(() => meta.classes.filter((c) => !grade || String(c.grade) === grade), [meta, grade]);
    const activeAdv = [bucket, promise, yearId, periodId, min].filter(Boolean).length;
    const filtered = !!(dq || grade || classId || activeAdv || state !== 'all');
    const allOn = items.length > 0 && items.every((r) => sel.includes(r.id));
    const selSum = items.filter((r) => sel.includes(r.id)).reduce((s, r) => s + r.balance, 0);
    const reset = () => { setQ(''); setState('all'); setBucket(''); setPromise(''); setGrade(''); setClassId(''); setYearId(''); setPeriodId(''); setMin(''); setSort('overdue_desc'); };

    const exportCsv = async (onlySel: boolean) => {
        setBusy(true);
        try {
            const rows: (string | number)[][] = [['Mã HS', 'Họ tên', 'Lớp', 'Phải thu', 'Đã thu', 'Còn nợ', 'Nợ quá hạn', 'Số hóa đơn nợ', 'Quá hạn (ngày)', 'Tuổi nợ', 'Trạng thái', 'Hạn nộp sớm nhất', 'Hẹn trả', 'Số tiền hẹn', 'Liên hệ gần nhất']];
            let p = 1; let pages = 1;
            do {
                const r = await api<ListRes>(`debts${qs({ ...params, page: p, per_page: 500 })}`);
                pages = r.pages;
                r.items.filter((x) => !onlySel || sel.includes(x.id)).forEach((x) => rows.push([x.code, x.name, x.class || '', x.billed, x.paid, x.balance, x.overdue, x.open_invoices, x.max_days, x.bucket ? BUCKET_SHORT[x.bucket] : '', STATE_LABEL[x.state],
                    x.oldest_due ? x.oldest_due.split('-').reverse().join('/') : '', x.promise ? x.promise.date.split('-').reverse().join('/') : '', x.promise ? x.promise.amount : '', x.last_note ? `${x.last_note.at}: ${x.last_note.text}` : '']));
                p++;
            } while (p <= pages && p <= 20);
            downloadCsv(`cong-no-${new Date().toISOString().slice(0, 10)}.csv`, rows);
            toast.ok(`Đã xuất ${rows.length - 1} học sinh.`);
        } catch (e) { toast.fail((e as KtError).message); } finally { setBusy(false); }
    };

    const c = d?.counts;
    const chips: [string, string, number | undefined][] = [['all', 'Tất cả còn nợ', c?.all], ['overdue', 'Quá hạn', c?.overdue], ['notdue', 'Chưa đến hạn', c?.notdue], ['unpaid', 'Chưa đóng đồng nào', c?.unpaid], ['partial', 'Đóng một phần', c?.partial]];

    return (
        <Card pad={false} title="Học sinh còn nợ"
              right={<div className="pd-head-act"><button className="pd-btn ghost sm" disabled={busy || !d || d.total === 0} onClick={() => exportCsv(false)}>Xuất Excel (CSV)</button></div>}>
            <div className="pd-inv-bar rc-filters">
                <div className="pd-filters" style={{ flex: '1 1 100%' }}>
                    <input className="pd-in" aria-label="Tìm học sinh còn nợ" placeholder="Tìm theo mã hoặc họ tên học sinh…" value={q} onChange={(e) => setQ(e.target.value)} />
                    <select className="pd-in" aria-label="Khối" value={grade} onChange={(e) => { setGrade(e.target.value); setClassId(''); }}><option value="">Mọi khối</option>{meta.grades.map((g) => <option key={g} value={g}>Khối {g}</option>)}</select>
                    <select className="pd-in" aria-label="Lớp" value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">Mọi lớp</option>{classes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                    <select className="pd-in" aria-label="Sắp xếp" value={sort} onChange={(e) => setSort(e.target.value)}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                    <button className={`pd-btn ghost ${adv ? 'rc-on' : ''}`} onClick={() => setAdv((v) => !v)}>Bộ lọc nâng cao{activeAdv ? ` (${activeAdv})` : ''} {adv ? '▴' : '▾'}</button>
                </div>
                <div className="rc-row">
                    <div className="pd-chips" role="group" aria-label="Tình trạng nợ">
                        {chips.map(([k, l, n]) => <button key={k} className={state === k ? 'on' : ''} onClick={() => setState(k)}>{l}{n !== undefined ? <em>{n.toLocaleString('vi-VN')}</em> : null}</button>)}
                    </div>
                    {filtered && <div className="pd-quick" style={{ marginTop: 0 }}><button onClick={reset}>Xóa bộ lọc</button></div>}
                </div>
                {adv && (
                    <div className="rc-adv">
                        <Field label="Tuổi nợ" htmlFor="dbt-b"><select id="dbt-b" className="pd-in" value={bucket} onChange={(e) => setBucket(e.target.value)}><option value="">Mọi tuổi nợ</option>{meta.buckets.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}</select></Field>
                        <Field label="Lời hẹn trả" htmlFor="dbt-p"><select id="dbt-p" className="pd-in" value={promise} onChange={(e) => setPromise(e.target.value)}><option value="">Tất cả</option><option value="none">Chưa có lời hẹn</option><option value="open">Có hẹn còn hiệu lực</option><option value="late">Quá hẹn chưa trả</option></select></Field>
                        <Field label="Năm học của hóa đơn" htmlFor="dbt-y"><select id="dbt-y" className="pd-in" value={yearId} onChange={(e) => { setYearId(e.target.value); setPeriodId(''); }}><option value="">Tất cả năm học</option>{meta.years.map((y) => <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' (hiện tại)' : ''}</option>)}</select></Field>
                        <Field label="Đợt thu" htmlFor="dbt-pe"><select id="dbt-pe" className="pd-in" value={periodId} onChange={(e) => setPeriodId(e.target.value)}><option value="">Tất cả đợt thu</option>{periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
                        <Field label="Còn nợ từ (đ)" htmlFor="dbt-mn"><input id="dbt-mn" className="pd-in" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} placeholder="0" /></Field>
                    </div>
                )}
            </div>

            {sel.length > 0 && (
                <div className="rc-selbar" role="status">
                    <span><b>{sel.length}</b> học sinh đã chọn · tổng nợ <b>{vnd(selSum)}</b></span>
                    <div><button className="pd-btn sm" disabled={busy} onClick={() => exportCsv(true)}>Xuất danh sách đã chọn</button><button className="pd-btn ghost sm" onClick={() => setSel([])}>Bỏ chọn</button></div>
                </div>
            )}

            {res.loading && !d && <Loading />}
            {res.err && <ErrorBox msg={res.err} retry={res.reload} />}
            {d && (items.length === 0 ? <Empty text={filtered ? 'Không có học sinh nào khớp bộ lọc.' : 'Không có học sinh nào còn nợ.'} /> : (
                <div className="pd-tw">
                    <table className="pd-table rc-table dbt-table">
                        <thead><tr>
                            <th style={{ width: 34 }}><input type="checkbox" aria-label="Chọn tất cả học sinh trên trang" checked={allOn} onChange={() => setSel(allOn ? [] : items.map((r) => r.id))} /></th>
                            <th>Học sinh</th><th>Đã đóng</th><th className="n">Còn nợ</th><th>Tuổi nợ</th><th>Liên hệ / hẹn trả</th><th style={{ width: 150 }} /></tr></thead>
                        <tbody>
                        {items.map((r) => (
                            <tr key={r.id}>
                                <td><input type="checkbox" aria-label={`Chọn ${r.name}`} checked={sel.includes(r.id)} onChange={() => setSel((s) => s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id])} /></td>
                                <td><button className="cl-link" onClick={() => onOpen(r.id)}><b>{r.name}</b></button><small>{r.code} · {r.class || 'chưa xếp lớp'}</small></td>
                                <td className="dbt-prog"><Progress paid={r.paid} pending={r.pending} total={Math.max(r.billed, 1)} /><small>{vnd(r.paid)} / {vnd(r.billed)} · {r.paid_pct}%</small></td>
                                <td className="n"><b className="bad">{vnd(r.balance)}</b><small>{r.open_invoices} hóa đơn{r.overdue > 0 && r.overdue < r.balance ? ` · quá hạn ${vnd(r.overdue)}` : ''}</small>{r.pending > 0 && <small className="warn">Chờ xác nhận {vnd(r.pending)}</small>}</td>
                                <td>{r.bucket && <><Chip tone={BUCKET_TONE[r.bucket]}><i className="dbt-dot" style={{ background: BUCKET_COLOR[r.bucket] }} />{BUCKET_SHORT[r.bucket]}</Chip>{r.max_days > 0 && <small>quá hạn {r.max_days} ngày</small>}</>}</td>
                                <td>
                                    {r.promise ? <><Chip tone={r.promise.late ? 'err' : 'info'}>{r.promise.late ? 'Quá hẹn' : 'Hẹn'} {r.promise.date.split('-').reverse().join('/')}</Chip><small>{vnd(r.promise.amount)}</small></> : r.last_note ? null : <small className="pd-muted">Chưa liên hệ</small>}
                                    {r.last_note && <small title={r.last_note.text}>{r.last_note.at.slice(6)} · {r.last_note.text.length > 40 ? r.last_note.text.slice(0, 40) + '…' : r.last_note.text}</small>}
                                </td>
                                <td><div className="cl-rowact"><button className="pd-btn ghost sm" onClick={() => onOpen(r.id)}>Chi tiết</button><Link href={`/accountant/collection?student=${r.id}`} className="pd-btn sm">Thu tiền</Link></div></td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            ))}
            {d && <div className="pd-tfoot"><span>{d.total.toLocaleString('vi-VN')} học sinh · tổng nợ <b>{vnd(d.filtered_balance)}</b></span><Pager page={page} pages={d.pages} onChange={setPage} /></div>}
        </Card>
    );
}