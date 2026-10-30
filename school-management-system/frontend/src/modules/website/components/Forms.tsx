'use client';
import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import s from '../site.module.css';
import { FormError, post } from '../lib/api';
import { CONTACT_TOPICS, SCHOOL, TRACK_OPTIONS } from '../data/school';
import Icon from './Icons';

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
    return (
        <div className={`${s.field} ${error ? s.fieldErr : ''}`}>
            <label htmlFor={id}>{label}</label>
            {children}
            {error ? <small className={s.err} id={`${id}-e`} role="alert">{error}</small> : hint ? <small id={`${id}-e`}>{hint}</small> : null}
        </div>
    );
}

type Errs = Record<string, string>;
/* Gom giá trị các ô của form thành object (không phụ thuộc lib dom.iterable). */
const toObj = (f: HTMLFormElement) => {
    const o: Record<string, string> = {};
    Array.from(f.elements).forEach((el) => { const x = el as HTMLInputElement; if (x.name) o[x.name] = x.value; });
    return o;
};
const inv = (e: Errs, k: string) => ({ 'aria-invalid': e[k] ? true : undefined, 'aria-describedby': `f-${k}-e` });

/** Đăng ký nhập học: gửi thật tới /api/public/admissions, nhận mã hồ sơ. */
export function AdmissionForm() {
    const [e, setE] = useState<Errs>({});
    const [busy, setBusy] = useState(false);
    const [top, setTop] = useState('');
    const [done, setDone] = useState<{ code: string; duplicate: boolean; phone: string } | null>(null);
    const box = useRef<HTMLDivElement>(null);

    async function submit(ev: React.FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        const d = toObj(ev.currentTarget);
        setBusy(true); setE({}); setTop('');
        try {
            const r = await post<{ code: string; duplicate: boolean }>('admissions', d);
            setDone({ ...r, phone: d.phone });
            setTimeout(() => box.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        } catch (x) {
            const er = x as FormError;
            setE(er.errors || {}); setTop(er.message);
            const first = Object.keys(er.errors || {})[0];
            if (first) document.getElementById(`f-${first}`)?.focus();
        } finally { setBusy(false); }
    }

    if (done) {
        return (
            <div ref={box} className={s.success} role="status">
                <span className={s.successIc}><Icon name="check" size={26} /></span>
                <h3>{done.duplicate ? 'Hồ sơ này đã được ghi nhận' : 'Đã nhận đăng ký của bạn'}</h3>
                <p>Mã hồ sơ của bạn</p>
                <p className={s.code}>{done.code}</p>
                <p>Hãy lưu mã này cùng số điện thoại <b>{done.phone}</b> để tra cứu tiến độ. Cán bộ tuyển sinh sẽ gọi cho bạn trong giờ làm việc ({SCHOOL.hours}).</p>
                <div className={s.successAct}>
                    <Link href="/tuyen-sinh/tra-cuu" className={`${s.btn} ${s.btnHot}`}>Tra cứu hồ sơ</Link>
                    <button className={`${s.btn} ${s.btnLine}`} onClick={() => setDone(null)}>Đăng ký cho em khác</button>
                </div>
            </div>
        );
    }

    return (
        <form className={s.form} onSubmit={submit} noValidate aria-labelledby="dang-ky-h">
            {top && <p className={s.formTop} role="alert">{top}</p>}
            <div className={s.formGrid}>
                <Field id="f-full_name" label="Họ và tên học sinh" error={e.full_name}><input id="f-full_name" name="full_name" autoComplete="name" required maxLength={80} placeholder="Nguyễn Văn An" {...inv(e, 'full_name')} /></Field>
                <Field id="f-dob" label="Ngày sinh" error={e.dob}><input id="f-dob" name="dob" type="date" required {...inv(e, 'dob')} /></Field>
                <Field id="f-gender" label="Giới tính" error={e.gender}>
                    <select id="f-gender" name="gender" required defaultValue="" {...inv(e, 'gender')}><option value="" disabled>Chọn giới tính</option><option>Nam</option><option>Nữ</option></select>
                </Field>
                <Field id="f-middle_school" label="Trường trung học cơ sở đang học" error={e.middle_school}><input id="f-middle_school" name="middle_school" required maxLength={120} placeholder="THCS …" {...inv(e, 'middle_school')} /></Field>
                <Field id="f-parent_name" label="Họ tên phụ huynh" error={e.parent_name}><input id="f-parent_name" name="parent_name" required maxLength={80} {...inv(e, 'parent_name')} /></Field>
                <Field id="f-phone" label="Số điện thoại phụ huynh" error={e.phone} hint="10 chữ số. Nhà trường dùng số này để gọi tư vấn."><input id="f-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel" required maxLength={14} placeholder="09xx xxx xxx" {...inv(e, 'phone')} /></Field>
                <Field id="f-email" label="Email (không bắt buộc)" error={e.email}><input id="f-email" name="email" type="email" autoComplete="email" maxLength={120} {...inv(e, 'email')} /></Field>
                <Field id="f-track" label="Tổ hợp môn quan tâm" error={e.track}>
                    <select id="f-track" name="track" defaultValue="Chưa xác định" {...inv(e, 'track')}>{TRACK_OPTIONS.map((t) => <option key={t}>{t}</option>)}</select>
                </Field>
                <div className={`${s.field} ${s.span2}`}>
                    <label htmlFor="f-note">Điều bạn muốn hỏi (không bắt buộc)</label>
                    <textarea id="f-note" name="note" rows={3} maxLength={500} />
                </div>
            </div>
            <p className={s.formNote}>Đăng ký trực tuyến giúp nhà trường ghi nhận và tư vấn sớm. Bạn vẫn cần nộp hồ sơ bản giấy để hoàn tất tuyển sinh.</p>
            <button className={`${s.btn} ${s.btnHot} ${s.btnLg}`} disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi đăng ký'}</button>
        </form>
    );
}

/** Tra cứu tiến độ hồ sơ bằng mã hồ sơ và số điện thoại. */
export function LookupForm() {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [r, setR] = useState<null | { code: string; name: string; track: string; status: string; label: string; text: string; note: string | null; created_at: string; steps: { key: string; label: string }[] }>(null);

    async function submit(ev: React.FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        const d = toObj(ev.currentTarget);
        setBusy(true); setErr(''); setR(null);
        try { setR((await post<{ item: NonNullable<typeof r> }>('admissions/lookup', d)).item); }
        catch (x) { setErr((x as FormError).message); }
        finally { setBusy(false); }
    }
    const idx = r ? r.steps.findIndex((x) => x.key === r.status) : -1;

    return (
        <div className={s.lookup}>
            <form className={s.form} onSubmit={submit} noValidate>
                <div className={s.formGrid}>
                    <Field id="l-code" label="Mã hồ sơ" hint="Ví dụ: TS26-AB3CD"><input id="l-code" name="code" required maxLength={14} autoCapitalize="characters" autoComplete="off" /></Field>
                    <Field id="l-phone" label="Số điện thoại đã khai"><input id="l-phone" name="phone" type="tel" inputMode="numeric" required maxLength={14} /></Field>
                </div>
                {err && <p className={s.formTop} role="alert">{err}</p>}
                <button className={`${s.btn} ${s.btnHot}`} disabled={busy}>{busy ? 'Đang tra cứu…' : 'Tra cứu'}</button>
            </form>
            {r && (
                <div className={s.result} role="status">
                    <p className={s.resultWho}><b>{r.name}</b><span>{r.code} · {r.track}</span></p>
                    <ol className={s.track} aria-label="Tiến độ hồ sơ">
                        {r.steps.map((st, i) => <li key={st.key} className={i < idx ? s.trackDone : i === idx ? s.trackNow : ''} aria-current={i === idx ? 'step' : undefined}><span>{i < idx ? <Icon name="check" size={14} /> : i + 1}</span>{st.label}</li>)}
                    </ol>
                    <h3>{r.label}</h3>
                    <p>{r.text}</p>
                    {r.note && <p className={s.resultNote}><b>Ghi chú của nhà trường:</b> {r.note}</p>}
                </div>
            )}
        </div>
    );
}

/** Gửi tin nhắn cho nhà trường. */
export function ContactForm() {
    const [e, setE] = useState<Errs>({});
    const [busy, setBusy] = useState(false);
    const [top, setTop] = useState('');
    const [ok, setOk] = useState('');
    async function submit(ev: React.FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        const form = ev.currentTarget;
        setBusy(true); setE({}); setTop(''); setOk('');
        try {
            const r = await fetchContact(toObj(form));
            setOk(r); form.reset();
        } catch (x) { const er = x as FormError; setE(er.errors || {}); setTop(er.message); }
        finally { setBusy(false); }
    }
    return (
        <form className={s.form} onSubmit={submit} noValidate>
            {ok && <p className={s.formOk} role="status"><Icon name="check" size={18} />{ok}</p>}
            {top && <p className={s.formTop} role="alert">{top}</p>}
            <div className={s.formGrid}>
                <Field id="c-full_name" label="Họ và tên" error={e.full_name}><input id="c-full_name" name="full_name" autoComplete="name" required maxLength={80} /></Field>
                <Field id="c-topic" label="Bạn cần hỏi về" error={e.topic}><select id="c-topic" name="topic" defaultValue="Tuyển sinh">{CONTACT_TOPICS.map((t) => <option key={t}>{t}</option>)}</select></Field>
                <Field id="c-phone" label="Số điện thoại" error={e.phone} hint="Để lại số điện thoại hoặc email, một trong hai."><input id="c-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel" maxLength={14} /></Field>
                <Field id="c-email" label="Email" error={e.email}><input id="c-email" name="email" type="email" autoComplete="email" maxLength={120} /></Field>
                <div className={`${s.field} ${s.span2} ${e.message ? s.fieldErr : ''}`}>
                    <label htmlFor="c-message">Nội dung</label>
                    <textarea id="c-message" name="message" rows={5} required maxLength={1500} />
                    {e.message && <small className={s.err} role="alert">{e.message}</small>}
                </div>
            </div>
            <button className={`${s.btn} ${s.btnHot}`} disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi tin nhắn'}</button>
        </form>
    );
}

async function fetchContact(d: Record<string, string>): Promise<string> {
    await post('contact', d);
    return 'Đã gửi tin nhắn. Nhà trường sẽ trả lời trong giờ làm việc.';
}