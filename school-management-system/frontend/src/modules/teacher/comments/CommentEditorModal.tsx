'use client';

import { useState } from 'react';
import { apiError, cmtApi } from '@/services/teacherCommentService';
import { useToast } from '@/components/Toast';
import { Empty, Field, Icon, Modal, RATING, RatingPicker, Skeleton, Spin, TagPicker, periodLabel, useFetch } from './ui';
import type { Suggest } from './types';
import s from './comments.module.css';

export interface EditorTarget {
    student_id: number; student_name: string; student_code: string; class_label: string; class_subject_id: number;
    semester: number; kind: string; period: string; rating?: string; content?: string; tags?: string | null; status?: string; suggest?: Suggest | null;
}

export default function CommentEditorModal({ target, onClose, onSaved }: { target: EditorTarget; onClose: () => void; onSaved: () => void }) {
    const toast = useToast();
    const [rating, setRating] = useState(target.rating || target.suggest?.rating || '');
    const [content, setContent] = useState(target.content || '');
    const [tags, setTags] = useState<string[]>(target.tags ? target.tags.split(',') : []);
    const [showTpl, setShowTpl] = useState(false);
    const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
    const tpl = useFetch(() => (showTpl ? cmtApi.templates(rating) : Promise.resolve([])), [showTpl, rating]);

    async function save(status: 'draft' | 'published') {
        setBusy(true); setErr('');
        try {
            await cmtApi.save({ student_id: target.student_id, class_subject_id: target.class_subject_id, semester: target.semester, kind: target.kind, period: target.period, rating, content: content.trim(), tags, status });
            toast.success(status === 'published' ? 'Đã lưu và công bố nhận xét' : 'Đã lưu bản nháp', target.student_name);
            onSaved(); onClose();
        } catch (e) { setErr(apiError(e).message); } finally { setBusy(false); }
    }

    return (
        <Modal title={`Nhận xét – ${target.student_name}`} wide onClose={onClose}>
            <div className={s.cardSub} style={{ marginBottom: 12 }}>{target.student_code} · {target.class_label} · HK{target.semester} · {periodLabel(target.kind, target.period)}</div>
            <Field label="Mức đánh giá" required><RatingPicker value={rating} onChange={setRating} /></Field>
            <Field label="Đặc điểm nổi bật"><TagPicker value={tags} onChange={setTags} /></Field>
            <Field label="Nội dung nhận xét" required error={err} hint={`${content.length}/1000 ký tự`}>
                <textarea className={`${s.textarea} ${err ? s.invalid : ''}`} value={content} maxLength={1000} onChange={(e) => setContent(e.target.value)} placeholder="Viết nhận xét về kết quả, thái độ học tập và hướng cố gắng của học sinh…" autoFocus />
            </Field>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {target.suggest?.text && <button className={`${s.btn} ${s.btnS}`} onClick={() => { setContent(target.suggest!.text!); if (!rating && target.suggest!.rating) setRating(target.suggest!.rating); }}><Icon n="wand" size={14} /> Dùng gợi ý theo điểm</button>}
                <button className={`${s.btn} ${s.btnS}`} onClick={() => setShowTpl(!showTpl)}><Icon n="template" size={14} /> {showTpl ? 'Ẩn mẫu' : 'Chọn từ mẫu'}</button>
            </div>
            {showTpl && (
                <div style={{ maxHeight: 220, overflow: 'auto', marginBottom: 10 }}>
                    {tpl.loading ? <Skeleton h={50} n={2} /> : !tpl.data?.length ? <Empty text="Chưa có mẫu phù hợp." /> : tpl.data.map((t) => (
                        <div key={t.id} className={s.tplItem} onClick={() => { setContent(t.body); if (!rating && t.rating !== 'any') setRating(t.rating); cmtApi.useTemplate(t.id); setShowTpl(false); }}>
                            <b>{t.title} {t.rating !== 'any' && <span className={s.badge} style={{ background: RATING[t.rating].bg, color: RATING[t.rating].color }}>{RATING[t.rating].label}</span>}</b>
                            <span className={s.cardSub}>{t.body}</span></div>))}
                </div>)}
            <div className={s.modalFoot}>
                <button className={s.btn} onClick={onClose}>Hủy</button>
                <button className={s.btn} disabled={busy || !rating || content.trim().length < 3} onClick={() => save('draft')}>{busy && <Spin />} Lưu nháp</button>
                <button className={`${s.btn} ${s.btnP}`} disabled={busy || !rating || content.trim().length < 3} onClick={() => save('published')}><Icon n="send" size={15} /> Lưu & công bố</button>
            </div>
        </Modal>
    );
}