'use client';

import { useEffect, useState } from 'react';
import { apiError, cmtApi } from '@/services/teacherCommentService';
import { useToast } from '@/components/Toast';
import CommentEditorModal, { EditorTarget } from '../CommentEditorModal';
import { Empty, ErrorBox, Icon, Modal, Pager, RATING, Skeleton, Spin, fmtDateTime, periodLabel, ratingBadge, useDebounced, useFetch } from '../ui';
import type { HistoryRow, Meta } from '../types';
import s from '../comments.module.css';

export default function HistoryTab({ meta, onChanged }: { meta: Meta; onChanged: () => void }) {
    const toast = useToast();
    const [qIn, setQIn] = useState(''); const q = useDebounced(qIn);
    const [status, setStatus] = useState(''); const [rating, setRating] = useState(''); const [semester, setSemester] = useState(0); const [scope, setScope] = useState(''); const [page, setPage] = useState(1);
    const [cid, sid] = scope ? scope.split(':').map(Number) : [0, 0];
    const params = { q, status, rating, semester: semester || undefined, class_id: cid || undefined, subject_id: sid || undefined };
    useEffect(() => { setPage(1); }, [q, status, rating, semester, scope]);
    const { data, loading, error, reload } = useFetch(() => cmtApi.history({ ...params, page, per_page: 12 }), [q, status, rating, semester, scope, page]);
    const [edit, setEdit] = useState<EditorTarget | null>(null); const [del, setDel] = useState<HistoryRow | null>(null);
    const [busy, setBusy] = useState(false); const [exporting, setExporting] = useState(false);

    function open(r: HistoryRow) {
        const a = meta.assignments.find((x) => x.class_id === r.class_id && x.subject_id === r.subject_id);
        if (!a) return toast.error('Không sửa được', 'Bạn không còn được phân công dạy lớp – môn này.');
        setEdit({ student_id: r.student_id, student_name: r.student_name, student_code: r.student_code, class_label: `Lớp ${r.class_name} · ${r.subject_name}`, class_subject_id: a.id, semester: r.semester, kind: r.kind, period: r.period, rating: r.rating, content: r.content, tags: r.tags, status: r.status });
    }
    async function remove() {
        if (!del) return; setBusy(true);
        try { await cmtApi.remove(del.id); toast.success('Đã xóa nhận xét', del.student_name); setDel(null); await reload(); onChanged(); }
        catch (e) { toast.error('Không xóa được', apiError(e).message); } finally { setBusy(false); }
    }
    async function exportCsv() {
        setExporting(true);
        try { await cmtApi.exportCsv(params); toast.success('Đã xuất file nhận xét', 'Mở bằng Excel để xem.'); }
        catch (e) { toast.error('Không xuất được file', apiError(e).message); } finally { setExporting(false); }
    }

    return (
        <div className={s.panel}>
            <section className={s.card}>
                <div className={s.cardHead}>
                    <div><h3 className={s.cardTitle}><Icon n="list" /> Lịch sử nhận xét</h3><div className={s.cardSub}>Toàn bộ nhận xét bạn đã viết trong năm học hiện tại</div></div>
                    <button className={s.btn} onClick={exportCsv} disabled={exporting}>{exporting ? <Spin /> : <Icon n="download" size={16} />} Xuất Excel (CSV)</button>
                </div>
                <div className={s.toolbar}>
                    <input className={s.input} style={{ minWidth: 220 }} placeholder="Tìm học sinh, mã HS, nội dung…" value={qIn} onChange={(e) => setQIn(e.target.value)} />
                    <select className={s.select} value={scope} onChange={(e) => setScope(e.target.value)}><option value="">Mọi lớp – môn</option>{meta.assignments.map((a) => <option key={a.id} value={`${a.class_id}:${a.subject_id}`}>Lớp {a.class_name} · {a.subject_name}</option>)}</select>
                    <select className={s.select} value={semester} onChange={(e) => setSemester(Number(e.target.value))}><option value={0}>Cả năm</option>{meta.semesters.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}</select>
                    <select className={s.select} value={rating} onChange={(e) => setRating(e.target.value)}><option value="">Mọi mức</option>{Object.entries(RATING).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}</select>
                    <select className={s.select} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Mọi trạng thái</option><option value="draft">Bản nháp</option><option value="published">Đã công bố</option></select>
                </div>
                {error && !data ? <ErrorBox message={error} onRetry={reload} /> : !data ? <Skeleton h={48} n={6} /> : data.data.length === 0 ? <Empty icon="🗂️" text="Chưa có nhận xét nào phù hợp." /> : (
                    <div className={s.scroll} style={{ opacity: loading ? 0.6 : 1 }}>
                        <table className={s.table}>
                            <thead><tr><th>Học sinh</th><th>Lớp · Môn</th><th>Kỳ</th><th>Mức</th><th style={{ minWidth: 260 }}>Nội dung</th><th>Trạng thái</th><th /></tr></thead>
                            <tbody>{data.data.map((r) => (
                                <tr key={r.id}>
                                    <td><b>{r.student_name}</b><div className={s.cardSub}>{r.student_code}</div></td>
                                    <td>Lớp {r.class_name}<div className={s.cardSub}>{r.subject_name}</div></td>
                                    <td>HK{r.semester}<div className={s.cardSub}>{periodLabel(r.kind, r.period)}</div></td>
                                    <td>{ratingBadge(r.rating)}</td>
                                    <td><div className={s.clamp}>{r.content}</div><div className={s.cardSub}>{fmtDateTime(r.updated_at)}</div></td>
                                    <td><span className={`${s.badge} ${r.status === 'published' ? s.bOk : s.bMute}`}>{r.status === 'published' ? 'Đã công bố' : 'Bản nháp'}</span></td>
                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                        <button className={`${s.btn} ${s.btnS}`} aria-label="Sửa" onClick={() => open(r)}><Icon n="edit" size={14} /></button>{' '}
                                        <button className={`${s.btn} ${s.btnS} ${s.btnD}`} aria-label="Xóa" onClick={() => setDel(r)}><Icon n="trash" size={14} /></button></td>
                                </tr>))}</tbody>
                        </table>
                    </div>)}
                {data && <Pager page={data.current_page} last={data.last_page} total={data.total} onPage={setPage} busy={loading} />}
            </section>
            {edit && <CommentEditorModal target={edit} onClose={() => setEdit(null)} onSaved={() => { reload(); onChanged(); }} />}
            {del && (
                <Modal title="Xóa nhận xét?" onClose={() => setDel(null)}>
                    <p>Xóa nhận xét của <b>{del.student_name}</b> ({periodLabel(del.kind, del.period)}, HK{del.semester})? Hành động này không thể hoàn tác.</p>
                    <div className={s.modalFoot}><button className={s.btn} onClick={() => setDel(null)}>Hủy</button><button className={`${s.btn} ${s.btnD}`} disabled={busy} onClick={remove}>{busy && <Spin />} Xóa</button></div>
                </Modal>)}
        </div>
    );
}