'use client';
import Link from 'next/link';
import { useState } from 'react';
import s from './TuyenSinh.module.css';
import Icon from '../Icons';
import { FormError, fmtDate, post } from '../../lib/api';
import { TL_FORM } from './tuyen-sinh.data';

type Result = { code: string; name: string; track: string; status: string; label: string; text: string; note: string | null; created_at: string; steps: { key: string; label: string }[] };

/** Tra cứu tiến độ hồ sơ: gửi mã hồ sơ + số điện thoại tới /public/admissions/lookup. */
export default function TraCuuForm() {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [r, setR] = useState<Result | null>(null);

    async function submit(ev: React.FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        const form = ev.currentTarget;
        const d: Record<string, string> = {};
        Array.from(form.elements).forEach((el) => { const x = el as HTMLInputElement; if (x.name) d[x.name] = x.value.trim(); });
        if (!d.code || !d.phone) { setErr(TL_FORM.empty); setR(null); return; }
        setBusy(true); setErr(''); setR(null);
        try { setR((await post<{ item: Result }>('admissions/lookup', d)).item); }
        catch (x) { setErr((x as FormError).message); }
        finally { setBusy(false); }
    }
    const idx = r ? r.steps.findIndex((x) => x.key === r.status) : -1;
    const rejected = r?.status === 'rejected';

    return (
        <div className={s.lookup}>
            <form className={s.formBox} onSubmit={submit} noValidate>
                <h2>{TL_FORM.title}</h2>
                <div className={`${s.grid} ${s.gridOne}`}>
                    <div className={s.field}>
                        <label htmlFor="tl-code">{TL_FORM.code.label} <i>*</i></label>
                        <input id="tl-code" name="code" required maxLength={14} autoCapitalize="characters" autoComplete="off" placeholder="TS26-XXXXX" />
                        <small className={s.hint}>{TL_FORM.code.hint}</small>
                    </div>
                    <div className={s.field}>
                        <label htmlFor="tl-phone">{TL_FORM.phone.label} <i>*</i></label>
                        <input id="tl-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel" required maxLength={14} placeholder="09xx xxx xxx" />
                        <small className={s.hint}>{TL_FORM.phone.hint}</small>
                    </div>
                </div>
                {err && <p className={s.formTop} role="alert">{err}</p>}
                <button className={`${s.btn} ${s.btnHot} ${s.btnBlock}`} disabled={busy}>{busy ? TL_FORM.busy : TL_FORM.btn}</button>
            </form>

            {r && (
                <div className={s.result} role="status">
                    <p className={s.resultWho}><b>{r.name}</b><span>Mã {r.code} · {r.track} · Đăng ký ngày {fmtDate(r.created_at)}</span></p>
                    {!rejected && (
                        <ol className={s.track} aria-label="Tiến độ hồ sơ">
                            {r.steps.filter((x) => x.key !== 'rejected').map((st, i) => (
                                <li key={st.key} className={i < idx ? s.trackDone : i === idx ? s.trackNow : ''} aria-current={i === idx ? 'step' : undefined}>
                                    <span>{i < idx ? <Icon name="check" size={14} /> : i + 1}</span>{st.label}
                                </li>
                            ))}
                        </ol>
                    )}
                    <h3 className={rejected ? s.resultBad : ''}>{r.label}</h3>
                    <p>{r.text}</p>
                    {r.note && <p className={s.resultNote}><b>Ghi chú của nhà trường:</b> {r.note}</p>}
                    <p className={s.resultLinks}><Link href="/lien-he">Liên hệ nhà trường</Link></p>
                </div>
            )}
        </div>
    );
}