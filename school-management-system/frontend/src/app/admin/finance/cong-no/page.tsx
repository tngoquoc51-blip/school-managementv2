'use client';
// Công nợ (/admin/finance/cong-no)
import React, { useState } from 'react';
import { Btn, Card, Empty, ErrorBox, HBars, Ico, InvStatus, Invoice, InvoiceDrawer, Loading, Page, Pager, downloadCsv, fi, fmtD, num, qs, useDebounced, useFi, useLoad, useTa, vnd } from '../_fi';

type Res = { meta: Page; buckets: { key: string; label: string; n: number; amount: number }[]; by_class: { class_name: string; grade: number; students: number; balance: number }[]; data: Invoice[] };
const TONE: Record<string, string> = { current: 'sky', d30: 'amber', d60: 'amber', d90: 'rose', d90p: 'rose' };

export default function DebtsPage() {
    const { yearId, meta } = useFi(); const { toast } = useTa();
    const [bucket, setBucket] = useState(''); const [grade, setGrade] = useState(''); const [cls, setCls] = useState(''); const [sort, setSort] = useState('days'); const [q, setQ] = useState(''); const [page, setPage] = useState(1);
    const [open, setOpen] = useState<number | null>(null); const [busy, setBusy] = useState(false);
    const dq = useDebounced(q);
    const query = (x: Record<string, string | number> = {}) => qs({ year_id: yearId, bucket, grade, class_id: cls, sort, q: dq, page, ...x });
    const { data, err, loading, reload } = useLoad(() => fi<Res>(`debts${query()}`), [yearId, bucket, grade, cls, sort, dq, page]);
    const total = data?.buckets.reduce((s, b) => s + b.amount, 0) || 0; const nAll = data?.buckets.reduce((s, b) => s + b.n, 0) || 0;
    const classes = meta.classes.filter((c) => !grade || String(c.grade) === grade);

    const exportCsv = async () => {
        setBusy(true);
        try {
            const r = await fi<Res>(`debts${query({ export: 1, page: 1 })}`);
            downloadCsv(`cong-no-${yearId}.csv`, ['Mã HS', 'Họ tên', 'Lớp', 'Hóa đơn', 'Kỳ thu', 'Hạn nộp', 'Phải thu', 'Đã thu', 'Còn nợ', 'Quá hạn (ngày)'], r.data.map((i) => [i.scode, i.sname, i.class_name, i.code, i.term_label, i.due_date, i.total, i.paid, i.balance, i.overdue_days]));
            toast(`Đã xuất ${r.data.length} khoản nợ.`);
        } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
    };

    return (
        <div className="ta-page">
            <div className="fi-sum"><div><small>Tổng công nợ năm học</small><b className="fi-money r">{vnd(total)}</b></div><div><small>Số hóa đơn còn nợ</small><b>{num(nAll)}</b></div><div><small>Đã quá hạn</small><b className="fi-money r">{vnd(data ? data.buckets.filter((b) => b.key !== 'current').reduce((s, b) => s + b.amount, 0) : 0)}</b></div></div>
            <div className="fi-bucket">
                {(data?.buckets || []).map((b) => (
                    <button key={b.key} className={`t-${TONE[b.key]}${bucket === b.key ? ' on' : ''}`} onClick={() => { setBucket(bucket === b.key ? '' : b.key); setPage(1); }}><small>{b.label}</small><b>{vnd(b.amount)}</b><em>{num(b.n)} hóa đơn</em></button>
                ))}
            </div>
            <div className="ta-filters">
                <label className="ta-search"><Ico n="search" size={16} /><input placeholder="Tìm học sinh, mã HS, mã hóa đơn…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label>
                <select value={grade} onChange={(e) => { setGrade(e.target.value); setCls(''); setPage(1); }}><option value="">Mọi khối</option>{[10, 11, 12].map((g) => <option key={g} value={g}>Khối {g}</option>)}</select>
                <select value={cls} onChange={(e) => { setCls(e.target.value); setPage(1); }}><option value="">Mọi lớp</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}><option value="days">Quá hạn lâu nhất</option><option value="balance">Nợ nhiều nhất</option><option value="name">Theo tên</option></select>
                <span style={{ flex: 1 }} /><Btn size="sm" busy={busy} onClick={exportCsv}><Ico n="download" size={15} />Xuất danh sách nợ</Btn>
            </div>
            <div className="fi-grid g21">
                <Card pad={false}>
                    {loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /> : data.data.length === 0 ? <Empty icon="check" title="Không có khoản nợ phù hợp" text="Mọi hóa đơn trong bộ lọc này đều đã thu đủ." /> : (
                        <><div className="ta-tablewrap"><table className="ta-tbl big"><thead><tr><th>Học sinh</th><th>Hóa đơn</th><th>Hạn nộp</th><th>Còn nợ</th><th>Tình trạng</th></tr></thead><tbody>
                        {data.data.map((i) => (
                            <tr key={i.id} onClick={() => setOpen(i.id)} className={i.overdue_days > 60 ? 'urgent' : ''}>
                                <td><b>{i.sname}</b><small>{i.scode}{i.class_name ? ` · ${i.class_name}` : ''}</small></td><td>{i.code}<small>{i.term_label}</small></td><td className="ta-time">{fmtD(i.due_date)}</td>
                                <td className="fi-money r">{vnd(i.balance)}<small>/ {vnd(i.total)}</small></td><td><InvStatus i={i} /></td>
                            </tr>))}</tbody></table></div>
                            <Pager page={data.meta.page} pages={data.meta.pages} total={data.meta.total} onPage={setPage} /></>)}
                </Card>
                <Card title="Lớp nợ nhiều nhất" sub="Top 12 theo số tiền">
                    {!data || data.by_class.length === 0 ? <p className="ta-mute">Không có.</p> : <HBars tone="rose" items={data.by_class.map((c) => ({ label: c.class_name, sub: `${c.students} học sinh`, value: c.balance }))} />}
                </Card>
            </div>
            <p className="ta-mute">Gửi nhắc nợ phụ huynh được thực hiện ở khu Kế toán (mục Nhắc nợ). Trang này giúp Ban giám hiệu / quản trị theo dõi tổng thể.</p>
            {open !== null && <InvoiceDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />}
        </div>
    );
}