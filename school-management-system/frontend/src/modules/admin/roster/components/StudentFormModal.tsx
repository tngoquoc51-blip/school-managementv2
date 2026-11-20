'use client';

import { useEffect, useState } from 'react';
import cat from '@/modules/admin/categories/categories.module.css';
import { getErrorMessage, getFieldErrors } from '@/modules/admin/categories/catalogApi';
import { useFeedback } from '@/modules/admin/categories/components/Feedback';
import Icon from '@/modules/admin/categories/components/Icon';
import { Modal } from '@/modules/admin/categories/components/ui';
import s from '../roster.module.css';
import { PII_FIELDS, PROFILE_FIELDS } from '../constants';
import { rosterApi } from '../rosterApi';
import type { ClassRow, StudentDetail } from '../types';

interface Props {
    open: boolean;
    yearId: number;
    classes: ClassRow[];
    editing: StudentDetail | null; // null = thêm mới
    onClose: () => void;
    onSaved: (created?: { code: string; username: string | null; password: string | null }) => void;
}

const thisYear = new Date().getFullYear();

export default function StudentFormModal({ open, yearId, classes, editing, onClose, onSaved }: Props) {
    const fb = useFeedback();
    const [f, setF] = useState<Record<string, string>>({});
    const [pii, setPii] = useState<Record<string, string>>({});
    const [classId, setClassId] = useState('');
    const [createAccount, setCreateAccount] = useState(true);
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        setErrors({}); setPii({}); setBusy(false); setClassId(''); setCreateAccount(true);
        if (editing) {
            const st = editing.student;
            const base: Record<string, string> = { full_name: st.full_name, gender: st.gender, birth_date: st.birth_date.slice(0, 10), admission_year: String(st.admission_year) };
            PROFILE_FIELDS.forEach((p) => { base[p.key] = String(editing.profile[p.key] ?? ''); });
            setF(base);
        } else {
            setF({ full_name: '', gender: 'Nam', birth_date: '', admission_year: String(thisYear), code: '' });
        }
    }, [open, editing]);

    const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
    const err = (k: string) => errors[k]?.[0];

    const field = (k: string, label: string, opts: { type?: string; required?: boolean; wide?: boolean; hint?: string; placeholder?: string } = {}) => (
        <div key={k} className={`${cat.field} ${opts.wide ? cat.fieldWide : ''} ${err(k) ? cat.fieldError : ''}`}>
            <label htmlFor={`sf-${k}`}>{label}{opts.required && <em>*</em>}</label>
            <input id={`sf-${k}`} type={opts.type ?? 'text'} value={f[k] ?? ''} placeholder={opts.placeholder} onChange={(e) => set(k, e.target.value)} autoComplete="off" />
            {err(k) ? <small className={cat.fieldMsg}>{err(k)}</small> : opts.hint ? <small className={cat.fieldHint}>{opts.hint}</small> : null}
        </div>
    );

    const submit = async () => {
        setBusy(true);
        setErrors({});
        try {
            if (editing) {
                const profile: Record<string, string | number | null> = {};
                PROFILE_FIELDS.forEach((p) => {
                    const v = f[p.key] ?? '';
                    profile[p.key] = ['height_cm', 'weight_kg'].includes(p.key) ? (v === '' ? null : Number(v)) : v;
                });
                const piiBody = Object.fromEntries(Object.entries(pii).filter(([, v]) => v.trim() !== ''));
                await rosterApi.updateStudent(editing.student.id, {
                    full_name: f.full_name, gender: f.gender, birth_date: f.birth_date, admission_year: Number(f.admission_year), profile, pii: piiBody,
                });
                fb.success('Đã lưu hồ sơ', f.full_name);
                onSaved();
            } else {
                const res = await rosterApi.createStudent({
                    full_name: f.full_name, gender: f.gender, birth_date: f.birth_date, admission_year: Number(f.admission_year),
                    code: f.code || undefined, class_id: classId ? Number(classId) : null, school_year_id: yearId, create_account: createAccount,
                });
                fb.success('Đã thêm học sinh', `${f.full_name} · ${res.code}`);
                onSaved({ code: res.code, username: res.username, password: res.temporary_password });
            }
        } catch (e) {
            setErrors(getFieldErrors(e));
            fb.error('Chưa lưu được', getErrorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal open={open} wide title={editing ? `Sửa hồ sơ — ${editing.student.full_name}` : 'Thêm học sinh mới'} onClose={onClose}>
            <div className={cat.formGrid}>
                <div className={s.formSection}>Thông tin cơ bản</div>
                {field('full_name', 'Họ và tên', { required: true, wide: true })}
                <div className={cat.field}>
                    <label htmlFor="sf-gender">Giới tính<em>*</em></label>
                    <select id="sf-gender" value={f.gender ?? 'Nam'} onChange={(e) => set('gender', e.target.value)}><option>Nam</option><option>Nữ</option></select>
                </div>
                {field('birth_date', 'Ngày sinh', { type: 'date', required: true })}
                {field('admission_year', 'Năm nhập học', { type: 'number', required: true })}
                {!editing && field('code', 'Mã học sinh', { hint: 'Để trống để hệ thống tự cấp (HS + 2 số năm + số thứ tự)' })}

                {!editing && (
                    <>
                        <div className={s.formSection}>Xếp lớp & tài khoản</div>
                        <div className={cat.field}>
                            <label htmlFor="sf-class">Xếp vào lớp (năm học đang chọn)</label>
                            <select id="sf-class" value={classId} onChange={(e) => setClassId(e.target.value)}>
                                <option value="">Chưa xếp lớp</option>
                                {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.students}/{c.capacity})</option>)}
                            </select>
                        </div>
                        <label className={cat.switchRow} style={{ alignSelf: 'end', fontWeight: 800 }}>
                            <input type="checkbox" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} /> Tạo tài khoản đăng nhập
                        </label>
                    </>
                )}

                {editing && (
                    <>
                        <div className={s.formSection}>Hồ sơ cá nhân & gia đình</div>
                        {PROFILE_FIELDS.map((p) => field(p.key, p.label, { type: ['height_cm', 'weight_kg'].includes(p.key) ? 'number' : 'text' }))}
                        <div className={s.formSection}>Thông tin liên hệ (được mã hóa)</div>
                        {PII_FIELDS.map((p) => (
                            <div key={p.key} className={`${cat.field} ${p.wide ? cat.fieldWide : ''}`}>
                                <label htmlFor={`pii-${p.key}`}>{p.label}</label>
                                <input id={`pii-${p.key}`} value={pii[p.key] ?? ''} placeholder="Để trống nếu không thay đổi" onChange={(e) => setPii((x) => ({ ...x, [p.key]: e.target.value }))} autoComplete="off" />
                            </div>
                        ))}
                    </>
                )}
            </div>
            <div className={cat.dialogActions}>
                <button className={cat.btnGhost} onClick={onClose}>Hủy</button>
                <button className={cat.btnPrimary} onClick={submit} disabled={busy || !f.full_name || !f.birth_date}>
                    {busy ? <span className={cat.spinner} /> : <Icon name="check" size={16} />} {editing ? 'Lưu hồ sơ' : 'Thêm học sinh'}
                </button>
            </div>
        </Modal>
    );
}