'use client';

import { useEffect, useState } from 'react';
import { errMsg, logApi } from '@/modules/teacher/lessonlog/service';
import type { Meta, Note, ViewProps } from '@/modules/teacher/lessonlog/types';
import { dmy } from '@/modules/teacher/lessonlog/util';
import { Empty, Icon, Modal, Skeleton, useUI } from '@/app/bgh/rewards/ui';

const KIND = { praise: { l: 'Biểu dương', icon: 'star' }, violation: { l: 'Vi phạm', icon: 'alert' }, note: { l: 'Ghi chú', icon: 'info' } } as const;

/** Thêm ghi chú nề nếp. Có thể ghi thẳng điểm thi đua và đề xuất khen thưởng / nhắc nhở tới Ban Giám hiệu. */
export function NoteModal({ meta, classId, date, onClose, onSaved }: { meta: Meta; classId: number; date: string; onClose: () => void; onSaved: () => void }) {
    const { toast } = useUI();
    const [kind, setKind] = useState<'praise' | 'violation' | 'note'>('violation');
    const [students, setStudents] = useState<{ id: number; code: string; full_name: string }[]>([]);
    const [studentId, setStudentId] = useState('');
    const [noteDate, setNoteDate] = useState(date <= meta.today ? date : meta.today);
    const [period, setPeriod] = useState('');
    const [content, setContent] = useState('');
    const [criteria, setCriteria] = useState('');
    const [points, setPoints] = useState('');
    const [propose, setPropose] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => { logApi.roster(classId).then((r) => setStudents(r.data)).catch(() => setStudents([])); }, [classId]);
    useEffect(() => { setCriteria(''); setPoints(''); setPropose(false); }, [kind]);

    const list = meta.criteria.filter((c) => (kind === 'praise' ? c.type === 'plus' : kind === 'violation' ? c.type === 'minus' : false));
    const crit = list.find((c) => String(c.id) === criteria);

    const submit = async () => {
        if (busy) return;
        if (content.trim().length < 3) { toast('warn', 'Thiếu nội dung', 'Nhập nội dung ghi chú.'); return; }
        setBusy(true);
        try {
            const r = await logApi.addNote({
                class_id: classId, student_id: studentId ? Number(studentId) : null, note_date: noteDate, period: period ? Number(period) : null, kind, content: content.trim(),
                criteria_id: criteria ? Number(criteria) : null, points: criteria && points ? Number(points) : null, propose: propose || undefined,
            });
            toast('success', 'Đã ghi vào sổ nề nếp', r.message);
            onSaved();
        } catch (e) { toast('error', 'Không thể ghi sổ nề nếp', errMsg(e)); setBusy(false); }
    };

    return (
        <Modal title="Ghi sổ theo dõi nề nếp" onClose={onClose}
               footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn primary" disabled={busy} onClick={submit}>{busy ? 'Đang lưu…' : 'Ghi vào sổ'}</button></>}>
            <div className="seg" style={{ marginBottom: 10 }}>
                {(Object.keys(KIND) as (keyof typeof KIND)[]).map((k) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{KIND[k].l}</button>)}
            </div>
            <div className="grid2">
                <label className="fld">Học sinh
                    <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                        <option value="">Cả lớp</option>
                        {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.code})</option>)}
                    </select></label>
                <label className="fld">Ngày<input type="date" max={meta.today} value={noteDate} onChange={(e) => setNoteDate(e.target.value)} /></label>
            </div>
            <div className="grid2">
                <label className="fld">Tiết học (nếu có)
                    <select value={period} onChange={(e) => setPeriod(e.target.value)}><option value="">—</option>{meta.periods.map((p) => <option key={p.id} value={p.id}>Tiết {p.id}</option>)}</select></label>
                <div />
            </div>
            <label className="fld">Nội dung<textarea className="ll-ta" value={content} onChange={(e) => setContent(e.target.value)} placeholder={kind === 'praise' ? 'Việc tốt, thành tích đáng biểu dương…' : kind === 'violation' ? 'Mô tả vi phạm, thời điểm, mức độ…' : 'Ghi chú theo dõi lớp, học sinh…'} /></label>

            {kind !== 'note' && (
                <div className="panel" style={{ padding: 14, marginTop: 6 }}>
                    <b style={{ fontSize: 13.5 }}>Liên kết với các chức năng khác</b>
                    <div className="grid2" style={{ marginTop: 8 }}>
                        <label className="fld">Ghi vào điểm thi đua của lớp
                            <select value={criteria} onChange={(e) => { setCriteria(e.target.value); setPoints(''); }}>
                                <option value="">Không ghi điểm</option>
                                {list.map((c) => <option key={c.id} value={c.id}>{c.name} ({Number(c.default_points) > 0 ? '+' : ''}{Number(c.default_points)})</option>)}
                            </select></label>
                        {crit && <label className="fld">Điểm (độ lớn)<input type="number" step="0.5" min="0.5" max="50" value={points} placeholder={String(Math.abs(Number(crit.default_points)))} onChange={(e) => setPoints(e.target.value)} /></label>}
                    </div>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                        <input type="checkbox" checked={propose} onChange={(e) => setPropose(e.target.checked)} />
                        Đề xuất {kind === 'praise' ? 'khen thưởng' : 'nhắc nhở'} tới Ban Giám hiệu (hiện trong mục Phê duyệt)
                    </label>
                </div>
            )}
        </Modal>
    );
}

export default function Notes({ meta, classId, date, rev, isHomeroom, openNote, changed }: ViewProps) {
    const { toast, confirm } = useUI();
    const [kind, setKind] = useState('');
    const [rows, setRows] = useState<Note[] | null>(null);
    const [err, setErr] = useState('');

    useEffect(() => {
        setRows(null); setErr('');
        logApi.notes({ class_id: classId, kind }).then((r) => setRows(r.data)).catch((e) => setErr(errMsg(e)));
    }, [classId, kind, rev, date]);

    const remove = async (n: Note) => {
        if (!(await confirm({ title: 'Xóa ghi chú?', danger: true, ok: 'Xóa', msg: n.emu_record_id ? 'Điểm thi đua đã ghi kèm cũng sẽ bị xóa.' : 'Ghi chú sẽ bị xóa khỏi sổ.' }))) return;
        try { const r = await logApi.delNote(n.id); toast('success', 'Đã xóa ghi chú', r.message); changed(); } catch (e) { toast('error', 'Không thể xóa', errMsg(e)); }
    };

    if (err) return <div className="rw-err"><Icon n="alert" />{err}</div>;

    return (
        <div className="rw-stack">
            <div className="row">
                <div className="seg">
                    {[['', 'Tất cả'], ['praise', 'Biểu dương'], ['violation', 'Vi phạm'], ['note', 'Ghi chú']].map(([k, l]) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}
                </div>
                <span className="spacer" />
                {!meta.me.is_bgh && <button className="btn brass" onClick={openNote}><Icon n="plus" s={16} />Ghi nhận mới</button>}
            </div>
            {!rows ? <Skeleton h={260} /> : !rows.length ? <div className="panel"><Empty icon="star" text="Chưa có ghi chú nào." /></div> : (
                <div className="panel">
                    {rows.map((n) => (
                        <div className="ll-note" key={n.id}>
                            <span className={`ic ${n.kind}`}><Icon n={KIND[n.kind].icon} s={17} /></span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p><b>{n.student_name || 'Cả lớp'}</b>{n.student_code ? <span className="muted"> · {n.student_code}</span> : null}</p>
                                <p>{n.content}</p>
                                <div className="meta">
                                    <span>{dmy(n.note_date)}{n.period ? ` · tiết ${n.period}` : ''}</span><span>· {n.created_by_name || '—'}</span>
                                    {n.emu_record_id && <span className="badge good">Đã ghi điểm thi đua</span>}
                                    {n.award_id && <span className="badge info">Đã đề xuất Ban Giám hiệu</span>}
                                </div>
                            </div>
                            {!meta.me.is_bgh && isHomeroom && <button className="icon-btn" title="Xóa" onClick={() => remove(n)}><Icon n="trash" s={16} /></button>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}