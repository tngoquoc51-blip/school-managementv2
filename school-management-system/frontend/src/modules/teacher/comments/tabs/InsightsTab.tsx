'use client';

import { useState } from 'react';
import { cmtApi } from '@/services/teacherCommentService';
import StudentModal from '../StudentModal';
import CommentEditorModal, { EditorTarget } from '../CommentEditorModal';
import { Empty, ErrorBox, Icon, Skeleton, colorOf, fmtScore, initials, ratingBadge, scoreColor, useFetch } from '../ui';
import type { Filters, InsightRow } from '../types';
import s from '../comments.module.css';

const REASON: Record<string, [string, string]> = { low: ['Điểm dưới 5', s.bBad], down: ['Điểm đang giảm', s.bWarn], no_comment: ['Chưa nhận xét', s.bInfo] };

export default function InsightsTab({ f, onChanged }: { f: Filters; onChanged: () => void }) {
    const [all, setAll] = useState(false);
    const key = JSON.stringify(f);
    const { data, loading, error, reload } = useFetch(() => cmtApi.insights(f, all), [key, all]);
    const [edit, setEdit] = useState<EditorTarget | null>(null);
    const [detail, setDetail] = useState<InsightRow | null>(null);

    const open = (r: InsightRow) => setEdit({
        student_id: r.student.id, student_name: r.student.full_name, student_code: r.student.code, class_label: `Lớp ${r.assignment.class_name} · ${r.assignment.subject_name}`,
        class_subject_id: r.assignment.id, semester: f.semester, kind: f.kind, period: f.period, rating: r.comment?.rating, content: r.comment?.content, tags: r.comment?.tags, suggest: r.suggest,
    });

    return (
        <div className={s.panel}>
            <section className={s.card}>
                <div className={s.cardHead}>
                    <div><h3 className={s.cardTitle}><Icon n="alert" /> Học sinh cần quan tâm</h3><div className={s.cardSub}>Điểm trung bình môn dưới 5 hoặc điểm đang giảm so với trước – nên có nhận xét kịp thời để phụ huynh phối hợp</div></div>
                    <div className={s.filters}>
                        <button className={`${s.pill} ${!all ? s.pillOn : ''}`} onClick={() => setAll(false)}>Lớp – môn đang chọn</button>
                        <button className={`${s.pill} ${all ? s.pillOn : ''}`} onClick={() => setAll(true)}>Tất cả lớp tôi dạy</button>
                    </div>
                </div>
                {error && !data ? <ErrorBox message={error} onRetry={reload} /> : !data ? <Skeleton h={90} n={3} /> : data.length === 0 ? <Empty icon="🎉" text="Không có học sinh nào cần đặc biệt quan tâm. Cả lớp đang học ổn định." /> : (
                    <div className={s.stack} style={{ opacity: loading ? 0.6 : 1 }}>{data.map((r) => (
                        <div key={`${r.assignment.id}-${r.student.id}`} className={s.item} style={{ alignItems: 'center' }}>
                            <div className={s.avatarMini} style={{ background: colorOf(r.student.full_name) }}>{initials(r.student.full_name)}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <b className={s.stName} onClick={() => setDetail(r)}>{r.student.full_name}</b>
                                    {r.reasons.map((x) => <span key={x} className={`${s.badge} ${REASON[x][1]}`}>{REASON[x][0]}</span>)}
                                </div>
                                <div className={s.cardSub}>{r.student.code} · Lớp {r.assignment.class_name} · {r.assignment.subject_name} · TBM <b style={{ color: scoreColor(r.score) }}>{fmtScore(r.score)}</b> · GK {fmtScore(r.scores.gk)} · CK {fmtScore(r.scores.ck)}</div>
                                {r.comment && <div className={`${s.clamp}`} style={{ marginTop: 6 }}>{ratingBadge(r.comment.rating)} {r.comment.content}</div>}
                            </div>
                            <button className={`${s.btn} ${s.btnS} ${r.comment ? '' : s.btnP}`} onClick={() => open(r)}><Icon n="pen" size={14} /> {r.comment ? 'Sửa nhận xét' : 'Soạn nhận xét'}</button>
                        </div>))}</div>)}
            </section>
            {edit && <CommentEditorModal target={edit} onClose={() => setEdit(null)} onSaved={() => { reload(); onChanged(); }} />}
            {detail && <StudentModal studentId={detail.student.id} cs={detail.assignment.id} onClose={() => setDetail(null)} />}
        </div>
    );
}