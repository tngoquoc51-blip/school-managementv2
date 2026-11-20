'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import s from './lessonplan.module.css';
import { lessonPlans, errMsg, type Item, type ItemBody } from '@/services/teacherLessonPlan';
import { Icon, SECTION_KEYS, SECTION_LABEL, filled, useToast } from './ui';

interface Props { planId: number; item: Item | null; canEdit: boolean; onSaved: (item: Item) => void; onClose: () => void }

interface Form {
    title: string; week_no: string; periods: string; planned_date: string;
    objectives_knowledge: string; objectives_competence: string; objectives_quality: string; equipment: string;
    act_start: string; act_learn: string; act_practice: string; act_apply: string; assessment: string; notes: string;
}
const EMPTY: Form = {
    title: '', week_no: '1', periods: '1', planned_date: '', objectives_knowledge: '', objectives_competence: '', objectives_quality: '',
    equipment: '', act_start: '', act_learn: '', act_practice: '', act_apply: '', assessment: '', notes: '',
};
const fromItem = (i: Item): Form => ({
    title: i.title, week_no: String(i.week_no), periods: String(i.periods), planned_date: i.planned_date ?? '',
    objectives_knowledge: i.objectives_knowledge ?? '', objectives_competence: i.objectives_competence ?? '', objectives_quality: i.objectives_quality ?? '',
    equipment: i.equipment ?? '', act_start: i.act_start ?? '', act_learn: i.act_learn ?? '', act_practice: i.act_practice ?? '',
    act_apply: i.act_apply ?? '', assessment: i.assessment ?? '', notes: i.notes ?? '',
});
const HINT = 'a) Mục tiêu  b) Nội dung  c) Sản phẩm  d) Tổ chức thực hiện';

export default function LessonEditor({ planId, item, canEdit, onSaved, onClose }: Props) {
    const toast = useToast();
    const closeRef = useRef<HTMLButtonElement>(null);
    const initial = useMemo(() => (item ? fromItem(item) : EMPTY), [item]);
    const [f, setF] = useState<Form>(initial);
    const [saving, setSaving] = useState(false);
    const dirty = JSON.stringify(f) !== JSON.stringify(initial);

    useEffect(() => { closeRef.current?.focus(); }, []);
    const tryClose = () => { if (dirty && canEdit && !window.confirm('Bài học có thay đổi chưa lưu. Đóng và bỏ thay đổi?')) return; onClose(); };
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') tryClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    });

    const set = <K extends keyof Form>(k: K, v: string) => setF((x) => ({ ...x, [k]: v }));
    const done = filled({ ...f } as unknown as Partial<Item>);

    const save = async () => {
        if (!f.title.trim()) { toast.push('error', 'Chưa có tên bài học', 'Hãy nhập tên bài học.'); return; }
        const body: ItemBody = {
            title: f.title.trim(), week_no: Math.min(40, Math.max(1, Number(f.week_no) || 1)), periods: Math.min(6, Math.max(1, Number(f.periods) || 1)),
            planned_date: f.planned_date || null, objectives_knowledge: f.objectives_knowledge, objectives_competence: f.objectives_competence,
            objectives_quality: f.objectives_quality, equipment: f.equipment, act_start: f.act_start, act_learn: f.act_learn,
            act_practice: f.act_practice, act_apply: f.act_apply, assessment: f.assessment, notes: f.notes,
        };
        setSaving(true);
        try {
            const r = item ? await lessonPlans.updateItem(item.id, body) : await lessonPlans.addItem(planId, body);
            toast.push('success', item ? 'Đã lưu bài học' : 'Đã thêm bài học', f.title.trim());
            onSaved(r.data as Item);
        } catch (e) { toast.push('error', 'Chưa lưu được', errMsg(e)); } finally { setSaving(false); }
    };

    const area = (k: keyof Form, rows: number, placeholder?: string) => (
        <textarea className={s.ruled} rows={rows} value={f[k]} disabled={!canEdit} placeholder={canEdit ? placeholder : ''} maxLength={8000} onChange={(e) => set(k, e.target.value)} />
    );

    return (
        <div className={`${s.scrim} ${s.scrimWide}`} onClick={tryClose}>
            <aside className={s.drawer} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Soạn bài học">
                <header className={s.dHead}>
                    <div>
                        <p className={s.eyebrow}>{item ? `Bài ${item.position}` : 'Bài học mới'}</p>
                        <h2 className={s.dTitle}>{f.title.trim() || 'Chưa đặt tên bài học'}</h2>
                    </div>
                    <div className={s.dActs}>
                        {canEdit && <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={save} disabled={saving || !dirty}>{saving ? 'Đang lưu…' : dirty ? 'Lưu bài học' : 'Đã lưu'}</button>}
                        <button ref={closeRef} type="button" className={s.btn} onClick={tryClose}>Đóng</button>
                    </div>
                </header>

                <div className={s.dBody}>
                    <nav className={s.checklist} aria-label="Mức độ hoàn thiện">
                        <b>Hoàn thiện {done.length}/{SECTION_KEYS.length}</b>
                        <div className={s.meter}><i style={{ width: `${(done.length / SECTION_KEYS.length) * 100}%` }} /></div>
                        <ul>{SECTION_KEYS.map((k) => <li key={k} className={done.includes(k) ? s.ckOn : ''}><Icon name={done.includes(k) ? 'check' : 'plus'} size={13} />{SECTION_LABEL[k]}</li>)}</ul>
                        <p className={s.muted}>Khi nộp duyệt, bài cần có Mục tiêu về kiến thức và Hoạt động hình thành kiến thức.</p>
                    </nav>

                    <div className={s.formCol}>
                        <label className={s.field}><span>Tên bài học</span><input value={f.title} maxLength={200} disabled={!canEdit} onChange={(e) => set('title', e.target.value)} placeholder="Ví dụ: Bài 1: Mệnh đề" /></label>
                        <div className={s.row3}>
                            <label className={s.field}><span>Tuần</span><input type="number" min={1} max={40} value={f.week_no} disabled={!canEdit} onChange={(e) => set('week_no', e.target.value)} /></label>
                            <label className={s.field}><span>Số tiết</span><input type="number" min={1} max={6} value={f.periods} disabled={!canEdit} onChange={(e) => set('periods', e.target.value)} /></label>
                            <label className={s.field}><span>Ngày dạy dự kiến</span><input type="date" value={f.planned_date} disabled={!canEdit} onChange={(e) => set('planned_date', e.target.value)} /></label>
                        </div>

                        <section className={s.sec}><h3>I. Mục tiêu</h3>
                            <label className={s.field}><span>1. Về kiến thức</span>{area('objectives_knowledge', 3, 'Học sinh nêu được, trình bày được, vận dụng được…')}</label>
                            <label className={s.field}><span>2. Về năng lực</span>{area('objectives_competence', 3, 'Năng lực chung (tự chủ và tự học, giao tiếp và hợp tác, giải quyết vấn đề) và năng lực đặc thù môn học')}</label>
                            <label className={s.field}><span>3. Về phẩm chất</span>{area('objectives_quality', 2, 'Chăm chỉ, trung thực, trách nhiệm…')}</label>
                        </section>
                        <section className={s.sec}><h3>II. Thiết bị dạy học và học liệu</h3>
                            <label className={s.field}><span className={s.srOnly}>Thiết bị dạy học và học liệu</span>{area('equipment', 3, 'Giáo viên: …  Học sinh: …')}</label>
                        </section>
                        <section className={s.sec}><h3>III. Tiến trình dạy học</h3>
                            <label className={s.field}><span>1. Hoạt động khởi động</span>{area('act_start', 4, HINT)}</label>
                            <label className={s.field}><span>2. Hoạt động hình thành kiến thức mới</span>{area('act_learn', 6, HINT)}</label>
                            <label className={s.field}><span>3. Hoạt động luyện tập</span>{area('act_practice', 4, HINT)}</label>
                            <label className={s.field}><span>4. Hoạt động vận dụng</span>{area('act_apply', 4, HINT)}</label>
                        </section>
                        <section className={s.sec}><h3>IV. Kiểm tra, đánh giá</h3>
                            <label className={s.field}><span className={s.srOnly}>Kiểm tra, đánh giá</span>{area('assessment', 3, 'Hình thức và công cụ đánh giá, tiêu chí đạt yêu cầu')}</label>
                            <label className={s.field}><span>Ghi chú của giáo viên</span>{area('notes', 2, 'Điều chỉnh sau tiết dạy, rút kinh nghiệm…')}</label>
                        </section>
                    </div>
                </div>
            </aside>
        </div>
    );
}