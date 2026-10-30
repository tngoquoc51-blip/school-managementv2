'use client';
import { useState } from 'react';
import s from './LienHe.module.css';
import Icon from '../Icons';
import { FormError, post } from '../../lib/api';
import { LH_FORM } from './lien-he.data';

type Errs = Record<string, string>;

/** Biểu mẫu liên hệ: gửi về API /public/contact. Lỗi từng ô hiện ngay dưới ô đó. */
export default function LienHeForm() {
    const [errs, setErrs] = useState<Errs>({});
    const [top, setTop] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const [len, setLen] = useState(0);

    async function submit(ev: React.FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        const form = ev.currentTarget;
        const data: Record<string, string> = {};
        new FormData(form).forEach((v, k) => { data[k] = String(v); });
        setBusy(true); setErrs({}); setTop('');
        try {
            await post('contact', data);
            setDone(true); form.reset(); setLen(0);
        } catch (x) {
            const er = x as FormError;
            setErrs(er.errors || {}); setTop(er.message);
        } finally { setBusy(false); }
    }

    if (done) {
        return (
            <div className={s.formBox} role="status">
                <div className={s.done}>
                    <span><Icon name="check" size={30} /></span>
                    <h3>Đã gửi tin nhắn</h3>
                    <p>{LH_FORM.ok}</p>
                    <button type="button" className={`${s.btn} ${s.btnLine}`} onClick={() => setDone(false)}>Gửi tin nhắn khác</button>
                </div>
            </div>
        );
    }

    const f = (id: string) => `${s.field} ${errs[id] ? s.fieldErr : ''}`;
    return (
        <form className={s.formBox} onSubmit={submit} noValidate id="gui-tin">
            <h2>{LH_FORM.title}</h2>
            <p className={s.formDesc}>{LH_FORM.desc}</p>
            {top && <p className={s.formTop} role="alert">{top}</p>}
            <div className={s.grid}>
                <div className={f('full_name')}>
                    <label htmlFor="lh-name">Họ và tên <i>*</i></label>
                    <input id="lh-name" name="full_name" autoComplete="name" maxLength={80} required placeholder={LH_FORM.placeholders.full_name} />
                    {errs.full_name && <small role="alert">{errs.full_name}</small>}
                </div>
                <div className={f('topic')}>
                    <label htmlFor="lh-topic">Bạn cần hỏi về</label>
                    <select id="lh-topic" name="topic" defaultValue={LH_FORM.topics[0]}>
                        {LH_FORM.topics.map((t) => <option key={t}>{t}</option>)}
                    </select>
                </div>
                <div className={f('phone')}>
                    <label htmlFor="lh-phone">Số điện thoại</label>
                    <input id="lh-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel" maxLength={14} placeholder={LH_FORM.placeholders.phone} />
                    {errs.phone && <small role="alert">{errs.phone}</small>}
                </div>
                <div className={f('email')}>
                    <label htmlFor="lh-email">Email</label>
                    <input id="lh-email" name="email" type="email" autoComplete="email" maxLength={120} placeholder={LH_FORM.placeholders.email} />
                    {errs.email && <small role="alert">{errs.email}</small>}
                </div>
                <div className={`${f('message')} ${s.span2}`}>
                    <label htmlFor="lh-msg">Nội dung <i>*</i></label>
                    <textarea id="lh-msg" name="message" rows={6} maxLength={1500} required placeholder={LH_FORM.placeholders.message} onChange={(e) => setLen(e.target.value.length)} />
                    <span className={s.count}>{len}/1500</span>
                    {errs.message && <small role="alert">{errs.message}</small>}
                </div>
            </div>
            <p className={s.privacy}><Icon name="shield" size={16} />{LH_FORM.privacy}</p>
            <button className={`${s.btn} ${s.btnHot} ${s.btnBlock}`} disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi tin nhắn'}</button>
        </form>
    );
}