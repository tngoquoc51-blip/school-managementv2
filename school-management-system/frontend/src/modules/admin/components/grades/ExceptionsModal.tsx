'use client';

import { useState } from 'react';
import { Modal, ConfirmDialog } from '../ui/Modal';
import { Icon } from '../ui/Icons';
import { useToast } from '../ui/Toast';
import { gradeService } from '../../services/gradeService';
import type { GradeClassLite, GradeSubjectLite, GradeWindow } from '../../types/grades';
import { fmtDateTime } from '../classes/shared';

interface Props {
    open: boolean; onClose: () => void; win: GradeWindow; yearId: number;
    classes: GradeClassLite[]; subjects: GradeSubjectLite[]; onChanged: () => void;
}

/** Mở điểm riêng cho 1 lớp (hoặc 1 lớp + 1 môn) dù kỳ đang bị khóa chung — dùng khi 1 giáo viên nộp trễ. */
export function ExceptionsModal({ open, onClose, win, yearId, classes, subjects, onChanged }: Props) {
    const toast = useToast();
    const [classId, setClassId] = useState<number | ''>('');
    const [subjectId, setSubjectId] = useState<number | ''>('');
    const [expiresAt, setExpiresAt] = useState('');
    const [busy, setBusy] = useState(false);
    const [removing, setRemoving] = useState<number | null>(null);

    const add = async () => {
        if (!classId) return;
        setBusy(true);
        try {
            await gradeService.addException(yearId, win.semester, +classId, subjectId ? +subjectId : null, expiresAt || null);
            toast.success('Đã thêm ngoại lệ', 'Lớp này có thể nhập điểm dù kỳ đang khóa.');
            setClassId(''); setSubjectId(''); setExpiresAt(''); onChanged();
        } catch (e: any) { toast.error('Không thể thêm ngoại lệ', e?.response?.data?.message || 'Đã xảy ra lỗi.'); } finally { setBusy(false); }
    };

    const remove = async () => {
        if (removing == null) return;
        setBusy(true);
        try {
            await gradeService.removeException(yearId, win.semester, removing);
            toast.success('Đã gỡ ngoại lệ');
            setRemoving(null); onChanged();
        } catch (e: any) { toast.error('Không thể gỡ ngoại lệ', e?.response?.data?.message || 'Đã xảy ra lỗi.'); } finally { setBusy(false); }
    };

    return (
        <Modal open={open} onClose={onClose} size="lg" title={`Ngoại lệ mở điểm · Học kỳ ${win.semester}`}
               subtitle="Cho phép một lớp (hoặc một lớp-môn) nhập điểm riêng dù kỳ đang khóa chung">
            <div className="a-grid2" style={{ paddingTop: 8, marginBottom: 14 }}>
                <div className="a-field"><label>Lớp *</label>
                    <select className="a-select" value={classId} onChange={(e) => setClassId(e.target.value ? +e.target.value : '')}>
                        <option value="">— Chọn lớp —</option>
                        {classes.map((c) => <option key={c.id} value={c.id}>{c.name} (Khối {c.grade})</option>)}
                    </select></div>
                <div className="a-field"><label>Môn (để trống = mở mọi môn của lớp)</label>
                    <select className="a-select" value={subjectId} onChange={(e) => setSubjectId(e.target.value ? +e.target.value : '')}>
                        <option value="">— Mọi môn —</option>
                        {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select></div>
            </div>
            <div className="a-grid2" style={{ marginBottom: 16 }}>
                <div className="a-field"><label>Hết hạn lúc (không bắt buộc)</label>
                    <input type="datetime-local" className="a-input" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button className="a-btn pri" style={{ width: '100%' }} onClick={add} disabled={!classId || busy}>{busy && <span className="a-spin" />} <Icon name="plus" size={16} /> Thêm ngoại lệ</button>
                </div>
            </div>

            {win.exceptions.length === 0 ? (
                <div className="a-empty">Chưa có ngoại lệ nào cho học kỳ này.</div>
            ) : (
                <div className="a-table-wrap">
                    <table className="a-table">
                        <thead><tr><th>Lớp</th><th>Môn</th><th>Hết hạn</th><th /></tr></thead>
                        <tbody>
                        {win.exceptions.map((ex) => (
                            <tr key={ex.id}>
                                <td><b>{ex.class_name}</b></td>
                                <td>{ex.subject_name ?? <span className="a-badge mut">Mọi môn</span>}</td>
                                <td className="a-muted">{ex.expires_at ? fmtDateTime(ex.expires_at) : 'Không giới hạn'}</td>
                                <td><button className="a-icon-btn" style={{ color: 'var(--danger)' }} onClick={() => setRemoving(ex.id)}><Icon name="trash" size={16} /></button></td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            <ConfirmDialog open={removing != null} danger loading={busy} title="Gỡ ngoại lệ này?" confirmText="Gỡ"
                           message="Lớp/môn này sẽ không còn được mở riêng nữa, áp dụng lại đúng theo trạng thái chung của học kỳ."
                           onConfirm={remove} onClose={() => setRemoving(null)} />
        </Modal>
    );
}