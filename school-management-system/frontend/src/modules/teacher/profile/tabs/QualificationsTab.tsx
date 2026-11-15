'use client';

import { useState } from 'react';
import { apiError, profileApi } from '@/services/teacherProfileService';
import { useToast } from '@/components/Toast';
import { Empty, ErrorBox, Field, Icon, Modal, Skeleton, Spin, fmtDate, useFetch } from '../ui';
import type { QualType, Qualification } from '../types';
import s from '../profile.module.css';

const TYPES: Record<QualType, { label: string; icon: string; bg: string; fg: string }> = {
    degree: { label: 'Bằng cấp', icon: 'award', bg: '#e0f4fa', fg: '#0891b2' }, certificate: { label: 'Chứng chỉ', icon: 'check', bg: '#dcfce7', fg: '#16a34a' },
    training: { label: 'Bồi dưỡng', icon: 'book', bg: '#fef3c7', fg: '#d97706' }, award: { label: 'Khen thưởng', icon: 'award', bg: '#ffe4e6', fg: '#e11d48' },
};
const blank = { type: 'certificate' as QualType, title: '', organization: '', issued_year: '', expires_at: '', note: '' };

function expiry(d: string | null) {
    if (!d) return null;
    const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
    if (days < 0) return <span className={`${s.badge} ${s.bBad}`}>Đã hết hạn</span>;
    if (days <= 90) return <span className={`${s.badge} ${s.bWarn}`}>Còn {days} ngày</span>;
    return <span className={`${s.badge} ${s.bOk}`}>Hạn {fmtDate(d)}</span>;
}

export default function QualificationsTab({ onChanged }: { onChanged: () => void }) {
    const toast = useToast();
    const { data, loading, error, reload } = useFetch(() => profileApi.qualifications());
    const [filter, setFilter] = useState<QualType | 'all'>('all');
    const [edit, setEdit] = useState<(typeof blank & { id?: number }) | null>(null);
    const [del, setDel] = useState<Qualification | null>(null);
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    async function submit() {
        if (!edit) return; setBusy(true); setErrs({});
        try {
            await profileApi.saveQualification({ ...edit, issued_year: edit.issued_year ? Number(edit.issued_year) : null, expires_at: edit.expires_at || null } as any, edit.id);
            toast.success(edit.id ? 'Đã cập nhật' : 'Đã thêm mới', edit.title); setEdit(null); await reload(); onChanged();
        } catch (e) { const r = apiError(e); setErrs(r.fields); toast.error('Không thể lưu', r.message); } finally { setBusy(false); }
    }
    async function remove() {
        if (!del) return; setBusy(true);
        try { await profileApi.deleteQualification(del.id); toast.success('Đã xóa', del.title); setDel(null); await reload(); onChanged(); }
        catch (e) { toast.error('Không thể xóa', apiError(e).message); } finally { setBusy(false); }
    }

    if (loading) return <Skeleton h={110} n={3} />;
    if (error || !data) return <ErrorBox message={error || 'Lỗi'} onRetry={reload} />;
    const list = data.filter((x) => filter === 'all' || x.type === filter);

    return (
        <div className={s.panel}>
            <section className={s.card}>
                <div className={s.cardHead}>
                    <div><h3 className={s.cardTitle}><Icon n="award" /> Bằng cấp, chứng chỉ & khen thưởng</h3><div className={s.cardSub}>{data.length} mục</div></div>
                    <button className={`${s.btn} ${s.btnP}`} onClick={() => setEdit({ ...blank })}><Icon n="plus" size={16} /> Thêm mới</button>
                </div>
                <div className={s.filters} style={{ marginBottom: 16 }}>
                    <button className={`${s.pill} ${filter === 'all' ? s.pillOn : ''}`} onClick={() => setFilter('all')}>Tất cả</button>
                    {(Object.keys(TYPES) as QualType[]).map((k) => <button key={k} className={`${s.pill} ${filter === k ? s.pillOn : ''}`} onClick={() => setFilter(k)}>{TYPES[k].label} ({data.filter((x) => x.type === k).length})</button>)}
                </div>
                {list.length === 0 ? <Empty icon="🎓" text="Chưa có mục nào. Hãy thêm bằng cấp, chứng chỉ để hoàn thiện hồ sơ." /> : (
                    <div className={s.g2}>{list.map((q) => { const t = TYPES[q.type]; return (
                        <div key={q.id} className={s.item}>
                            <div className={s.itemIco} style={{ background: t.bg, color: t.fg }}><Icon n={t.icon} /></div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b>{q.title}</b>{expiry(q.expires_at)}</div>
                                <div className={s.cardSub}>{t.label}{q.organization ? ` • ${q.organization}` : ''}{q.issued_year ? ` • ${q.issued_year}` : ''}</div>
                                {q.note && <div className={s.cardSub} style={{ marginTop: 4 }}>{q.note}</div>}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button className={`${s.btn} ${s.btnS}`} aria-label="Sửa" onClick={() => setEdit({ id: q.id, type: q.type, title: q.title, organization: q.organization || '', issued_year: String(q.issued_year ?? ''), expires_at: q.expires_at || '', note: q.note || '' })}><Icon n="edit" size={14} /></button>
                                <button className={`${s.btn} ${s.btnS} ${s.btnD}`} aria-label="Xóa" onClick={() => setDel(q)}><Icon n="trash" size={14} /></button>
                            </div>
                        </div>); })}</div>)}
            </section>

            {edit && (
                <Modal title={edit.id ? 'Sửa mục' : 'Thêm bằng cấp / chứng chỉ'} onClose={() => setEdit(null)}>
                    <Field label="Loại" required><select className={s.select} value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as QualType })}>{(Object.keys(TYPES) as QualType[]).map((k) => <option key={k} value={k}>{TYPES[k].label}</option>)}</select></Field>
                    <Field label="Tên" required error={errs.title}><input className={`${s.input} ${errs.title ? s.invalid : ''}`} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="VD: Cử nhân Sư phạm Toán" autoFocus /></Field>
                    <Field label="Đơn vị cấp" error={errs.organization}><input className={s.input} value={edit.organization} onChange={(e) => setEdit({ ...edit, organization: e.target.value })} placeholder="VD: ĐH Sư phạm Hà Nội" /></Field>
                    <div className={s.row2}>
                        <Field label="Năm cấp" error={errs.issued_year}><input className={s.input} inputMode="numeric" value={edit.issued_year} onChange={(e) => setEdit({ ...edit, issued_year: e.target.value })} placeholder="2020" /></Field>
                        <Field label="Ngày hết hạn" error={errs.expires_at}><input type="date" className={s.input} value={edit.expires_at} onChange={(e) => setEdit({ ...edit, expires_at: e.target.value })} /></Field>
                    </div>
                    <Field label="Ghi chú" error={errs.note}><input className={s.input} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
                    <div className={s.modalFoot}><button className={s.btn} onClick={() => setEdit(null)}>Hủy</button><button className={`${s.btn} ${s.btnP}`} disabled={busy || !edit.title.trim()} onClick={submit}>{busy && <Spin />} Lưu</button></div>
                </Modal>)}
            {del && (
                <Modal title="Xóa mục này?" onClose={() => setDel(null)}>
                    <p>Bạn chắc chắn muốn xóa <b>{del.title}</b>? Hành động này không thể hoàn tác.</p>
                    <div className={s.modalFoot}><button className={s.btn} onClick={() => setDel(null)}>Hủy</button><button className={`${s.btn} ${s.btnD}`} disabled={busy} onClick={remove}>{busy && <Spin />} Xóa</button></div>
                </Modal>)}
        </div>
    );
}