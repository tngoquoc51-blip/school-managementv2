'use client';

import { useEffect, useState } from 'react';
import { errMsg, logApi } from '@/modules/teacher/lessonlog/service';
import type { ReviewRow, ViewProps } from '@/modules/teacher/lessonlog/types';
import { barTone, ratingOf } from '@/modules/teacher/lessonlog/util';
import { Empty, Icon, Modal, Skeleton, useUI } from '@/app/bgh/rewards/ui';
import { Bar, ReviewChip } from '../parts';

/** GVCN ký sổ tuần */
export function SignModal({ classId, weekStart, label, initial, onClose, onDone }: { classId: number; weekStart: string; label: string; initial?: string | null; onClose: () => void; onDone: () => void }) {
    const { toast } = useUI();
    const [comment, setComment] = useState(initial || '');
    const [missing, setMissing] = useState(0);
    const [force, setForce] = useState(false);
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (busy || (missing > 0 && !force)) return;
        setBusy(true);
        try {
            const r: any = await logApi.sign({ class_id: classId, week_start: weekStart, comment: comment.trim() || null, force: force || undefined });
            toast('success', 'Đã ký sổ tuần', r.message);
            onDone();
        } catch (e: any) {
            const m = e?.response?.data?.missing;
            if (m) setMissing(m); else toast('error', 'Không thể ký sổ tuần', errMsg(e));
            setBusy(false);
        }
    };

    return (
        <Modal title="Ký sổ đầu bài tuần" small onClose={onClose}
               footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn primary" disabled={busy || (missing > 0 && !force)} onClick={submit}><Icon n="check" s={16} />{busy ? 'Đang ký…' : 'Ký và gửi BGH'}</button></>}>
            <p><b>{label}</b></p>
            {missing > 0 && (
                <div className="rw-err" style={{ margin: '8px 0' }}>
                    <Icon n="alert" />
                    <div>Còn <b>{missing} tiết</b> chưa ký sổ.
                        <label style={{ display: 'flex', gap: 8, marginTop: 6, fontWeight: 600 }}><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />Vẫn ký tuần này dù còn thiếu tiết</label>
                    </div>
                </div>
            )}
            <label className="fld">Nhận xét của giáo viên chủ nhiệm
                <textarea className="ll-ta" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tình hình lớp trong tuần, nề nếp, học tập, kiến nghị…" />
            </label>
            <p className="hint">Sau khi ký, sổ tuần được khóa và gửi Ban Giám hiệu duyệt. Bạn có thể mở lại nếu Ban Giám hiệu chưa duyệt.</p>
        </Modal>
    );
}

function DecideModal({ classId, row, onClose, onDone }: { classId: number; row: ReviewRow; onClose: () => void; onDone: () => void }) {
    const { toast } = useUI();
    const [decision, setDecision] = useState<'approve' | 'return'>('approve');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        setBusy(true);
        try {
            const r: any = await logApi.decide({ class_id: classId, week_start: row.week_start, decision, note: note.trim() || null });
            toast('success', decision === 'approve' ? 'Đã duyệt sổ tuần' : 'Đã trả lại sổ tuần', r.message);
            onDone();
        } catch (e) { toast('error', 'Không thể xử lý', errMsg(e)); setBusy(false); }
    };
    return (
        <Modal title="Ban Giám hiệu duyệt sổ tuần" small onClose={onClose}
               footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className={`btn ${decision === 'approve' ? 'primary' : 'danger'}`} disabled={busy} onClick={submit}>{decision === 'approve' ? 'Duyệt' : 'Trả lại'}</button></>}>
            <p><b>{row.label}</b></p>
            {row.homeroom_comment && <div className="ll-ro" style={{ margin: '8px 0' }}>{row.homeroom_comment}</div>}
            <div className="seg" style={{ margin: '8px 0' }}>
                <button className={decision === 'approve' ? 'on' : ''} onClick={() => setDecision('approve')}>Duyệt</button>
                <button className={decision === 'return' ? 'on' : ''} onClick={() => setDecision('return')}>Trả lại</button>
            </div>
            <label className="fld">{decision === 'return' ? 'Lý do trả lại *' : 'Ý kiến (không bắt buộc)'}
                <textarea className="ll-ta" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
        </Modal>
    );
}

export default function Reviews({ meta, classId, date, rev, isHomeroom, setDate, go, changed }: ViewProps) {
    const { toast, confirm } = useUI();
    const [rows, setRows] = useState<ReviewRow[] | null>(null);
    const [sem, setSem] = useState('');
    const [err, setErr] = useState('');
    const [sign, setSign] = useState<ReviewRow | null>(null);
    const [dec, setDec] = useState<ReviewRow | null>(null);

    useEffect(() => {
        setRows(null); setErr('');
        logApi.reviews(classId, date).then((r) => { setRows(r.data); setSem(r.semester.name); }).catch((e) => setErr(errMsg(e)));
    }, [classId, date, rev]);

    const reopen = async (r: ReviewRow) => {
        if (!(await confirm({ title: 'Mở lại sổ tuần?', msg: `${r.label} sẽ được mở để chỉnh sửa. Bạn cần ký lại sau khi hoàn tất.`, ok: 'Mở lại' }))) return;
        try { const x: any = await logApi.reopen({ class_id: classId, week_start: r.week_start }); toast('info', 'Đã mở lại', x.message); changed(); }
        catch (e) { toast('error', 'Không thể mở lại', errMsg(e)); }
    };
    const view = (r: ReviewRow) => { setDate(r.week_start); go('week'); };

    if (err) return <div className="rw-err"><Icon n="alert" />{err}</div>;
    if (!rows) return <Skeleton h={320} />;

    return (
        <div className="rw-stack">
            <div className="row"><b style={{ fontSize: 15 }}>Các tuần của {sem}</b><span className="spacer" /><span className="muted">{rows.filter((r) => r.status === 'approved').length}/{rows.length} tuần đã được duyệt</span></div>
            {!rows.length ? <div className="panel"><Empty icon="log" text="Chưa có tuần nào trong học kỳ." /></div> : (
                <div className="panel" style={{ overflow: 'auto' }}>
                    <table className="tbl">
                        <thead><tr><th>Tuần</th><th style={{ minWidth: 150 }}>Đã ký sổ</th><th>Xếp loại TB</th><th>Trạng thái</th><th>Nhận xét</th><th /></tr></thead>
                        <tbody>
                        {rows.map((r) => (
                            <tr key={r.week_start}>
                                <td><b>{r.label}</b></td>
                                <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Bar pct={r.rate} tone={barTone(r.rate)} /><span style={{ whiteSpace: 'nowrap' }}>{r.filled}/{r.total}</span></div></td>
                                <td>{ratingOf(r.avg_rating)}</td>
                                <td><ReviewChip status={r.status} /></td>
                                <td style={{ maxWidth: 300 }}>
                                    {r.homeroom_comment && <div className="hint">GVCN: {r.homeroom_comment}</div>}
                                    {r.bgh_note && <div className="hint">BGH: {r.bgh_note}</div>}
                                    {!r.homeroom_comment && !r.bgh_note && <span className="muted">—</span>}
                                </td>
                                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                                    <button className="btn ghost sm" onClick={() => view(r)}>Xem sổ</button>{' '}
                                    {isHomeroom && (r.status === 'open' || r.status === 'returned') && <button className="btn primary sm" onClick={() => setSign(r)}>Ký tuần</button>}
                                    {isHomeroom && r.status === 'signed' && <button className="btn ghost sm" onClick={() => reopen(r)}>Mở lại</button>}
                                    {meta.me.is_bgh && r.status === 'signed' && <button className="btn brass sm" onClick={() => setDec(r)}>Duyệt</button>}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
            {sign && <SignModal classId={classId} weekStart={sign.week_start} label={sign.label} initial={sign.homeroom_comment} onClose={() => setSign(null)} onDone={() => { setSign(null); changed(); }} />}
            {dec && <DecideModal classId={classId} row={dec} onClose={() => setDec(null)} onDone={() => { setDec(null); changed(); }} />}
        </div>
    );
}