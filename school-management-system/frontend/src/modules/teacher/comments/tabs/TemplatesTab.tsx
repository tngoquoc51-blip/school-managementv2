'use client';

import { useState } from 'react';
import { apiError, cmtApi } from '@/services/teacherCommentService';
import { useToast } from '@/components/Toast';
import { Empty, ErrorBox, Field, Icon, Modal, RATING, Skeleton, Spin, useFetch } from '../ui';
import type { Template } from '../types';
import s from '../comments.module.css';

const blank = { rating: 'any', title: '', body: '' };

export default function TemplatesTab() {
    const toast = useToast();
    const [rating, setRating] = useState('');
    const { data, loading, error, reload } = useFetch(() => cmtApi.templates(rating), [rating]);
    const [edit, setEdit] = useState<(typeof blank & { id?: number }) | null>(null);
    const [del, setDel] = useState<Template | null>(null);
    const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);

    async function submit() {
        if (!edit) return; setBusy(true); setErrs({});
        try { await cmtApi.saveTemplate({ rating: edit.rating, title: edit.title, body: edit.body }, edit.id); toast.success(edit.id ? 'Đã cập nhật mẫu' : 'Đã thêm mẫu', edit.title); setEdit(null); await reload(); }
        catch (e) { const r = apiError(e); setErrs(r.fields); toast.error('Không lưu được', r.message); } finally { setBusy(false); }
    }
    async function remove() {
        if (!del) return; setBusy(true);
        try { await cmtApi.deleteTemplate(del.id); toast.success('Đã xóa mẫu', del.title); setDel(null); await reload(); }
        catch (e) { toast.error('Không xóa được', apiError(e).message); } finally { setBusy(false); }
    }

    return (
        <div className={s.panel}>
            <section className={s.card}>
                <div className={s.cardHead}>
                    <div><h3 className={s.cardTitle}><Icon n="template" /> Mẫu nhận xét</h3><div className={s.cardSub}>Mẫu chung của trường và mẫu riêng của bạn – dùng nhanh khi soạn nhận xét</div></div>
                    <button className={`${s.btn} ${s.btnP}`} onClick={() => setEdit({ ...blank })}><Icon n="plus" size={16} /> Tạo mẫu mới</button>
                </div>
                <div className={s.filters} style={{ marginBottom: 14 }}>
                    <button className={`${s.pill} ${rating === '' ? s.pillOn : ''}`} onClick={() => setRating('')}>Tất cả</button>
                    {Object.entries(RATING).map(([k, m]) => <button key={k} className={`${s.pill} ${rating === k ? s.pillOn : ''}`} onClick={() => setRating(k)}>{m.label}</button>)}
                </div>
                {error && !data ? <ErrorBox message={error} onRetry={reload} /> : !data ? <Skeleton h={90} n={3} /> : data.length === 0 ? <Empty icon="📄" text="Chưa có mẫu nào." /> : (
                    <div className={s.g2} style={{ opacity: loading ? 0.6 : 1 }}>{data.map((t) => (
                        <div key={t.id} className={s.item} style={{ flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
                                <b style={{ flex: 1 }}>{t.title}</b>
                                {t.rating !== 'any' && <span className={s.badge} style={{ background: RATING[t.rating].bg, color: RATING[t.rating].color }}>{RATING[t.rating].label}</span>}
                                <span className={`${s.badge} ${t.is_system ? s.bMute : s.bInfo}`}>{t.is_system ? 'Của trường' : 'Của tôi'}</span>
                            </div>
                            <div>{t.body}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <span className={s.cardSub}>Đã dùng {t.uses} lần</span>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {t.is_system ? <button className={`${s.btn} ${s.btnS}`} onClick={() => setEdit({ rating: t.rating, title: t.title, body: t.body })}><Icon n="copy" size={14} /> Dùng làm mẫu của tôi</button> : (<>
                                        <button className={`${s.btn} ${s.btnS}`} aria-label="Sửa" onClick={() => setEdit({ id: t.id, rating: t.rating, title: t.title, body: t.body })}><Icon n="edit" size={14} /></button>
                                        <button className={`${s.btn} ${s.btnS} ${s.btnD}`} aria-label="Xóa" onClick={() => setDel(t)}><Icon n="trash" size={14} /></button></>)}
                                </div>
                            </div>
                        </div>))}</div>)}
            </section>

            {edit && (
                <Modal title={edit.id ? 'Sửa mẫu nhận xét' : 'Tạo mẫu nhận xét'} onClose={() => setEdit(null)}>
                    <Field label="Áp dụng cho mức" required error={errs.rating}>
                        <select className={s.select} value={edit.rating} onChange={(e) => setEdit({ ...edit, rating: e.target.value })}><option value="any">Mọi mức</option>{Object.entries(RATING).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}</select></Field>
                    <Field label="Tên mẫu" required error={errs.title}><input className={`${s.input} ${errs.title ? s.invalid : ''}`} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} maxLength={80} autoFocus /></Field>
                    <Field label="Nội dung" required error={errs.body} hint={`${edit.body.length}/600 ký tự`}><textarea className={`${s.textarea} ${errs.body ? s.invalid : ''}`} value={edit.body} maxLength={600} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
                    <div className={s.modalFoot}><button className={s.btn} onClick={() => setEdit(null)}>Hủy</button><button className={`${s.btn} ${s.btnP}`} disabled={busy || edit.title.trim().length < 2 || edit.body.trim().length < 5} onClick={submit}>{busy && <Spin />} Lưu mẫu</button></div>
                </Modal>)}
            {del && (
                <Modal title="Xóa mẫu này?" onClose={() => setDel(null)}>
                    <p>Bạn chắc chắn muốn xóa mẫu <b>{del.title}</b>? Các nhận xét đã viết từ mẫu này không bị ảnh hưởng.</p>
                    <div className={s.modalFoot}><button className={s.btn} onClick={() => setDel(null)}>Hủy</button><button className={`${s.btn} ${s.btnD}`} disabled={busy} onClick={remove}>{busy && <Spin />} Xóa</button></div>
                </Modal>)}
        </div>
    );
}