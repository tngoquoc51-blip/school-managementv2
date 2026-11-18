'use client';
// Hóa đơn (/admin/finance/hoa-don)
import React, { useState } from 'react';
import { Btn, Card, Empty, ErrorBox, Ico, InvStatus, Invoice, InvoiceDrawer, Loading, Page, Pager, Tabs, downloadCsv, fi, fmtD, num, qs, useDebounced, useFi, useLoad, useTa, vnd } from '../_fi';

type Res = { meta: Page; sum: { total: number; paid: number; balance: number }; data: Invoice[] };

export default function InvoicesPage() {
    const { yearId, meta } = useFi(); const { toast } = useTa();
    const [status, setStatus] = useState(''); const [term, setTerm] = useState(''); const [grade, setGrade] = useState(''); const [cls, setCls] = useState(''); const [sort, setSort] = useState('new');
    const [q, setQ] = useState(''); const [page, setPage] = useState(1); const [open, setOpen] = useState<number | null>(null); const [busy, setBusy] = useState(false);
    const dq = useDebounced(q);
    const query = (extra: Record<string, string | number> = {}) => qs({ year_id: yearId, status, term, grade, class_id: cls, sort, q: dq, page, ...extra });
    const { data, err, loading, reload } = useLoad(() => fi<Res>(`invoices${query()}`), [yearId, status, term, grade, cls, sort, dq, page]);
    const classes = meta.classes.filter((c) => !grade || String(c.grade) === grade);
    const set = <T,>(f: (v: T) => void) => (v: T) => { f(v); setPage(1); };

    const exportCsv = async () => {
        setBusy(true);
        try {
            const r = await fi<Res>(`invoices${query({ export: 1, page: 1 })}`);
            downloadCsv(`hoa-don-${yearId}.csv`, ['Mã hóa đơn', 'Mã HS', 'Họ tên', 'Lớp', 'Kỳ thu', 'Hạn nộp', 'Phải thu', 'Đã thu', 'Còn nợ', 'Trạng thái', 'Quá hạn (ngày)'],
                r.data.map((i) => [i.code, i.scode, i.sname, i.class_name, i.term_label, i.due_date, i.total, i.paid, i.balance, i.status, i.overdue_days]));
            toast(`Đã xuất ${r.data.length} hóa đơn.`);
        } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
    };

    return (
        <div className="ta-page">
            <Tabs value={status} onChange={set(setStatus)} items={[{ key: '', label: 'Tất cả' }, { key: 'unpaid', label: 'Chưa thu', tone: 'rose' }, { key: 'partial', label: 'Thu một phần', tone: 'amber' }, { key: 'overdue', label: 'Quá hạn', tone: 'rose' }, { key: 'paid', label: 'Đã thu đủ', tone: 'green' }, { key: 'cancelled', label: 'Đã hủy' }]} />
            <div className="ta-filters">
                <label className="ta-search"><Ico n="search" size={16} /><input placeholder="Tìm mã hóa đơn, mã HS, họ tên…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label>
                <select value={term} onChange={(e) => set(setTerm)(e.target.value)}><option value="">Mọi kỳ thu</option>{Object.entries(meta.terms).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <select value={grade} onChange={(e) => { setGrade(e.target.value); setCls(''); setPage(1); }}><option value="">Mọi khối</option>{[10, 11, 12].map((g) => <option key={g} value={g}>Khối {g}</option>)}</select>
                <select value={cls} onChange={(e) => set(setCls)(e.target.value)}><option value="">Mọi lớp</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <select value={sort} onChange={(e) => set(setSort)(e.target.value)}><option value="new">Mới nhất</option><option value="due">Hạn nộp gần nhất</option><option value="balance">Còn nợ nhiều nhất</option><option value="total">Số tiền lớn nhất</option></select>
                <span style={{ flex: 1 }} /><Btn size="sm" busy={busy} onClick={exportCsv}><Ico n="download" size={15} />Xuất Excel (CSV)</Btn>
            </div>
            {data && <div className="fi-sum"><div><small>Số hóa đơn (theo bộ lọc)</small><b>{num(data.meta.total)}</b></div><div><small>Phải thu</small><b>{vnd(data.sum.total)}</b></div><div><small>Đã thu</small><b className="fi-money g">{vnd(data.sum.paid)}</b></div><div><small>Còn nợ</small><b className="fi-money r">{vnd(data.sum.balance)}</b></div></div>}
            <Card pad={false}>
                {loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /> : data.data.length === 0 ? <Empty icon="doc" title="Không có hóa đơn phù hợp" text="Hãy thử đổi bộ lọc hoặc năm học." /> : (
                    <>
                        <div className="ta-tablewrap"><table className="ta-tbl big"><thead><tr><th>Hóa đơn</th><th>Học sinh</th><th>Kỳ thu</th><th>Hạn nộp</th><th>Phải thu</th><th>Đã thu</th><th>Còn nợ</th><th>Trạng thái</th></tr></thead><tbody>
                        {data.data.map((i) => (
                            <tr key={i.id} onClick={() => setOpen(i.id)} className={i.overdue_days > 30 ? 'urgent' : ''}>
                                <td><b>{i.code}</b><small>{i.title}</small></td><td><b>{i.sname}</b><small>{i.scode}{i.class_name ? ` · ${i.class_name}` : ''}</small></td><td>{i.term_label}</td><td className="ta-time">{fmtD(i.due_date)}</td>
                                <td className="fi-money">{vnd(i.total)}</td><td className="fi-money">{vnd(i.paid)}</td><td className={`fi-money${i.balance > 0 ? ' r' : ''}`}>{vnd(i.balance)}</td><td><InvStatus i={i} /></td>
                            </tr>))}</tbody></table></div>
                        <Pager page={data.meta.page} pages={data.meta.pages} total={data.meta.total} onPage={setPage} />
                    </>)}
            </Card>
            {open !== null && <InvoiceDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />}
        </div>
    );
}