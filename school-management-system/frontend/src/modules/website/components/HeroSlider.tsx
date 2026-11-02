'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import s from '../site.module.css';
import { HERO_SLIDES, TRACK_OPTIONS, SCHOOL } from '../data/school';
import ImageSlot from './ImageSlot';
import Icon from './Icons';
import { FormError, post } from '../lib/api';

/**
 * Banner Hero Full Màn Hình phong cách Website Giới thiệu & Bán hàng cao cấp:
 * Tự động chuyển slide, hiệu ứng Ken-Burns zoom nhẹ, tiêu đề truyền cảm hứng,
 * thẻ bảo chứng uy tín nổi và Form chuyển đổi tư vấn tuyển sinh nhanh.
 */
export default function HeroSlider() {
    const [i, setI] = useState(0);
    const [paused, setPaused] = useState(false);
    const n = HERO_SLIDES.length;
    const reduce = useRef(false);

    useEffect(() => {
        reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }, []);

    useEffect(() => {
        if (paused) return;
        const timer = setInterval(() => {
            if (!reduce.current && !document.hidden) {
                setI((v) => (v + 1) % n);
            }
        }, 7000);
        return () => clearInterval(timer);
    }, [paused, n]);

    const go = useCallback((v: number) => setI((v + n) % n), [n]);

    return (
        <section
            className={s.slider}
            aria-roledescription="carousel"
            aria-label="Giới thiệu trường THPT Ngô Sĩ Liên"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
        >
            {/* Background Slides với ảnh thật & overlay sang trọng */}
            {HERO_SLIDES.map((sl, k) => (
                <div
                    key={sl.title}
                    className={`${s.slide} ${k === i ? s.slideOn : ''}`}
                    aria-hidden={k !== i}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${k + 1} trên ${n}`}
                >
                    <ImageSlot
                        src={sl.img}
                        alt="Khuôn viên trường THPT Ngô Sĩ Liên"
                        tone={sl.tone}
                        className={s.slideImg}
                        eager={k === 0}
                        hint={false}
                    />
                    <div className={s.slideShade} />
                    <div className={s.slideMesh} />
                </div>
            ))}

            {/* Nội dung chính tràn viền (Full container) */}
            <div className={`${s.container} ${s.sliderIn}`}>
                <div className={s.sliderText} aria-live={paused ? 'polite' : 'off'}>
                    {HERO_SLIDES.map((sl, k) => (
                        <div
                            key={sl.title}
                            className={`${s.caption} ${k === i ? s.captionOn : ''}`}
                            hidden={k !== i}
                        >
                            <div className={s.heroBadge}>
                                <span className={s.badgeSpark}>★</span>
                                <span>{sl.badge}</span>
                            </div>

                            <h1 className={s.heroTitle}>{sl.title}</h1>
                            <p className={s.heroDesc}>{sl.text}</p>

                            <div className={s.heroActs}>
                                <Link
                                    href={sl.cta[1]}
                                    className={`${s.btn} ${s.btnHot} ${s.btnHero}`}
                                    tabIndex={k === i ? 0 : -1}
                                >
                                    <span>{sl.cta[0]}</span>
                                    <Icon name="arrow" size={18} />
                                </Link>
                                <Link
                                    href={sl.cta2[1]}
                                    className={`${s.btn} ${s.btnGhostW} ${s.btnHero}`}
                                    tabIndex={k === i ? 0 : -1}
                                >
                                    <Icon name="spark" size={18} />
                                    <span>{sl.cta2[0]}</span>
                                </Link>
                            </div>

                            {/* Dòng bảo chứng nhanh (Trust Bar) */}
                            <div className={s.trustHighlights}>
                                <div className={s.trustItem}>
                                    <Icon name="check" size={16} />
                                    <span>Chuẩn Quốc Gia Mức Độ 2</span>
                                </div>
                                <div className={s.trustItem}>
                                    <Icon name="check" size={16} />
                                    <span>Tỉ lệ đỗ Đại học 88.6%+</span>
                                </div>
                                <div className={s.trustItem}>
                                    <Icon name="check" size={16} />
                                    <span>25+ Câu lạc bộ tài năng</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Form Chuyển Đổi Tuyển Sinh Phong Cách Website Bán Hàng */}
                <div className={s.sliderFormCol}>
                    <AdmissionLeadBox />
                </div>
            </div>

            {/* Điều hướng Slider */}
            <div className={`${s.container} ${s.sliderNav}`}>
                <div className={s.dots} role="tablist" aria-label="Chọn slide">
                    {HERO_SLIDES.map((sl, k) => (
                        <button
                            key={sl.title}
                            role="tab"
                            aria-selected={k === i}
                            aria-label={`Slide ${k + 1}`}
                            className={`${s.dot} ${k === i ? s.dotOn : ''}`}
                            onClick={() => go(k)}
                        >
                            <span className={s.dotProgress} />
                        </button>
                    ))}
                </div>
                <div className={s.arrows}>
                    <button
                        className={s.arrowBtn}
                        aria-label="Slide trước"
                        onClick={() => go(i - 1)}
                    >
                        <Icon name="chevron" size={20} className={s.flip} />
                    </button>
                    <button
                        className={s.arrowBtn}
                        aria-label="Slide sau"
                        onClick={() => go(i + 1)}
                    >
                        <Icon name="chevron" size={20} />
                    </button>
                </div>
            </div>
        </section>
    );
}

/**
 * Hộp Đăng Ký Tư Vấn Tuyển Sinh (Lead Generation Box) chuẩn Sales Landing Page
 */
export function AdmissionLeadBox() {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<Record<string, string>>({});
    const [top, setTop] = useState('');
    const [ok, setOk] = useState(false);
    const [name, setName] = useState('');
    const [regCode, setRegCode] = useState('');

    async function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = e.currentTarget;
        const el = Array.from(f.elements) as (HTMLInputElement | HTMLSelectElement)[];
        const v = (k: string) => el.find((x) => x.name === k)?.value ?? '';

        const fullName = v('full_name');
        const phone = v('phone');
        const track = v('track');

        if (!fullName.trim()) {
            setErr({ full_name: 'Vui lòng nhập họ tên phụ huynh hoặc học sinh.' });
            return;
        }
        if (!phone.trim() || phone.replace(/\D/g, '').length < 9) {
            setErr({ phone: 'Vui lòng nhập số điện thoại hợp lệ để nhà trường liên hệ.' });
            return;
        }

        setBusy(true);
        setErr({});
        setTop('');

        try {
            const randomCode = 'NSL-' + Math.floor(100000 + Math.random() * 900000);
            await post('contact', {
                full_name: fullName,
                phone: phone,
                topic: 'Tư vấn tuyển sinh lớp 10',
                message: `Phụ huynh/Học sinh: ${fullName} - SĐT: ${phone} đăng ký tư vấn tuyển sinh lớp 10 năm học 2026-2027. Nguyện vọng tổ hợp: ${track || 'Chưa chọn'}. Mã hồ sơ: ${randomCode}`,
            });
            setName(fullName);
            setRegCode(randomCode);
            setOk(true);
            f.reset();
        } catch (x) {
            const er = x as FormError;
            setErr(er.errors || {});
            setTop(Object.keys(er.errors || {}).length ? '' : (er.message || 'Có lỗi xảy ra, vui lòng thử lại hoặc gọi Hotline.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <aside className={s.leadBox} aria-labelledby="lead-box-title">
            <div className={s.leadBoxHeader}>
                <div className={s.leadPill}>
                    <span className={s.leadDot}></span>
                    <span>Tư vấn trực tiếp 1:1</span>
                </div>
                <span className={s.leadFree}>Miễn phí 100%</span>
            </div>

            {ok ? (
                <div className={s.leadOk} role="status">
                    <div className={s.leadOkIcon}>
                        <Icon name="check" size={28} />
                    </div>
                    <h3 className={s.leadOkTitle}>Đăng ký thành công!</h3>
                    <p className={s.leadOkDesc}>
                        Cảm ơn <b>{name}</b> đã để lại thông tin. Mã hồ sơ tư vấn của bạn là:
                    </p>
                    <div className={s.codeBadge}>
                        <b>{regCode}</b>
                    </div>
                    <p className={s.leadOkNote}>
                        Ban tư vấn tuyển sinh THPT Ngô Sĩ Liên sẽ liên hệ lại qua số điện thoại của bạn trong giờ làm việc.
                    </p>
                    <div className={s.leadOkActions}>
                        <button
                            type="button"
                            className={`${s.btn} ${s.btnLine} ${s.btnSm}`}
                            onClick={() => setOk(false)}
                        >
                            Đăng ký thêm số khác
                        </button>
                        <Link href="/tuyen-sinh" className={`${s.btn} ${s.btnHot} ${s.btnSm}`}>
                            Xem hướng dẫn chi tiết
                        </Link>
                    </div>
                </div>
            ) : (
                <form onSubmit={submit} noValidate className={s.leadForm}>
                    <h2 id="lead-box-title" className={s.leadTitle}>
                        Nhận tư vấn tuyển sinh Lớp 10
                    </h2>
                    <p className={s.leadSub}>
                        Để lại thông tin để nhận tài liệu tuyển sinh và tư vấn chọn tổ hợp môn phù hợp năng lực học sinh.
                    </p>

                    <div className={s.formGroup}>
                        <label htmlFor="lead-fullname" className={s.formLabel}>
                            Họ tên Phụ huynh / Học sinh <span className={s.req}>*</span>
                        </label>
                        <div className={s.inputWrapper}>
                            <Icon name="user" size={17} className={s.inputIcon} />
                            <input
                                id="lead-fullname"
                                name="full_name"
                                autoComplete="name"
                                maxLength={80}
                                placeholder="Ví dụ: Nguyễn Văn An"
                                className={s.formInput}
                                aria-invalid={err.full_name ? true : undefined}
                            />
                        </div>
                        {err.full_name && <small className={s.fieldErr} role="alert">{err.full_name}</small>}
                    </div>

                    <div className={s.formGroup}>
                        <label htmlFor="lead-phone" className={s.formLabel}>
                            Số điện thoại liên hệ <span className={s.req}>*</span>
                        </label>
                        <div className={s.inputWrapper}>
                            <Icon name="phone" size={17} className={s.inputIcon} />
                            <input
                                id="lead-phone"
                                name="phone"
                                type="tel"
                                inputMode="numeric"
                                autoComplete="tel"
                                maxLength={14}
                                placeholder="Ví dụ: 0988 123 456"
                                className={s.formInput}
                                aria-invalid={err.phone ? true : undefined}
                            />
                        </div>
                        {err.phone && <small className={s.fieldErr} role="alert">{err.phone}</small>}
                    </div>

                    <div className={s.formGroup}>
                        <label htmlFor="lead-track" className={s.formLabel}>
                            Tổ hợp môn quan tâm
                        </label>
                        <div className={s.inputWrapper}>
                            <select id="lead-track" name="track" className={s.formSelect} defaultValue={TRACK_OPTIONS[0]}>
                                {TRACK_OPTIONS.map((tr) => (
                                    <option key={tr} value={tr}>{tr}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {top && <p className={s.topErr} role="alert">{top}</p>}

                    <button
                        type="submit"
                        className={`${s.btn} ${s.btnHot} ${s.btnSubmitLead}`}
                        disabled={busy}
                    >
                        <span>{busy ? 'Đang gửi đăng ký…' : 'GỬI ĐĂNG KÝ TƯ VẤN NGAY'}</span>
                        <Icon name="arrow" size={18} />
                    </button>

                    <div className={s.formFootnote}>
                        <Icon name="check" size={13} />
                        <span>Bảo mật 100% · Hotline hỗ trợ: <b>{SCHOOL.hotline}</b></span>
                    </div>
                </form>
            )}
        </aside>
    );
}

/** Tương thích ngược */
export const LeadCard = AdmissionLeadBox;
