'use client';
import { useCallback, useEffect, useState } from 'react';
import { wApi, errMsg } from './api';
import { ACTION, fmtDateTime, money, termText } from './format';
import type { InvoiceChange, Meta, Paged, WRequest } from './types';
import { Avatar, Badge, Drawer, Empty, Icon, Pager, Pct, Skeleton, useDebounced, useUI } from './ui';

const CHIPS: [string, string][] = [['', 'Tất cả'], ['pending', 'Chờ duyệt'], ['approved', 'Đã duyệt'], ['rejected', 'Từ chối'], ['cancelled', 'Đã hủy']];

function invoiceMsg(list: InvoiceChange[] | null) {
    if (!list || !list.length) return '';
    const up = list.filter((x) => x.result === 'updated').length;
    const sk = list.filter((x) => x.result === 'skipped_paid').length;
    return `Đã cập nhật ${up} hóa đơn${sk ? `, ${sk} hóa đơn đã thu vượt mức cần xử lý thủ công` : ''}.`;
}

function Detail({ id, meta, onClose, onChanged }: { id: number; meta: Meta; onClose: () => void; onChanged: () => void }) {
    const { toast, confirm } = useUI();
    const [d, setD] = useState<Awaited<ReturnType<typeof wApi.request>> | null>(null);
    const [busy, setBusy] = useState(false);
    const load = useCallback(() => wApi.request(id).then(setD).catch((e) => toast('error', 'Không tải được đơn', errMsg(e))), [id, toast]);
    useEffect(() => { load(); }, [load]);

    async function act(kind: 'approve' | 'reject' | 'cancel') {
        if (!d) return;
        const r = d.request;
        const c = await confirm(kind === 'approve'
            ? { title: 'Duyệt đơn miễn giảm?', message: `${r.student_name} sẽ được miễn giảm ${r.percent}% học phí (${termText(r.terms)}).`, okText: 'Duyệt đơn', reason: { label: 'Ghi chú (không bắt buộc)' } }
            : kind === 'reject'
                ? { title: 'Từ chối đơn?', message: 'Lý do sẽ được lưu lại và hiển thị trong lịch sử.', okText: 'Từ chối', danger: true, reason: { label: 'Lý do từ chối', required: true } }
                : { title: 'Hủy đơn này?', message: 'Đơn sẽ chuyển sang trạng thái đã hủy.', okText: 'Hủy đơn', danger: true });
        if (!c.ok) return;
        setBusy(true);
        try {
            if (kind === 'approve') { const res = await wApi.approve(r.id, c.text); toast('success', 'Đã duyệt đơn ' + r.code, invoiceMsg(res.invoices) || 'Miễn giảm đã có hiệu lực.'); }
            if (kind === 'reject') { await wApi.reject(r.id, c.text); toast('warning', 'Đã từ chối đơn ' + r.code); }
            if (kind === 'cancel') { await wApi.cancel(r.id); toast('info', 'Đã hủy đơn ' + r.code); }
            onChanged(); load();
        } catch (e) { toast('error', 'Thao tác thất bại', errMsg(e)); } finally { setBusy(false); }
    }

    const r = d?.request;
    return (
        <Drawer title={r ? <>Đơn {r.code} <Badge s={r.status} /></> : 'Chi tiết đơn'} onClose={onClose}
                footer={r?.status === 'pending' ? <>
                    <button className="wv-btn" disabled={busy} onClick={() => act('cancel')}>Hủy đơn</button>
                    {meta.can_approve && <><button className="wv-btn bad" disabled={busy} onClick={() => act('reject')}><Icon n="x" /> Từ chối</button>
                        <button className="wv-btn ok" disabled={busy} onClick={() => act('approve')}><Icon n="check" /> Duyệt đơn</button></>}
                </> : undefined}>
            {!d || !r ? <Skeleton rows={7} /> : <>
                <section className="wv-card">
                    <div className="wv-person" style={{ marginBottom: 14 }}><Avatar name={r.student_name} /><div><b style={{ fontSize: 16 }}>{r.student_name}</b><div className="wv-sub">{r.student_code} · Lớp {r.class_name || '—'}</div></div></div>
                    <dl className="wv-kv">
                        <dt>Chính sách</dt><dd>{r.label} <Pct v={r.percent} /></dd>
                        <dt>Học kỳ áp dụng</dt><dd>{termText(r.terms)}</dd>
                        <dt>Mức ưu tiên</dt><dd>{r.priority === 'high' ? <Badge s="high" label="Ưu tiên" /> : 'Bình thường'}</dd>
                        <dt>Lý do</dt><dd>{r.reason || '—'}</dd>
                        <dt>Hồ sơ đã nhận</dt><dd>{r.proof_note || 'Chưa đánh dấu hồ sơ nào'}</dd>
                        <dt>Người lập</dt><dd>{r.requested_by} · {fmtDateTime(r.requested_at)}</dd>
                        {r.reviewed_at && <><dt>Người xử lý</dt><dd>{r.reviewed_by} · {fmtDateTime(r.reviewed_at)}</dd><dt>Ghi chú</dt><dd>{r.review_note || '—'}</dd></>}
                    </dl>
                </section>
                {d.active_waivers.length > 0 && <div className="wv-callout info"><Icon n="info" /><div>Đang áp dụng cho học sinh: {d.active_waivers.map((w) => `${w.label} (${w.percent}%)`).join(', ')}.</div></div>}
                <section className="wv-card">
                    <h3>Học phí hiện tại</h3>
                    <div className="wv-impact">{d.impact.terms.filter((t) => r.terms.includes(t.term)).map((t) => (
                        <div className="wv-imp" key={t.term}><b>{t.term}</b>
                            <div><div className="wv-sub">Học phí {money(t.tuition)} · đang giảm {t.current_percent}%</div><div className="wv-meter"><i style={{ width: `${t.current_percent}%` }} /></div></div>
                            <div className="wv-sub">{t.invoice ? `${t.invoice.code}` : 'Chưa có HĐ'}</div></div>))}</div>
                </section>
                <section className="wv-card">
                    <h3>Lịch sử xử lý</h3>
                    <ul className="wv-tl">{d.history.map((h, i) => (<li key={i}><b>{ACTION[h.action] || h.action}</b> <span className="wv-sub">· {h.actor}</span><div className="wv-sub">{fmtDateTime(h.created_at)}</div></li>))}</ul>
                </section>
            </>}
        </Drawer>
    );
}

export default function RequestsTab({ meta, yearId, tick, onChanged, onNew, initialStatus }: { meta: Meta; yearId: number; tick: number; onChanged: () => void; onNew: () => void; initialStatus?: string }) {
    const { toast, confirm } = useUI();
    const [status, setStatus] = useState(initialStatus ?? 'pending');
    const [q, setQ] = useState(''); const dq = useDebounced(q);
    const [typeId, setTypeId] = useState(''); const [grade, setGrade] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<Paged<WRequest> | null>(null);
    const [sel, setSel] = useState<number[]>([]);
    const [open, setOpen] = useState<number | null>(null);

    const load = useCallback(() => {
        setData(null);
        wApi.requests({ school_year_id: yearId, status, q: dq, type_id: typeId, grade, page, per_page: 15 })
            .then(setData).catch((e) => toast('error', 'Không tải được danh sách', errMsg(e)));
    }, [yearId, status, dq, typeId, grade, page, toast]);
    useEffect(() => { load(); }, [load, tick]);
    useEffect(() => { setPage(1); setSel([]); }, [status, dq, typeId, grade, yearId]);

    const pendingIds = (data?.items || []).filter((x) => x.status === 'pending').map((x) => x.id);

    async function bulk() {
        const c = await confirm({ title: `Duyệt ${sel.length} đơn đã chọn?`, message: 'Mỗi đơn sẽ có hiệu lực ngay và được trừ vào hóa đơn học phí chưa thu.', okText: 'Duyệt tất cả', reason: { label: 'Ghi chú chung (không bắt buộc)' } });
        if (!c.ok) return;
        try {
            const r = await wApi.bulkApprove(sel, c.text);
            toast(r.errors.length ? 'warning' : 'success', `Đã duyệt ${r.approved} đơn`, r.errors.slice(0, 2).join(' | '));
            setSel([]); onChanged(); load();
        } catch (e) { toast('error', 'Duyệt hàng loạt thất bại', errMsg(e)); }
    }

    return (
        <>
            <div className="wv-bar">
                <div className="wv-search"><Icon n="search" /><input className="wv-input" placeholder="Tìm theo tên, mã học sinh, mã đơn…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                <select className="wv-sel" value={typeId} onChange={(e) => setTypeId(e.target.value)}><option value="">Mọi chính sách</option>{meta.types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
                <select className="wv-sel" value={grade} onChange={(e) => setGrade(e.target.value)}><option value="">Mọi khối</option>{[10, 11, 12].map((g) => <option key={g} value={g}>Khối {g}</option>)}</select>
                <span style={{ flex: 1 }} />
                <button className="wv-btn" onClick={() => wApi.exportCsv('requests', yearId).then(() => toast('success', 'Đã xuất file CSV')).catch((e) => toast('error', 'Xuất file thất bại', errMsg(e)))}><Icon n="download" /> Xuất CSV</button>
                <button className="wv-btn pri" onClick={onNew}><Icon n="plus" /> Lập đơn mới <kbd>N</kbd></button>
            </div>
            <div className="wv-chips" style={{ marginBottom: 14 }}>{CHIPS.map(([v, l]) => <button key={v} className={`wv-chip ${status === v ? 'on' : ''}`} onClick={() => setStatus(v)}>{l}</button>)}</div>

            <div className="wv-tw">
                {!data ? <Skeleton rows={8} /> : data.items.length === 0 ? <Empty icon="file" title="Không có đơn nào" hint="Thử đổi bộ lọc hoặc lập đơn mới." action={<button className="wv-btn pri" onClick={onNew}><Icon n="plus" /> Lập đơn mới</button>} /> : (
                    <table className="wv-t">
                        <thead><tr>
                            <th style={{ width: 36 }}>{meta.can_approve && pendingIds.length > 0 && <input type="checkbox" checked={sel.length === pendingIds.length} onChange={(e) => setSel(e.target.checked ? pendingIds : [])} aria-label="Chọn tất cả" />}</th>
                            <th>Học sinh</th><th>Chính sách</th><th>Học kỳ</th><th>Người lập</th><th>Trạng thái</th><th /></tr></thead>
                        <tbody>{data.items.map((r) => (
                            <tr key={r.id} className="click" onClick={() => setOpen(r.id)}>
                                <td onClick={(e) => e.stopPropagation()}>{meta.can_approve && r.status === 'pending' && <input type="checkbox" checked={sel.includes(r.id)} onChange={() => setSel(sel.includes(r.id) ? sel.filter((x) => x !== r.id) : [...sel, r.id])} />}</td>
                                <td><div className="wv-person"><Avatar name={r.student_name} /><div><b>{r.student_name}</b><div className="wv-sub">{r.student_code} · Lớp {r.class_name || '—'}</div></div></div></td>
                                <td><Pct v={r.percent} /> <span style={{ marginLeft: 6 }}>{r.label}</span><div className="wv-sub">{r.code}</div></td>
                                <td>{termText(r.terms)}</td>
                                <td><div>{r.requested_by}</div><div className="wv-sub">{fmtDateTime(r.requested_at)}</div></td>
                                <td><Badge s={r.status} />{r.priority === 'high' && r.status === 'pending' && <> <Badge s="high" label="Ưu tiên" /></>}</td>
                                <td><Icon n="right" /></td>
                            </tr>))}</tbody>
                    </table>)}
            </div>
            {data && data.items.length > 0 && <Pager page={data.meta.page} last={data.meta.last_page} total={data.meta.total} onPage={setPage} />}
            {sel.length > 0 && <div className="wv-bulk"><span>Đã chọn <b>{sel.length}</b> đơn</span><span style={{ display: 'flex', gap: 8 }}><button className="wv-btn sm" onClick={() => setSel([])}>Bỏ chọn</button><button className="wv-btn ok sm" onClick={bulk}><Icon n="check" /> Duyệt đã chọn</button></span></div>}
            {open && <Detail id={open} meta={meta} onClose={() => setOpen(null)} onChanged={() => { onChanged(); load(); }} />}
        </>
    );
}