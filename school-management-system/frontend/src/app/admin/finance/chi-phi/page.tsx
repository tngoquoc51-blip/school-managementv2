'use client';
// Sổ chi (/admin/finance/chi-phi)
import React, { useState } from 'react';
import { Btn, Card, Confirm, Donut, Empty, ErrorBox, Field, Ico, Loading, Modal, Page, Pager, downloadCsv, fi, fmtD, num, qs, todayStr, useDebounced, useFi, useLoad, useTa, vnd } from '../_fi';

type E = { id: number; code: string; category: string; category_label: string; title: string; amount: number; spent_at: string; payee: string | null; method: string; method_label: string; note: string | null; created_by: string | null };
type Res = { meta: Page; sum: number; by_category: { key: string; label: string; amount: number; n: number }[]; data: E[] };

export default function ExpensesPage() {
    const { yearId, meta } = useFi(); const { toast } = useTa();
    const [cat, setCat] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [q, setQ] = useState(''); const [page, setPage] = useState(1); const dq = useDebounced(q);
    const [edit, setEdit] = useState<E | 'new' | null>(null); const [del, setDel] = useState<E | null>(null);
    const { data, err, loading, reload } = useLoad(() => fi<Res>(`expenses${qs({ year_id: yearId, category: cat, from, to, q: dq, page })}`), [yearId, cat, from, to, dq, page]);
    const exportCsv = async () => { const r = await fi<Res>(`expenses${qs({ year_id: yearId, category: cat, from, to, q: dq, export: 1 })}`); downloadCsv(`so-chi-${yearId}.csv`, ['Mã phiếu chi', 'Ngày chi', 'Nhóm', 'Nội dung', 'Số tiền', 'Đơn vị nhận', 'Hình thức', 'Ghi chú'], r.data.map((x) => [x.code, x.spent_at, x.category_label, x.title, x.amount, x.payee, x.method_label, x.note])); toast(`Đã xuất ${r.data.length} khoản chi.`); };
    return (
        <div className="ta-page">
            <div className="ta-filters">
                <label className="ta-search"><Ico n="search" size={16} /><input placeholder="Tìm nội dung, đơn vị nhận, mã phiếu…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label>
                <select value={cat} onChange={(e) => { setCat(e.target.value); setPage(1); }}><option value="">Mọi nhóm chi</option>{Object.entries(meta.expense_categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="ta-btn" aria-label="Từ ngày" /><span className="ta-mute">đến</span><input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="ta-btn" aria-label="Đến ngày" />
                <span style={{ flex: 1 }} /><Btn size="sm" onClick={exportCsv}><Ico n="download" size={15} />Xuất CSV</Btn><Btn tone="primary" onClick={() => setEdit('new')}><Ico n="plus" size={16} />Ghi khoản chi</Btn>
            </div>
            {loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /> : (
                <div className="fi-grid g21">
                    <Card pad={false} title="Các khoản chi" sub={`${num(data.meta.total)} khoản · tổng ${vnd(data.sum)}`}>
                        {data.data.length === 0 ? <Empty icon="archive" title="Chưa có khoản chi nào" text="Ghi lại các khoản chi (điện nước, sửa chữa, mua sắm…) để theo dõi chênh lệch thu – chi." action={<Btn tone="primary" onClick={() => setEdit('new')}>Ghi khoản chi</Btn>} /> : (
                            <><div className="ta-tablewrap"><table className="ta-tbl"><thead><tr><th>Ngày</th><th>Nội dung</th><th>Nhóm</th><th>Số tiền</th><th /></tr></thead><tbody>
                            {data.data.map((x) => <tr key={x.id}><td className="ta-time">{fmtD(x.spent_at)}<small>{x.code}</small></td><td><b>{x.title}</b><small>{x.payee ? `${x.payee} · ` : ''}{x.method_label}{x.note ? ` · ${x.note}` : ''}</small></td><td>{x.category_label}</td><td className="fi-money"><b>{vnd(x.amount)}</b></td>
                                <td className="ta-rowact"><Btn size="sm" onClick={() => setEdit(x)}>Sửa</Btn><Btn size="sm" tone="danger" onClick={() => setDel(x)}>Hủy</Btn></td></tr>)}</tbody></table></div>
                                <Pager page={data.meta.page} pages={data.meta.pages} total={data.meta.total} onPage={setPage} /></>)}
                    </Card>
                    <Card title="Cơ cấu chi"><Donut center="đồng" items={data.by_category.map((c) => ({ label: c.label, n: c.amount }))} /></Card>
                </div>)}
            {edit && <Form e={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); toast('Đã lưu khoản chi.'); }} />}
            {del && <Confirm title="Hủy khoản chi?" tone="danger" okText="Hủy khoản chi" noteLabel="Lý do hủy" noteRequired text={<>Khoản chi <b>{del.title}</b> ({vnd(del.amount)}) sẽ không còn tính vào sổ chi. Thao tác được ghi vào nhật ký.</>} onClose={() => setDel(null)} onOk={async (n) => { await fi(`expenses/${del.id}`, { method: 'DELETE', body: { reason: n } }); toast('Đã hủy khoản chi.'); setDel(null); reload(); }} />}
        </div>
    );
}
function Form({ e, onClose, onDone }: { e: E | null; onClose: () => void; onDone: () => void }) {
    const { meta } = useFi();
    const [f, setF] = useState({ category: e?.category || 'facility', title: e?.title || '', amount: e ? String(e.amount) : '', spent_at: e?.spent_at || todayStr(), payee: e?.payee || '', method: e?.method || 'bank_transfer', note: e?.note || '' });
    const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
    const go = async () => {
        setErr(''); const amount = Number(f.amount.replace(/\D/g, ''));
        if (!f.title.trim()) { setErr('Hãy nhập nội dung khoản chi.'); return; } if (!amount) { setErr('Hãy nhập số tiền.'); return; }
        setBusy(true);
        try { await fi(e ? `expenses/${e.id}` : 'expenses', { method: e ? 'PUT' : 'POST', body: { category: f.category, title: f.title.trim(), amount, spent_at: f.spent_at, payee: f.payee.trim() || null, method: f.method, note: f.note.trim() || null } }); onDone(); } catch (x) { setErr((x as Error).message); setBusy(false); }
    };
    return (
        <Modal title={e ? 'Sửa khoản chi' : 'Ghi khoản chi'} onClose={onClose} foot={<><Btn onClick={onClose}>Hủy</Btn><Btn tone="primary" busy={busy} onClick={go}>Lưu</Btn></>}>
            <Field label="Nội dung chi *"><input autoFocus value={f.title} onChange={(x) => set('title', x.target.value)} maxLength={200} placeholder="Tiền điện tháng 10, sửa máy chiếu phòng 203…" /></Field>
            <div className="fi-twocol">
                <Field label="Số tiền (đồng) *"><input inputMode="numeric" value={f.amount ? Number(f.amount.replace(/\D/g, '')).toLocaleString('vi-VN') : ''} onChange={(x) => set('amount', x.target.value.replace(/\D/g, ''))} /></Field>
                <Field label="Ngày chi *"><input type="date" value={f.spent_at} max={todayStr()} onChange={(x) => set('spent_at', x.target.value)} /></Field>
                <Field label="Nhóm chi"><select value={f.category} onChange={(x) => set('category', x.target.value)}>{Object.entries(meta.expense_categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <Field label="Hình thức"><select value={f.method} onChange={(x) => set('method', x.target.value)}>{Object.entries(meta.methods).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            </div>
            <Field label="Đơn vị / người nhận"><input value={f.payee} onChange={(x) => set('payee', x.target.value)} maxLength={160} /></Field>
            <Field label="Ghi chú"><textarea rows={2} value={f.note} onChange={(x) => set('note', x.target.value)} maxLength={500} /></Field>
            {err && <p className="ta-ferr">{err}</p>}
        </Modal>
    );
}