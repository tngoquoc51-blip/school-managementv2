'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV, SCHOOL } from '../data/school';
import Icon from './Icons';
import s from './SiteHeader.module.css';

export default function SiteHeader() {
    const path = usePathname() || '/';
    const [open, setOpen] = useState(false);
    const [stuck, setStuck] = useState(false);

    useEffect(() => {
        setOpen(false);
    }, [path]);

    useEffect(() => {
        const f = () => setStuck(window.scrollY > 12);
        f();
        window.addEventListener('scroll', f, { passive: true });
        return () => window.removeEventListener('scroll', f);
    }, []);

    useEffect(() => {
        document.body.style.overflow = open ? 'hidden' : '';
        const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
        window.addEventListener('keydown', k);
        return () => {
            window.removeEventListener('keydown', k);
            document.body.style.overflow = '';
        };
    }, [open]);

    const on = (h: string) => {
        if (h === '/') return path === '/';
        return path === h || path.startsWith(h + '/');
    };

    return (
        <header className={`${s.header} ${stuck ? s.headerStuck : ''}`}>
            {/* Topbar thông tin liên hệ chuẩn website giới thiệu cao cấp */}
            <div className={s.topbar}>
                <div className={`${s.container} ${s.topbarIn}`}>
                    <div className={s.topbarLeft}>
                        <span className={s.topItem}>
                            <Icon name="pin" size={13} />
                            <span>{SCHOOL.addressShort}</span>
                        </span>
                        <span className={s.topItem}>
                            <Icon name="clock" size={13} />
                            <span>{SCHOOL.hours}</span>
                        </span>
                    </div>
                    <div className={s.topbarRight}>
                        <a href={`tel:${SCHOOL.hotline.replace(/\s/g, '')}`} className={s.hotlineLink}>
                            <Icon name="phone" size={13} />
                            <span>Hotline Tuyển sinh: <b>{SCHOOL.hotline}</b></span>
                        </a>
                        <a href={`mailto:${SCHOOL.email}`} className={s.topLink}>
                            <Icon name="mail" size={13} />
                            <span>{SCHOOL.email}</span>
                        </a>
                        <Link href="/tuyen-sinh/tra-cuu" className={s.searchLink}>
                            <Icon name="search" size={13} />
                            <span>Tra cứu hồ sơ</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main Navbar */}
            <div className={`${s.container} ${s.headerIn}`}>
                {/* Logo + Tên trường */}
                <Link href="/" className={s.brand} aria-label={`${SCHOOL.name} – Trang chủ`}>
                    <img
                        src="/images/logo-thpt-ngo-sy-lien.png"
                        alt={SCHOOL.name}
                        className={s.logo}
                    />
                    <div className={s.brandText}>
                        <div className={s.brandRow}>
                            <b>{SCHOOL.name}</b>
                            <span className={s.nationalTag}>Chuẩn QG</span>
                        </div>
                        <small>{SCHOOL.slogan}</small>
                    </div>
                </Link>

                {/* Menu chính */}
                <nav className={s.nav} aria-label="Điều hướng chính">
                    {NAV.map((n) => (
                        <Link
                            key={n.href}
                            href={n.href}
                            className={`${s.navLink} ${on(n.href) ? s.navOn : ''}`}
                            aria-current={on(n.href) ? 'page' : undefined}
                        >
                            {n.label}
                        </Link>
                    ))}
                </nav>

                {/* Các nút hành động CTA bán hàng & tuyển sinh */}
                <div className={s.headerRight}>
                    <div className={s.headerAct}>
                        <Link href="/he-thong" className={`${s.btn} ${s.btnPortal}`}>
                            <Icon name="monitor" size={16} />
                            <span>Cổng thông tin</span>
                        </Link>
                        <Link href="/tuyen-sinh#dang-ky" className={`${s.btn} ${s.btnAdmission}`}>
                            <span className={s.pulseDot}></span>
                            <span>Đăng ký tuyển sinh</span>
                        </Link>
                        <button
                            className={s.burger}
                            aria-label={open ? 'Đóng menu' : 'Mở menu'}
                            aria-expanded={open}
                            aria-controls="menu-mobile"
                            onClick={() => setOpen((v) => !v)}
                        >
                            <Icon name={open ? 'close' : 'menu'} size={22} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Menu cho điện thoại (Drawer Mobile) */}
            {open && (
                <div className={s.mobileDrawer} id="menu-mobile">
                    <div className={s.mobileIn}>
                        <div className={s.mobileTop}>
                            <p className={s.mobileTitle}>Danh mục điều hướng</p>
                            <span className={s.mobilePhone}>Hotline: {SCHOOL.hotline}</span>
                        </div>
                        <nav className={s.mobileNav}>
                            {NAV.map((n) => (
                                <Link
                                    key={n.href}
                                    href={n.href}
                                    className={`${s.mobileLink} ${on(n.href) ? s.mobileOn : ''}`}
                                >
                                    <span>{n.label}</span>
                                    <Icon name="arrow" size={16} />
                                </Link>
                            ))}
                        </nav>
                        <div className={s.mobileBtns}>
                            <Link href="/tuyen-sinh#dang-ky" className={`${s.btn} ${s.btnAdmission} ${s.btnFull}`}>
                                Đăng ký tuyển sinh 2026 – 2027
                            </Link>
                            <Link href="/he-thong" className={`${s.btn} ${s.btnPortal} ${s.btnFull}`}>
                                Vào cổng thông tin số
                            </Link>
                            <Link href="/tuyen-sinh/tra-cuu" className={`${s.btn} ${s.btnOutline} ${s.btnFull}`}>
                                Tra cứu tiến độ hồ sơ
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
