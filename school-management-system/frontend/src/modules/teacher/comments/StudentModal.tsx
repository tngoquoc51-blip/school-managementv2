'use client';

import { cmtApi } from '@/services/teacherCommentService';
import { ErrorBox, Modal, Skeleton, TAGS, colorOf, fmtDate, fmtDateTime, fmtScore, initials, periodLabel, ratingBadge, scoreColor, useFetch } from './ui';
import s from './comments.module.css';

export default function StudentModal({ studentId, cs, onClose }: { studentId: number; cs: number; onClose: () => void }) {
    const { data, loading, error, reload } = useFetch(() => cmtApi.student(studentId, cs), [studentId, cs]);
    return (
        <Modal title="Hồ sơ học tập của học sinh" wide onClose={onClose}>
            {loading ? <Skeleton h={80} n={3} /> : error || !data ? <ErrorBox message={error || 'Lỗi'} onRetry={reload} /> : (<>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
                    <div className={s.avatarMini} style={{ width: 54, height: 54, fontSize: 18, background: colorOf(data.student.full_name) }}>{initials(data.student.full_name)}</div>
                    <div><b style={{ fontSize: 18 }}>{data.student.full_name}</b>
                        <div className={s.cardSub}>{data.student.code} · Lớp {data.assignment.class_name} · Môn {data.assignment.subject_name} · Sinh {fmtDate(data.student.birth_date)}</div></div>
                </div>
                <h4 style={{ margin: '0 0 8px' }}>Điểm môn {data.assignment.subject_name}</h4>
                {data.grades.length === 0 ? <div className={s.cardSub}>Chưa có điểm.</div> : (
                    <div className={s.scroll}><table className={s.table}>
                        <thead><tr><th>Học kỳ</th><th className={s.num}>TX1</th><th className={s.num}>TX2</th><th className={s.num}>TX3</th><th className={s.num}>TX4</th><th className={s.num}>GK</th><th className={s.num}>CK</th><th className={s.num}>TBM</th></tr></thead>
                        <tbody>{data.grades.map((g) => (
                            <tr key={g.semester}><td><b>HK{g.semester}</b></td>
                                {[g.tx1, g.tx2, g.tx3, g.tx4, g.gk, g.ck].map((v, i) => <td key={i} className={s.num}>{fmtScore(v)}</td>)}
                                <td className={s.num}><b style={{ color: scoreColor(g.tbm) }}>{fmtScore(g.tbm)}</b></td></tr>))}</tbody></table></div>)}
                <h4 style={{ margin: '18px 0 8px' }}>Nhận xét của bạn ({data.comments.length})</h4>
                {data.comments.length === 0 ? <div className={s.cardSub}>Bạn chưa viết nhận xét nào cho học sinh này.</div> : data.comments.map((c) => (
                    <div key={c.id} className={s.noteItem}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <b>HK{c.semester} · {periodLabel(c.kind, c.period)}</b>{ratingBadge(c.rating)}
                            <span className={`${s.badge} ${c.status === 'published' ? s.bOk : s.bMute}`}>{c.status === 'published' ? 'Đã công bố' : 'Bản nháp'}</span>
                        </div>
                        <div style={{ margin: '6px 0' }}>{c.content}</div>
                        {c.tags && <div className={s.cardSub}>{c.tags.split(',').map((t) => TAGS[t] || t).join(' · ')}</div>}
                        <div className={s.cardSub}>{fmtDateTime(c.updated_at)}</div>
                    </div>))}
            </>)}
        </Modal>
    );
}