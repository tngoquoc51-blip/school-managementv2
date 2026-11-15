'use client';

import { useMemo, useState } from 'react';
import { apiError, profileApi } from '@/services/teacherProfileService';
import { useToast } from '@/components/Toast';
import { Field, Icon, Spin, GENDER } from '../ui';
import type { Overview, TabKey } from '../types';
import s from '../profile.module.css';

interface Props { ov: Overview; reload: () => Promise<void> | void; go: (t: TabKey, prefill?: string) => void }
const KEYS = ['phone', 'gender', 'birth_date', 'id_number', 'address', 'job_title', 'department', 'joined_at', 'bio', 'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation'] as const;

export default function PersonalTab({ ov, reload, go }: Props) {
    const toast = useToast();
    const initial = useMemo(() => {
        const p: any = ov.profile || {};
        return Object.fromEntries(KEYS.map((k) => [k, (k === 'phone' ? ov.user.phone : p[k]) ?? ''])) as Record<string, string>;
    }, [ov]);
    const [f, setF] = useState(initial);
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const dirty = JSON.stringify(f) !== JSON.stringify(initial);
    const set = (k: string, v: string) => { setF((x) => ({ ...x, [k]: v })); if (errs[k]) setErrs((e) => ({ ...e, [k]: '' })); };
    const bind = (k: string) => ({ value: f[k] ?? '', onChange: (e: any) => set(k, e.target.value), className: `${s.input} ${errs[k] ? s.invalid : ''}` });

    async function save() {
        setSaving(true); setErrs({});
        try {
            await profileApi.updateInfo(f);
            toast.success('Đã lưu hồ sơ', 'Thông tin cá nhân của bạn đã được cập nhật.');
            await reload();
        } catch (e) {
            const { message, fields } = apiError(e); setErrs(fields);
            toast.error('Không thể lưu', message);
        } finally { setSaving(false); }
    }

    const Locked = ({ label, value, field }: { label: string; value?: string | null; field: string }) => (
        <Field label={label} hint="Thông tin định danh – cần BGH/giáo vụ duyệt khi thay đổi">
            <div className={s.lock}><input className={s.input} readOnly value={value || '—'} />
                <button type="button" className={`${s.btn} ${s.btnS}`} onClick={() => go('requests', field)}><Icon n="lock" size={14} /> Yêu cầu sửa</button></div>
        </Field>
    );

    return (
        <div className={s.panel}>
            <div className={s.g2}>
                <div className={s.stack}>
                    <section className={s.card}>
                        <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="user" /> Thông tin định danh</h3><div className={s.cardSub}>Do nhà trường quản lý</div></div></div>
                        <Locked label="Họ và tên" value={ov.teacher?.full_name || ov.user.name} field="full_name" />
                        <div className={s.row2}>
                            <Locked label="Mã giáo viên" value={ov.teacher?.code} field="employee_code" />
                            <Field label="Môn chính"><input className={s.input} readOnly value={ov.teacher?.subject_name || '—'} /></Field>
                        </div>
                        <Field label="Tên đăng nhập"><input className={s.input} readOnly value={ov.user.username || '—'} /></Field>
                    </section>

                    <section className={s.card}>
                        <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="phone" /> Liên hệ & cá nhân</h3></div></div>
                        <div className={s.row2}>
                            <Field label="Số điện thoại" error={errs.phone}><input {...bind('phone')} placeholder="0912345678" inputMode="tel" /></Field>
                            <Field label="Giới tính" error={errs.gender}>
                                <select {...bind('gender')} className={s.select}><option value="">— Chọn —</option>{Object.entries(GENDER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                            </Field>
                            <Field label="Ngày sinh" error={errs.birth_date}><input type="date" {...bind('birth_date')} /></Field>
                            <Field label="Số CCCD" error={errs.id_number}><input {...bind('id_number')} placeholder="12 chữ số" inputMode="numeric" /></Field>
                        </div>
                        <Field label="Địa chỉ thường trú" error={errs.address}><input {...bind('address')} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" /></Field>
                    </section>
                </div>

                <div className={s.stack}>
                    <section className={s.card}>
                        <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="book" /> Công tác</h3></div></div>
                        <div className={s.row2}>
                            <Field label="Chức vụ" error={errs.job_title}><input {...bind('job_title')} placeholder="VD: Giáo viên, Tổ trưởng" /></Field>
                            <Field label="Tổ chuyên môn" error={errs.department}><input {...bind('department')} placeholder="VD: Tổ Toán – Tin" /></Field>
                        </div>
                        <Field label="Ngày vào trường" error={errs.joined_at}><input type="date" {...bind('joined_at')} /></Field>
                        <Field label="Giới thiệu bản thân" error={errs.bio} hint={`${(f.bio || '').length}/2000 ký tự`}>
                            <textarea {...bind('bio')} className={`${s.textarea} ${errs.bio ? s.invalid : ''}`} maxLength={2000} placeholder="Kinh nghiệm, phương pháp giảng dạy, thành tích nổi bật…" />
                        </Field>
                    </section>

                    <section className={s.card}>
                        <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="users" /> Liên hệ khẩn cấp</h3><div className={s.cardSub}>Dùng khi nhà trường cần liên lạc gấp</div></div></div>
                        <div className={s.row2}>
                            <Field label="Họ tên người liên hệ" error={errs.emergency_contact_name}><input {...bind('emergency_contact_name')} /></Field>
                            <Field label="Quan hệ" error={errs.emergency_contact_relation}><input {...bind('emergency_contact_relation')} placeholder="Vợ/chồng, bố mẹ…" /></Field>
                        </div>
                        <Field label="Số điện thoại" error={errs.emergency_contact_phone}><input {...bind('emergency_contact_phone')} inputMode="tel" /></Field>
                    </section>
                </div>
            </div>

            {dirty && (
                <div className={s.saveBar} role="alert">
                    <span>Bạn có thay đổi chưa lưu</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className={s.btn} onClick={() => { setF(initial); setErrs({}); }} disabled={saving}>Hoàn tác</button>
                        <button className={`${s.btn} ${s.btnP}`} onClick={save} disabled={saving}>{saving ? <Spin /> : <Icon n="check" size={16} />} Lưu thay đổi</button>
                    </div>
                </div>
            )}
        </div>
    );
}