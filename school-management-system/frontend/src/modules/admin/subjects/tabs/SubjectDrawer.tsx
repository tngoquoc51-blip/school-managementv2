'use client';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';
import { CAT_LABEL, KIND_LABEL, initials, tcls } from '../theme';
import { subjectApi } from '../api';
import type { SubjectDetail } from '../types';
import { ErrorBox, useLoad } from './shared';
import type { TabKey } from '../types';

export default function SubjectDrawer({ id, yearId, onClose, onEdit, onDuplicate, go }: { id: number; yearId: number; onClose: () => void; onEdit: (s: SubjectDetail) => void; onDuplicate: (s: SubjectDetail) => void; go: (t: TabKey) => void }) {
    const q = useLoad(() => subjectApi.detail(id, yearId), [id, yearId]);
    const s = q.data;
    const byGrade = (g: number) => s?.assignments.filter((a) => a.grade === g) ?? [];

    return (
        <Modal side onClose={onClose} title={s ? <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}><span className={`sj-avatar ${tcls(s.color)}`}>{s.code.slice(0, 3)}</span>{s.name}</span> : 'Đang tải…'}
               subtitle={s ? `${s.code} • ${s.group_name ?? 'Chưa phân tổ'}` : undefined}
               footer={s && <><button className="sj-btn" onClick={() => onDuplicate(s)}><Icon name="copy" size={15} /> Nhân bản</button><button className="sj-btn primary" onClick={() => onEdit(s)}><Icon name="edit" size={15} /> Chỉnh sửa</button></>}>
            {q.loading && !s && <div className="sj-skel" style={{ height: 160 }} />}
            {q.error && <ErrorBox msg={q.error} retry={q.reload} />}
            {s && (
                <div className={tcls(s.color)}>
                    <div className="sj-chips">
                        <span className="sj-tag">{KIND_LABEL[s.kind]}</span><span className="sj-badge">{CAT_LABEL[s.category]}</span>
                        <span className={`sj-badge ${s.status === 'active' ? 'ok' : 'warn'}`}>{s.status === 'active' ? 'Đang dạy' : 'Ngừng sử dụng'}</span>
                        <span className="sj-badge">{s.periods_per_week} tiết/tuần</span><span className="sj-badge">Khối {s.grades.join(', ')}</span>
                    </div>
                    {s.description && <p className="sj-muted sj-mt">{s.description}</p>}

                    <h4 className="sj-sec">Liên kết trong hệ thống</h4>
                    <div className="sj-grid sj-g2" style={{ gap: 10 }}>
                        {[['Phân công lớp', s.usage.class_subjects, 'assign'], ['Tiết trong TKB', s.usage.timetable, 'curriculum'], ['Bản ghi điểm', s.usage.grades, 'analytics'], ['GV chuyên môn', s.usage.teachers, 'workload']].map(([l, n, tab]) => (
                            <button key={String(l)} className="sj-card" style={{ textAlign: 'left', cursor: 'pointer', padding: 12 }} onClick={() => { go(tab as TabKey); onClose(); }}>
                                <b style={{ fontSize: 22 }}>{n as number}</b><div className="sj-muted">{l as string}</div></button>))}
                    </div>
                    {(s.usage.class_subjects + s.usage.grades + s.usage.timetable) > 0 && (
                        <div className="sj-hint warn sj-mt"><Icon name="lock" /><span>Môn đang được sử dụng nên <b>không thể xóa</b>. Có thể chuyển sang “Ngừng sử dụng” để ẩn khỏi phân công mới.</span></div>)}

                    <h4 className="sj-sec">Giáo viên chuyên môn ({s.specialists.length})</h4>
                    {s.specialists.length === 0 ? <p className="sj-muted">Chưa có giáo viên nào có chuyên môn môn này.</p> :
                        <div className="sj-chips">{s.specialists.map((t) => <span key={t.id} className="sj-badge" title={t.code}>{t.full_name}</span>)}</div>}

                    <h4 className="sj-sec">Phân công theo lớp (năm học đang chọn)</h4>
                    {s.assignments.length === 0 ? <p className="sj-muted">Chưa phân công cho lớp nào.</p> : [10, 11, 12].map((g) => byGrade(g).length > 0 && (
                        <div key={g} style={{ marginBottom: 10 }}><b>Khối {g}</b>
                            <div className="sj-chips" style={{ marginTop: 6 }}>{byGrade(g).map((a) => <span className="sj-tag" key={a.id} title={a.teacher_code}>{a.class_name} · {a.teacher_name}</span>)}</div></div>))}

                    <h4 className="sj-sec">Chương trình & hệ số điểm</h4>
                    <div className="sj-tablewrap"><table className="sj-table" style={{ minWidth: 420 }}>
                        <thead><tr><th>Khối</th><th>Tiết/tuần</th><th>Tiết/năm</th><th>Cột TX</th><th>Hệ số TX-GK-CK</th></tr></thead>
                        <tbody>{s.curriculum.map((c) => <tr key={c.grade}><td><b>{c.grade}</b></td><td>{c.periods_per_week}</td><td>{c.periods_total}</td><td>{c.tx_count}</td><td>{c.w_tx} - {c.w_gk} - {c.w_ck}</td></tr>)}</tbody></table></div>

                    {s.stats.length > 0 && (<><h4 className="sj-sec">Điểm trung bình môn</h4>
                        <div className="sj-chips">{s.stats.map((x) => <span key={x.semester} className="sj-tag">HK{x.semester}: {x.avg} <small>({x.n} HS)</small></span>)}</div></>)}
                </div>
            )}
        </Modal>
    );
}