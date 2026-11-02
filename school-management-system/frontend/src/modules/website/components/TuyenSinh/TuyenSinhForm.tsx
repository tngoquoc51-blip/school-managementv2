'use client';
import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import s from './TuyenSinh.module.css';
import Icon from '../Icons';
import { FormError, post } from '../../lib/api';
import { SCHOOL } from '../../data/school';
import { TS_DONE, TS_FORM } from './tuyen-sinh.data';

type Errs = Record<string, string>;

function Field({ id, label, req, err, hint, span, children }: { id: string; label: string; req?: boolean; err?: string; hint?: string; span?: boolean; children: ReactNode }) {
    return (
        <div className={`${s.field} ${err ? s.fieldErr : ''} ${span ? s.span2 : ''}`}>
            <label htmlFor={`ts-${id}`}>{label}{req && <i> *</i>}</label>
            {children}
            {err ? <small className={s.err} role="alert">{err}</small> : hint ? <small className={s.hint}>{hint}</small> : null}
        </div>
    );
}

/** Biểu mẫu đăng ký nhập học: gửi tới API /public/admissions, nhận mã hồ sơ. */
export default function TuyenSinhForm() {
    const [errs, setErrs] = useState<Errs>({});
    const [top, setTop] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<{ code: string; duplicate: boolean; phone: string } | null>(null);
    const [copied, setCopied] = useState(false);
    const box = useRef<HTMLDivElement>(null);

    async function submit(ev: React.FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        const form = ev.currentTarget;
        const d: Record<string, string> = {};
        Array.from(form.elements).forEach((el) => { const x = el as HTMLInputElement; if (x.name && x.type !== 'checkbox') d[x.name] = x.value; });
        const agreed = (form.elements.namedItem('agree') as HTMLInputElement | null)?.checked;
        if (!agreed) { setErrs({ agree: TS_FORM.consentErr }); setTop('Vui lòng kiểm tra lại các ô được đánh dấu.'); return; }
        setBusy(true); setErrs({}); setTop('');
        try {
            const r = await post<{ code: string; duplicate: boolean }>('admissions', d);
            setDone({ code: r.code, duplicate: r.duplicate, phone: d.phone });
            setTimeout(() => box.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
        } catch (x) {
            const er = x as FormError;
            setErrs(er.errors || {}); setTop(er.message);
            const first = Object.keys(er.errors || {})[0];
            if (first) document.getElementById(`ts-${first}`)?.focus();
        } finally { setBusy(false); }
    }

    async function copy(code: string) {
        try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* trình duyệt không cho chép */ }
    }

    if (done) {
        return (
            <div ref={box} className={s.formBox} role="status">
                <div className={s.done}>
                    <span className={s.doneIc}><Icon name="check" size={32} /></span>
                    <h3>{done.duplicate ? TS_DONE.dupTitle : TS_DONE.title}</h3>
                    <p className={s.codeLabel}>{TS_DONE.codeLabel}</p>
                    <p className={s.code}>{done.code}</p>
                    <button type="button" className={`${s.btn} ${s.btnLine}`} onClick={() => copy(done.code)}>{copied ? 'Đã sao chép' : 'Sao chép mã'}</button>
                    <p className={s.keep}>{TS_DONE.keep} Số điện thoại đã khai: <b>{done.phone}</b>. Giờ làm việc: {SCHOOL.hours}.</p>
                    <ol className={s.doneSteps}>{TS_DONE.next.map((x, i) => <li key={x}><span>{i + 1}</span>{x}</li>)}</ol>
                    <div className={s.doneAct}>
                        <Link href="/tuyen-sinh/tra-cuu" className={`${s.btn} ${s.btnHot}`}>Tra cứu hồ sơ</Link>
                        <button type="button" className={`${s.btn} ${s.btnLine}`} onClick={() => setDone(null)}>Đăng ký cho em khác</button>
                    </div>
                </div>
            </div>
        );
    }

    const ar = (k: string) => ({ 'aria-invalid': errs[k] ? true : undefined });
    return (
        <form className={s.formBox} onSubmit={submit} noValidate id="dang-ky-form" aria-labelledby="dang-ky-h">
            <h2 id="dang-ky-h">{TS_FORM.title}</h2>
            <p className={s.formDesc}>{TS_FORM.desc}</p>
            {top && <p className={s.formTop} role="alert">{top}</p>}

            <fieldset className={s.group}>
                <legend>Thông tin học sinh</legend>
                <div className={s.grid}>
                    <Field id="full_name" label="Họ và tên học sinh" req err={errs.full_name} span><input id="ts-full_name" name="full_name" autoComplete="off" required maxLength={80} placeholder="Nguyễn Văn An" {...ar('full_name')} /></Field>
                    <Field id="dob" label="Ngày sinh" req err={errs.dob}><input id="ts-dob" name="dob" type="date" required {...ar('dob')} /></Field>
                    <Field id="gender" label="Giới tính" req err={errs.gender}>
                        <select id="ts-gender" name="gender" required defaultValue="" {...ar('gender')}><option value="" disabled>Chọn giới tính</option><option>Nam</option><option>Nữ</option></select>
                    </Field>
                    <Field id="middle_school" label="Trường trung học cơ sở đang học" req err={errs.middle_school} span><input id="ts-middle_school" name="middle_school" required maxLength={120} placeholder="THCS …" {...ar('middle_school')} /></Field>
                    <Field id="track" label="Tổ hợp môn quan tâm" err={errs.track} span hint="Chưa biết chọn gì thì để “Chưa xác định”, nhà trường sẽ tư vấn.">
                        <select id="ts-track" name="track" defaultValue="Chưa xác định" {...ar('track')}>{TS_FORM.tracks.map((t) => <option key={t}>{t}</option>)}</select>
                    </Field>
                </div>
            </fieldset>

            <fieldset className={s.group}>
                <legend>Thông tin phụ huynh</legend>
                <div className={s.grid}>
                    <Field id="parent_name" label="Họ tên phụ huynh" req err={errs.parent_name}><input id="ts-parent_name" name="parent_name" autoComplete="name" required maxLength={80} {...ar('parent_name')} /></Field>
                    <Field id="phone" label="Số điện thoại" req err={errs.phone} hint="10 chữ số. Nhà trường dùng số này để gọi tư vấn."><input id="ts-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel" required maxLength={14} placeholder="09xx xxx xxx" {...ar('phone')} /></Field>
                    <Field id="email" label="Email (không bắt buộc)" err={errs.email} span><input id="ts-email" name="email" type="email" autoComplete="email" maxLength={120} {...ar('email')} /></Field>
                    <Field id="note" label="Điều bạn muốn hỏi (không bắt buộc)" err={errs.note} span><textarea id="ts-note" name="note" rows={4} maxLength={500} /></Field>
                </div>
            </fieldset>

            <label className={`${s.agree} ${errs.agree ? s.agreeErr : ''}`}>
                <input type="checkbox" name="agree" />
                <span>{TS_FORM.consent}</span>
            </label>
            {errs.agree && <small className={s.err} role="alert">{errs.agree}</small>}
            <p className={s.privacy}><Icon name="shield" size={16} />{TS_FORM.note}</p>
            <button className={`${s.btn} ${s.btnHot} ${s.btnBlock}`} disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi đăng ký'}</button>
        </form>
    );
}