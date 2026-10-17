'use client';

import { useState, type FormEvent } from 'react';
import s from '../website.module.css';
import { TRACK_OPTIONS } from '../data/school';
import { ADMISSIONS_DEMO, submitAdmission, type AdmissionPayload } from '../services/admission';

const EMPTY: AdmissionPayload = {
    fullName: '', dob: '', gender: '', middleSchool: '', parentName: '', phone: '', email: '', track: TRACK_OPTIONS[2], note: '',
};

type Errors = Partial<Record<keyof AdmissionPayload, string>>;

function validate(v: AdmissionPayload): Errors {
    const e: Errors = {};
    if (!v.fullName.trim()) e.fullName = 'Nhập họ và tên học sinh.';
    if (!v.dob) e.dob = 'Chọn ngày sinh.';
    if (!v.gender) e.gender = 'Chọn giới tính.';
    if (!v.middleSchool.trim()) e.middleSchool = 'Nhập tên trường THCS đang học hoặc đã tốt nghiệp.';
    if (!v.parentName.trim()) e.parentName = 'Nhập họ tên phụ huynh.';
    if (!/^(0|\+84)\d{9}$/.test(v.phone.replace(/\s/g, ''))) e.phone = 'Số điện thoại gồm 10 số, ví dụ 0912345678.';
    if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) e.email = 'Email chưa đúng định dạng.';
    return e;
}

export default function AdmissionForm() {
    const [v, setV] = useState<AdmissionPayload>(EMPTY);
    const [errors, setErrors] = useState<Errors>({});
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState('');
    const [code, setCode] = useState('');

    const set = (k: keyof AdmissionPayload) => (e: { target: { value: string } }) =>
        setV((p) => ({ ...p, [k]: e.target.value }));

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        const errs = validate(v);
        setErrors(errs);
        if (Object.keys(errs).length) return;

        setBusy(true);
        setFailed('');
        try {
            const res = await submitAdmission(v);
            setCode(res.code);
        } catch {
            setFailed('Chưa gửi được hồ sơ. Vui lòng thử lại sau hoặc liên hệ nhà trường.');
        } finally {
            setBusy(false);
        }
    }

    if (code) {
        return (
            <div className={s.success} role="status">
                <h3>Đã ghi nhận đăng ký</h3>
                <p>Nhà trường sẽ liên hệ qua số điện thoại <b>{v.phone}</b> để hướng dẫn bước tiếp theo.</p>
                {code && <p className={s.successCode}>Mã đăng ký: <b>{code}</b></p>}
                {ADMISSIONS_DEMO && (
                    <p className={s.formNote}>Chế độ thử nghiệm: thông tin này chưa được gửi tới nhà trường.</p>
                )}
                <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => { setV(EMPTY); setCode(''); }}>
                    Đăng ký cho học sinh khác
                </button>
            </div>
        );
    }

    const field = (k: keyof AdmissionPayload, label: string, input: React.ReactNode) => (
        <div className={s.field}>
            <label htmlFor={`f-${k}`}>{label}</label>
            {input}
            {errors[k] && <span className={s.error} id={`e-${k}`}>{errors[k]}</span>}
        </div>
    );
    const common = (k: keyof AdmissionPayload) => ({
        id: `f-${k}`,
        value: v[k],
        onChange: set(k),
        'aria-invalid': errors[k] ? true : undefined,
        'aria-describedby': errors[k] ? `e-${k}` : undefined,
    });

    return (
        <form className={s.form} onSubmit={onSubmit} noValidate>
            <div className={s.fieldRow}>
                {field('fullName', 'Họ và tên học sinh', <input className={s.input} autoComplete="name" {...common('fullName')} />)}
                {field('dob', 'Ngày sinh', <input className={s.input} type="date" {...common('dob')} />)}
            </div>
            <div className={s.fieldRow}>
                {field('gender', 'Giới tính',
                    <select className={s.input} {...common('gender')}>
                        <option value="">Chọn giới tính</option>
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                        <option value="Khác">Khác</option>
                    </select>)}
                {field('middleSchool', 'Trường THCS', <input className={s.input} {...common('middleSchool')} />)}
            </div>
            <div className={s.fieldRow}>
                {field('parentName', 'Họ tên phụ huynh', <input className={s.input} {...common('parentName')} />)}
                {field('phone', 'Số điện thoại liên hệ', <input className={s.input} inputMode="tel" autoComplete="tel" {...common('phone')} />)}
            </div>
            <div className={s.fieldRow}>
                {field('email', 'Email (không bắt buộc)', <input className={s.input} type="email" autoComplete="email" {...common('email')} />)}
                {field('track', 'Định hướng quan tâm',
                    <select className={s.input} {...common('track')}>
                        {TRACK_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                    </select>)}
            </div>
            {field('note', 'Ghi chú (không bắt buộc)', <textarea className={s.input} rows={3} {...common('note')} />)}

            {failed && <p className={s.error} role="alert">{failed}</p>}

            <button type="submit" className={`${s.btn} ${s.btnPrimary} ${s.btnLg}`} disabled={busy}>
                {busy ? 'Đang gửi…' : 'Gửi đăng ký'}
            </button>
            <p className={s.formNote}>
                Thông tin chỉ dùng để nhà trường liên hệ tư vấn tuyển sinh. Đăng ký trực tuyến chưa thay thế hồ sơ bản giấy.
            </p>
        </form>
    );
}
