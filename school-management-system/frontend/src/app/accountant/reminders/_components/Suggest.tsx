'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, BUCKET_COLOR, BUCKET_SHORT, BUCKET_TONE, KtError, LEVEL_TONE, qs, RMeta, SugRes, vnd, fmtDate } from '../_lib/rm';
import { Card, Chip, Empty, ErrorBox, Field, Loading, Pager, useApi } from '../../periods/_components/ui';

type Props = { meta: RMeta; refreshKey: number; onCompose: (ids: number[]) => void; toast: { ok: (m: string) => void; fail: (m: string) => void } };
const SORTS: [string, string][] = [['days_desc', 'Quá hạn lâu nhất'], ['balance_desc', 'Còn nợ nhiều nhất'], ['last_asc', 'Lâu chưa nhắc nhất'], ['class', 'Theo lớp'], ['name', 'Theo tên A–Z']];

/** Đề xuất học sinh cần nhắc: lọc, chọn nhiều, soạn và gửi. */
export function Suggest({ meta, refreshKey, onCompose, toast }: Props) {
    const [q, setQ] = useState('');
    const [dq, setDq] = useState('');
    const [grade, setGrade] = useState('');
    const [classId, setClassId] = useState('');
    const [bucket, setBucket] = useState('');
    const [level, setLevel] = useState('');
    const [min, setMin] = useState('');
    const [elig, setElig] = useState('yes');
    const [sort, setSort] = useState('days_desc');
    const [page, setPage] = useState(1);
    const [adv, setAdv] = useState(false);
    const [sel, setSel] = useState<number[]>([]);
    const [busy, setBusy] = useState(false);
    useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 350); return () => clearTimeout(t); }, [q]);
    const params = { q: dq, grade, class_id: classId, bucket, level, min, eligible: elig, sort };
    const key = JSON.stringify(params);
    useEffect(() => { setPage(1); setSel([]); }, [key]);
    const res = useApi<SugRes>(`reminders/suggestions${qs({ ...params, page })}`);
    useEffect(() => { if (refreshKey) { res.reload(); setSel([]); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refreshKey]);
    const d = res.data;
    const items = d?.items || [];
    const sm = d?.summary;
    const classes = useMemo(() => meta.classes.filter((c) => !grade || String(c.grade) === grade), [meta, grade]);
    const pick = items.filter((r) => r.eligible);
    const allOn = pick.length > 0 && pick.every((r) => sel.includes(r.id));
    const selSum = items.filter((r) => sel.includes(r.id)).reduce((s, r) => s + r.balance, 0);
    const activeAdv = [bucket, level, min].filter(Boolean).length;
    const filtered = !!(dq || grade || classId || activeAdv || elig !== 'yes');
    const reset = () => { setQ(''); setGrade(''); setClassId(''); setBucket(''); setLevel(''); setMin(''); setElig('yes'); setSort('days_desc'); };

    /** Chọn mọi học sinh đủ điều kiện theo bộ lọc hiện tại (tối đa 500, qua nhiều trang) */
    const pickAll = async () => {
        setBusy(true);
        try {
            const ids: number[] = [];
            let p = 1; let pages = 1;
            do {
                const r = await api<SugRes>(`reminders/suggestions${qs({ ...params, eligible: 'yes', page: p, per_page: 500 })}`);
                pages = r.pages; r.items.forEach((x) => ids.push(x.id)); p++;
            } while (p <= pages && ids.length < 500);
            setSel(ids.slice(0, 500));
            toast.ok(`Đã chọn ${Math.min(ids.length, 500)} học sinh đủ điều kiện nhắc${ids.length > 500 ? ' (tối đa 500 mỗi đợt)' : ''}.`);
        } catch (e) { toast.fail((e as KtError).message); } finally { setBusy(false); }
    };

    const chips: [string, string, number | undefined][] = [['yes', 'Cần nhắc ngay', sm?.eligible], ['no', `Vừa nhắc, chờ ${d?.gap_days ?? meta.settings.gap_days} ngày`, sm ? sm.debtors - sm.eligible : undefined], ['all', 'Tất cả còn nợ', sm?.debtors]];

    return (
        <Card pad={false} title="Học sinh cần nhắc nợ">
            <div className="pd-inv-bar rc-filters">
                <div className="pd-filters" style={{ flex: '1 1 100%' }}>
                    <input className="pd-in" aria-label="Tìm học sinh cần nhắc" placeholder="Tìm theo mã hoặc họ tên học sinh…" value={q} onChange={(e) => setQ(e.target.value)} />
                    <select className="pd-in" aria-label="Khối" value={grade} onChange={(e) => { setGrade(e.target.value); setClassId(''); }}><option value="">Mọi khối</option>{meta.grades.map((g) => <option key={g} value={g}>Khối {g}</option>)}</select>
                    <select className="pd-in" aria-label="Lớp" value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">Mọi lớp</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <select className="pd-in" aria-label="Sắp xếp" value={sort} onChange={(e) => setSort(e.target.value)}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                    <button className={`pd-btn ghost ${adv ? 'rc-on' : ''}`} onClick={() => setAdv((v) => !v)}>Bộ lọc nâng cao{activeAdv ? ` (${activeAdv})` : ''} {adv ? '▴' : '▾'}</button>
                </div>
                <div className="rc-row">
                    <div className="pd-chips" role="group" aria-label="Điều kiện nhắc">
                        {chips.map(([k, l, n]) => <button key={k} className={elig === k ? 'on' : ''} onClick={() => setElig(k)}>{l}{n !== undefined ? <em>{n.toLocaleString('vi-VN')}</em> : null}</button>)}
                    </div>
                    <div className="pd-quick" style={{ marginTop: 0 }}>
                        <button disabled={busy || !sm || sm.eligible === 0} onClick={pickAll}>Chọn tất cả học sinh cần nhắc</button>
                        {filtered && <button onClick={reset}>Xóa bộ lọc</button>}
                    </div>
                </div>
                {adv && (
                    <div className="rc-adv">
                        <Field label="Tuổi nợ" htmlFor="rmd-b"><select id="rmd-b" className="pd-in" value={bucket} onChange={(e) => setBucket(e.target.value)}><option value="">Mọi tuổi nợ</option>{meta.buckets.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}</select></Field>
                        <Field label="Mức nhắc đề xuất" htmlFor="rmd-l"><select id="rmd-l" className="pd-in" value={level} onChange={(e) => setLevel(e.target.value)}><option value="">Mọi mức</option>{meta.levels.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}</select></Field>
                        <Field label="Còn nợ từ (đ)" htmlFor="rmd-m"><input id="rmd-m" className="pd-in" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} placeholder="0" /></Field>
                    </div>
                )}
            </div>

            {sel.length > 0 && (
                <div className="rc-selbar" role="status">
                    <span><b>{sel.length}</b> học sinh đã chọn{selSum > 0 && sel.length <= items.length ? <> · tổng nợ <b>{vnd(selSum)}</b></> : null}</span>
                    <div><button className="pd-btn sm" onClick={() => onCompose(sel)}>Soạn tin cho {sel.length} học sinh</button><button className="pd-btn ghost sm" onClick={() => setSel([])}>Bỏ chọn</button></div>
                </div>
            )}

            {res.loading && !d && <Loading />}
            {res.err && <ErrorBox msg={res.err} retry={res.reload} />}
            {d && (items.length === 0 ? <Empty text={elig === 'yes' && !filtered ? 'Không có học sinh nào cần nhắc lúc này. Tất cả đã được nhắc gần đây hoặc không còn nợ.' : 'Không có học sinh nào khớp bộ lọc.'} /> : (
                <div className="pd-tw">
                    <table className="pd-table rc-table rmd-table">
                        <thead><tr>
                            <th style={{ width: 34 }}><input type="checkbox" aria-label="Chọn tất cả học sinh đủ điều kiện trên trang" checked={allOn} disabled={pick.length === 0} onChange={() => setSel(allOn ? [] : Array.from(new Set([...sel, ...pick.map((r) => r.id)])))} /></th>
                            <th>Học sinh</th><th className="n">Còn nợ</th><th>Tuổi nợ</th><th>Lần nhắc gần nhất</th><th>Mức đề xuất</th><th style={{ width: 150 }} /></tr></thead>
                        <tbody>
                        {items.map((r) => (
                            <tr key={r.id} className={r.eligible ? '' : 'rmd-wait'}>
                                <td><input type="checkbox" aria-label={`Chọn ${r.name}`} disabled={!r.eligible} checked={sel.includes(r.id)} onChange={() => setSel((s) => s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id])} /></td>
                                <td><Link href={`/accountant/debts?student=${r.id}`} title="Mở hồ sơ công nợ"><b>{r.name}</b></Link><small>{r.code} · {r.class || 'chưa xếp lớp'}</small></td>
                                <td className="n"><b className="bad">{vnd(r.balance)}</b><small>{r.open_invoices} hóa đơn</small></td>
                                <td>{r.bucket && <><Chip tone={BUCKET_TONE[r.bucket]}><i className="dbt-dot" style={{ background: BUCKET_COLOR[r.bucket] }} />{BUCKET_SHORT[r.bucket]}</Chip>{r.max_days > 0 && <small>quá hạn {r.max_days} ngày · hạn {r.oldest_due ? fmtDate(r.oldest_due) : ''}</small>}</>}</td>
                                <td>
                                    {r.reminder ? <><b>{r.reminder.count} lần</b> · {r.reminder.days_since === 0 ? 'hôm nay' : `${r.reminder.days_since} ngày trước`}<small>{r.reminder.last_status === 'read' ? 'Phụ huynh đã đọc' : r.reminder.last_status === 'queued' ? 'Còn chờ gửi' : 'Chưa đọc'}</small>{!r.eligible && <small className="warn">Nhắc lại được sau {r.next_in} ngày</small>}</> : <span className="pd-muted">Chưa nhắc lần nào</span>}
                                    {r.promise && <small className="ok">Hẹn trả {fmtDate(r.promise.date)} · {vnd(r.promise.amount)}</small>}
                                </td>
                                <td><Chip tone={LEVEL_TONE[r.level]}>{meta.levels.find((l) => l.key === r.level)?.label}</Chip></td>
                                <td><div className="cl-rowact"><button className="pd-btn sm" disabled={!r.eligible} onClick={() => onCompose([r.id])}>Nhắc ngay</button></div></td>
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