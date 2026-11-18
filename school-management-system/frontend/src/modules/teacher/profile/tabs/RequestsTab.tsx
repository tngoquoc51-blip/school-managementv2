'use client';

import { useMemo, useState } from 'react';
import { apiError, profileApi } from '@/services/teacherProfileService';
import { useToast } from '@/components/Toast';
import { Field, Icon, Spin, GENDER } from '../ui';
import type { Overview, TabKey } from '../types';
import s from '../profile.module.css';

interface Props {
    ov: Overview;
    prefill?: string;
    onChanged?: () => Promise<void> | void;
    reload?: () => Promise<void> | void;
    go?: (t: TabKey, prefill?: string) => void;
}
const KEYS = ['phone', 'email', 'gender', 'birth_date', 'ethnicity', 'religion', 'id_number', 'hometown', 'address', 'degree_level', 'major', 'job_title', 'department', 'career_start_year', 'joined_at', 'bio', 'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation'] as const;
const DEGREES = ['Cao đẳng', 'Đại học', 'Thạc sĩ', 'Tiến sĩ'];

export default function RequestsTab({ ov, reload = () => {}, go = () => {} }: Props) {
    const toast = useToast();
    const initial = useMemo(() => {
        const p: any = ov.profile || {};
        return Object.fromEntries(KEYS.map((k) => [k, String((k === 'phone' ? (p.phone ?? ov.user.phone) : p[k]) ?? '')])) as Record<string, string>;
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

    const Locked = ({ label, value, field }: { label: string; value?: string | null; field?: string }) => (
        <Field label={label}>
            <div className={s.lock}><input className={s.input} readOnly value={value || '—'} />
                {field && <button type="button" className={`${s.btn} ${s.btnS}`} onClick={() => go('requests', field)}><Icon n="lock" size={14} /> Yêu cầu sửa</button>}</div>
        </Field>
    );

    return (
        <div className={s.panel}>
            <div className={s.stack}>
                <section className={s.card}>
                    <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="shield" /> I. Thông tin định danh</h3><div className={s.cardSub}>Do nhà trường quản lý – muốn thay đổi hãy gửi “Yêu cầu sửa” để giáo vụ/BGH duyệt</div></div></div>
                    <div className={s.row2}>
                        <Locked label="Họ và tên" value={ov.teacher?.full_name || ov.user.name} field="full_name" />
                        <Locked label="Mã giáo viên" value={ov.teacher?.code} field="employee_code" />
                        <Locked label="Môn giảng dạy chính" value={ov.teacher?.subject_name} />
                        <Locked label="Tên đăng nhập" value={ov.user.username} />
                    </div>
                </section>

                <div className={s.g2}>
                    <section className={s.card}>
                        <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="user" /> II. Thông tin cá nhân</h3></div></div>
                        <div className={s.row2}>
                            <Field label="Giới tính" error={errs.gender}>
                                <select {...bind('gender')} className={s.select}><option value="">— Chọn —</option>{Object.entries(GENDER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                            </Field>
                            <Field label="Ngày sinh" error={errs.birth_date}><input type="date" {...bind('birth_date')} /></Field>
                            <Field label="Dân tộc" error={errs.ethnicity}><input {...bind('ethnicity')} placeholder="VD: Kinh" /></Field>
                            <Field label="Tôn giáo" error={errs.religion}><input {...bind('religion')} placeholder="VD: Không" /></Field>
                        </div>
                        <Field label="Số CCCD" error={errs.id_number}><input {...bind('id_number')} placeholder="12 chữ số" inputMode="numeric" /></Field>
                        <Field label="Quê quán" error={errs.hometown}><input {...bind('hometown')} placeholder="Xã/phường, quận/huyện, tỉnh/thành" /></Field>
                        <Field label="Nơi ở hiện nay" error={errs.address}><input {...bind('address')} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" /></Field>
                    </section>

                    <section className={s.card}>
                        <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="phone" /> III. Liên hệ</h3></div></div>
                        <Field label="Số điện thoại" error={errs.phone}><input {...bind('phone')} placeholder="0912345678" inputMode="tel" /></Field>
                        <Field label="Email" error={errs.email}><input {...bind('email')} placeholder="ten@truong.edu.vn" inputMode="email" /></Field>
                        <div className={s.cardHead} style={{ marginTop: 18 }}><div><h3 className={s.cardTitle}><Icon n="users" /> Liên hệ khẩn cấp</h3><div className={s.cardSub}>Dùng khi nhà trường cần liên lạc gấp</div></div></div>
                        <div className={s.row2}>
                            <Field label="Họ tên người liên hệ" error={errs.emergency_contact_name}><input {...bind('emergency_contact_name')} /></Field>
                            <Field label="Quan hệ" error={errs.emergency_contact_relation}><input {...bind('emergency_contact_relation')} placeholder="Vợ/chồng, bố mẹ…" /></Field>
                        </div>
                        <Field label="Số điện thoại người liên hệ" error={errs.emergency_contact_phone}><input {...bind('emergency_contact_phone')} inputMode="tel" /></Field>
                    </section>
                </div>

                <section className={s.card}>
                    <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="book" /> IV. Chuyên môn & công tác</h3></div></div>
                    <div className={s.g3}>
                        <Field label="Trình độ chuyên môn" error={errs.degree_level}>
                            <select {...bind('degree_level')} className={s.select}><option value="">— Chọn —</option>{DEGREES.map((d) => <option key={d} value={d}>{d}</option>)}</select>
                        </Field>
                        <Field label="Chuyên ngành đào tạo" error={errs.major}><input {...bind('major')} placeholder="VD: Sư phạm Toán" /></Field>
                        <Field label="Năm vào ngành" error={errs.career_start_year}><input {...bind('career_start_year')} inputMode="numeric" placeholder="VD: 2012" /></Field>
                        <Field label="Chức vụ" error={errs.job_title}><input {...bind('job_title')} placeholder="Giáo viên, Tổ trưởng…" /></Field>
                        <Field label="Tổ chuyên môn" error={errs.department}><input {...bind('department')} placeholder="VD: Tổ Toán – Tin" /></Field>
                        <Field label="Ngày vào trường" error={errs.joined_at}><input type="date" {...bind('joined_at')} /></Field>
                    </div>
                    <Field label="Giới thiệu bản thân" error={errs.bio} hint={`${(f.bio || '').length}/2000 ký tự`}>
                        <textarea {...bind('bio')} className={`${s.textarea} ${errs.bio ? s.invalid : ''}`} maxLength={2000} placeholder="Kinh nghiệm, phương pháp giảng dạy, thành tích nổi bật…" />
                    </Field>
                </section>
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