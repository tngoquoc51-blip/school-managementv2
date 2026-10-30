'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import s from '../site.module.css';
import { HERO_SLIDES } from '../data/school';
import ImageSlot from './ImageSlot';
import Icon from './Icons';
import { FormError, post } from '../lib/api';

/** Banner ảnh lớn ở đầu trang: tự chuyển slide, dừng khi rê chuột hoặc tab bị ẩn, kèm ô xin tư vấn nhanh. */
export default function HeroSlider() {
    const [i, setI] = useState(0);
    const [paused, setPaused] = useState(false);
    const n = HERO_SLIDES.length;
    const reduce = useRef(false);

    useEffect(() => { reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }, []);
    useEffect(() => {
        if (paused) return;
        const t = setInterval(() => { if (!reduce.current && !document.hidden) setI((v) => (v + 1) % n); }, 6500);
        return () => clearInterval(t);
    }, [paused, n]);
    const go = useCallback((v: number) => setI((v + n) % n), [n]);

    return (
        <section className={s.slider} aria-roledescription="carousel" aria-label="Giới thiệu nhà trường" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
            {HERO_SLIDES.map((sl, k) => (
                <div key={sl.title} className={`${s.slide} ${k === i ? s.slideOn : ''}`} aria-hidden={k !== i} role="group" aria-roledescription="slide" aria-label={`${k + 1} trên ${n}`}>
                    <ImageSlot src={sl.img} alt="" tone={sl.tone} className={s.slideImg} eager={k === 0} hint={k === i} />
                    <div className={s.slideShade} />
                </div>
            ))}

            <div className={`${s.container} ${s.sliderIn}`}>
                <div className={s.sliderText} aria-live={paused ? 'polite' : 'off'}>
                    {HERO_SLIDES.map((sl, k) => (
                        <div key={sl.title} className={`${s.caption} ${k === i ? s.captionOn : ''}`} hidden={k !== i}>
                            <h1>{sl.title}</h1>
                            <p>{sl.text}</p>
                            <div className={s.row}>
                                <Link href={sl.cta[1]} className={`${s.btn} ${s.btnHot} ${s.btnLg}`} tabIndex={k === i ? 0 : -1}>{sl.cta[0]}</Link>
                                <Link href={sl.cta2[1]} className={`${s.btn} ${s.btnGhostW} ${s.btnLg}`} tabIndex={k === i ? 0 : -1}>{sl.cta2[0]}</Link>
                            </div>
                        </div>
                    ))}
                </div>
                <LeadCard />
            </div>

            <div className={`${s.container} ${s.sliderNav}`}>
                <div className={s.dots} role="tablist" aria-label="Chọn slide">
                    {HERO_SLIDES.map((sl, k) => <button key={sl.title} role="tab" aria-selected={k === i} aria-label={`Slide ${k + 1}`} className={k === i ? s.dotOn : ''} onClick={() => go(k)} />)}
                </div>
                <div className={s.arrows}>
                    <button aria-label="Slide trước" onClick={() => go(i - 1)}><Icon name="chevron" size={20} className={s.flip} /></button>
                    <button aria-label="Slide sau" onClick={() => go(i + 1)}><Icon name="chevron" size={20} /></button>
                </div>
            </div>
        </section>
    );
}

/** Xin tư vấn nhanh: chỉ cần họ tên và số điện thoại, gửi vào mục Liên hệ (chủ đề Tuyển sinh). */
function LeadCard() {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<Record<string, string>>({});
    const [top, setTop] = useState('');
    const [ok, setOk] = useState(false);

    async function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = e.currentTarget;
        const el = Array.from(f.elements) as HTMLInputElement[];
        const v = (k: string) => el.find((x) => x.name === k)?.value ?? '';
        setBusy(true); setErr({}); setTop('');
        try {
            await post('contact', { full_name: v('full_name'), phone: v('phone'), topic: 'Tuyển sinh', message: 'Phụ huynh đề nghị nhà trường gọi lại tư vấn tuyển sinh lớp 10 (gửi từ ô tư vấn nhanh trên trang chủ).' });
            setOk(true); f.reset();
        } catch (x) { const er = x as FormError; setErr(er.errors || {}); setTop(Object.keys(er.errors || {}).length ? '' : er.message); }
        finally { setBusy(false); }
    }

    return (
        <aside className={s.leadBox} aria-labelledby="lead-h">
            {ok ? (
                <div className={s.leadOk} role="status"><span><Icon name="check" size={22} /></span><h2>Đã nhận thông tin</h2><p>Cán bộ tuyển sinh sẽ gọi lại trong giờ làm việc.</p><button className={`${s.btn} ${s.btnLine} ${s.btnSm}`} onClick={() => setOk(false)}>Gửi thêm số khác</button></div>
            ) : (
                <form onSubmit={submit} noValidate>
                    <h2 id="lead-h">Nhận tư vấn tuyển sinh</h2>
                    <p>Để lại số điện thoại, nhà trường gọi lại để giải đáp trong giờ làm việc.</p>
                    <label htmlFor="lead-n">Họ tên phụ huynh</label>
                    <input id="lead-n" name="full_name" autoComplete="name" maxLength={80} aria-invalid={err.full_name ? true : undefined} />
                    {err.full_name && <small role="alert">{err.full_name}</small>}
                    <label htmlFor="lead-p">Số điện thoại</label>
                    <input id="lead-p" name="phone" type="tel" inputMode="numeric" autoComplete="tel" maxLength={14} placeholder="09xx xxx xxx" aria-invalid={err.phone ? true : undefined} />
                    {err.phone && <small role="alert">{err.phone}</small>}
                    {top && <small role="alert">{top}</small>}
                    <button className={`${s.btn} ${s.btnHot} ${s.btnBlock}`} disabled={busy}>{busy ? 'Đang gửi…' : 'Gọi lại cho tôi'}</button>
                </form>
            )}
        </aside>
    );
}