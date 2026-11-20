'use client';
import { useCallback, useEffect, useState } from 'react';
import { wApi, errMsg } from './api';
import { fmtDate, money, termText } from './format';
import type { InvoiceChange, Meta, Paged, WRecord } from './types';
import { Avatar, Badge, Empty, Icon, Modal, Pager, Pct, Skeleton, useDebounced, useUI } from './ui';

const RESULT: Record<string, [string, string]> = {
    will_update: ['Sẽ cập nhật', 'info'], updated: ['Đã cập nhật', 'approved'], unchanged: ['Không đổi', 'cancelled'], skipped_paid: ['Đã thu vượt mức', 'pending'],
};

function RecalcModal({ w, yearId, onClose, onDone }: { w: WRecord; yearId: number; onClose: () => void; onDone: () => void }) {
    const { toast } = useUI();
    const [rows, setRows] = useState<InvoiceChange[] | null>(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => { wApi.recalc(w.student_id, yearId, false).then(setRows).catch((e) => { toast('error', 'Không tính được', errMsg(e)); onClose(); });   // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [w.student_id, yearId]);
    const todo = rows?.filter((r) => r.result === 'will_update').length || 0;
    async function apply() {
        setBusy(true);
        try { const r = await wApi.recalc(w.student_id, yearId, true); toast('success', 'Đã áp dụng vào hóa đơn', `${r.filter((x) => x.result === 'updated').length} hóa đơn được cập nhật.`); onDone(); onClose(); }
        catch (e) { toast('error', 'Áp dụng thất bại', errMsg(e)); } finally { setBusy(false); }
    }
    return (
        <Modal onClose={onClose}>
            <h3>Áp dụng vào hóa đơn học phí</h3>
            <p className="wv-msg">{w.student_name} · {w.label} ({w.percent}%). Hệ thống tính lại giảm trừ trên dòng học phí của hóa đơn chưa hủy.</p>
            {!rows ? <Skeleton rows={3} /> : rows.length === 0 ? <Empty icon="file" title="Học sinh chưa có hóa đơn học kỳ nào" /> : (
                <div className="wv-impact">{rows.map((r) => (
                    <div key={r.invoice} className="wv-q"><div><b>{r.invoice}</b> <span className="wv-sub">{r.term}</span><div className="wv-sub">{money(r.old_total)} → <b>{money(r.new_total)}</b>{r.paid ? ` · đã thu ${money(r.paid)}` : ''}</div></div>
                        <Badge s={RESULT[r.result][1]} label={RESULT[r.result][0]} /></div>))}</div>
            )}
            <div className="acts"><button className="wv-btn" onClick={onClose}>Đóng</button><button className="wv-btn pri" disabled={!todo || busy} onClick={apply}>{busy ? 'Đang áp dụng…' : `Áp dụng (${todo})`}</button></div>
        </Modal>
    );
}

export default function RecordsTab({ meta, yearId, tick, onChanged }: { meta: Meta; yearId: number; tick: number; onChanged: () => void }) {
    const { toast, confirm } = useUI();
    const [status, setStatus] = useState('active');
    const [q, setQ] = useState(''); const dq = useDebounced(q);
    const [kind, setKind] = useState(''); const [grade, setGrade] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<Paged<WRecord> | null>(null);
    const [recalc, setRecalc] = useState<WRecord | null>(null);

    const load = useCallback(() => {
        setData(null);
        wApi.records({ school_year_id: yearId, status, q: dq, kind, grade, page, per_page: 15 }).then(setData).catch((e) => toast('error', 'Không tải được danh sách', errMsg(e)));
    }, [yearId, status, dq, kind, grade, page, toast]);
    useEffect(() => { load(); }, [load, tick]);
    useEffect(() => { setPage(1); }, [status, dq, kind, grade, yearId]);

    async function revoke(w: WRecord) {
        const c = await confirm({ title: 'Thu hồi miễn giảm?', message: `${w.student_name} sẽ không còn được ${w.label.toLowerCase()} (${w.percent}%). Hóa đơn chưa thu sẽ được tính lại.`, okText: 'Thu hồi', danger: true, reason: { label: 'Lý do thu hồi', required: true, placeholder: 'Ví dụ: Giấy xác nhận hết hiệu lực' } });
        if (!c.ok) return;
        try { const r = await wApi.revoke(w.id, c.text); toast('warning', 'Đã thu hồi miễn giảm', r.invoices?.length ? `${r.invoices.filter((x) => x.result === 'updated').length} hóa đơn được tính lại.` : undefined); onChanged(); load(); }
        catch (e) { toast('error', 'Thu hồi thất bại', errMsg(e)); }
    }

    return (
        <>
            <div className="wv-bar">
                <div className="wv-search"><Icon n="search" /><input className="wv-input" placeholder="Tìm học sinh theo tên hoặc mã…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                <select className="wv-sel" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Mọi chính sách</option>{meta.types.map((t) => <option key={t.id} value={t.code}>{t.label}</option>)}</select>
                <select className="wv-sel" value={grade} onChange={(e) => setGrade(e.target.value)}><option value="">Mọi khối</option>{[10, 11, 12].map((g) => <option key={g} value={g}>Khối {g}</option>)}</select>
                <span style={{ flex: 1 }} />
                <button className="wv-btn" onClick={() => wApi.exportCsv('records', yearId).then(() => toast('success', 'Đã xuất file CSV')).catch((e) => toast('error', 'Xuất file thất bại', errMsg(e)))}><Icon n="download" /> Xuất CSV</button>
            </div>
            <div className="wv-chips" style={{ marginBottom: 14 }}>
                {[['active', 'Đang áp dụng'], ['revoked', 'Đã thu hồi'], ['', 'Tất cả']].map(([v, l]) => <button key={v} className={`wv-chip ${status === v ? 'on' : ''}`} onClick={() => setStatus(v)}>{l}</button>)}
            </div>
            <div className="wv-tw">
                {!data ? <Skeleton rows={8} /> : data.items.length === 0 ? <Empty icon="gift" title="Chưa có bản ghi miễn giảm" hint="Các đơn được duyệt sẽ xuất hiện ở đây." /> : (
                    <table className="wv-t">
                        <thead><tr><th>Học sinh</th><th>Chính sách</th><th>Học kỳ</th><th>Giá trị ước tính</th><th>Hiệu lực / duyệt bởi</th><th>Trạng thái</th><th /></tr></thead>
                        <tbody>{data.items.map((w) => (
                            <tr key={w.id}>
                                <td><div className="wv-person"><Avatar name={w.student_name} /><div><b>{w.student_name}</b><div className="wv-sub">{w.student_code} · Lớp {w.class_name || '—'}</div></div></div></td>
                                <td><Pct v={w.percent} /> <span style={{ marginLeft: 6 }}>{w.label}</span></td>
                                <td>{termText(w.terms)}</td>
                                <td className="wv-money">{money(w.estimate)}</td>
                                <td><div>{fmtDate(w.valid_from || w.created_at)}</div><div className="wv-sub">{w.approved_by || '—'}</div></td>
                                <td><Badge s={w.status || 'active'} />{w.revoke_reason && <div className="wv-sub" title={w.revoke_reason}>{w.revoke_reason.slice(0, 32)}</div>}</td>
                                <td style={{ whiteSpace: 'nowrap' }}>{(w.status || 'active') === 'active' && <>
                                    <button className="wv-btn sm" onClick={() => setRecalc(w)} title="Áp dụng vào hóa đơn"><Icon n="refresh" /> Hóa đơn</button>{' '}
                                    {meta.can_approve && <button className="wv-btn bad sm" onClick={() => revoke(w)}><Icon n="undo" /> Thu hồi</button>}</>}</td>
                            </tr>))}</tbody>
                    </table>)}
            </div>
            {data && data.items.length > 0 && <Pager page={data.meta.page} last={data.meta.last_page} total={data.meta.total} onPage={setPage} />}
            {recalc && <RecalcModal w={recalc} yearId={yearId} onClose={() => setRecalc(null)} onDone={onChanged} />}
        </>
    );
}