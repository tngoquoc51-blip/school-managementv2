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
        const f = () => setStuck(window.scrollY > 8);
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

    const on = (h: string) => path === h || path.startsWith(h + '/');

    return (
        <header className={`${s.header} ${stuck ? s.headerStuck : ''}`}>
            <div className={`${s.container} ${s.headerIn}`}>
                {/* Logo + Tên trường */}
                <Link href="/" className={s.brand} aria-label={`${SCHOOL.name} – Trang chủ`}>
                    <img
                        src="/images/logo-thpt-ngo-sy-lien.png"
                        alt={SCHOOL.name}
                        className={s.logo}
                    />
                    <span className={s.brandText}>
                        <b>{SCHOOL.name}</b>
                        <small>Học thật vững, bay thật xa</small>
                    </span>
                </Link>

                {/* Menu */}
                <nav className={s.nav} aria-label="Điều hướng chính">
                    {NAV.map((n) => (
                        <Link
                            key={n.href}
                            href={n.href}
                            className={on(n.href) ? s.navOn : ''}
                            aria-current={on(n.href) ? 'page' : undefined}
                        >
                            {n.label}
                        </Link>
                    ))}
                </nav>

                {/* Bên phải: Liên hệ + Nút */}
                <div className={s.headerRight}>
                    {/* Thông tin liên hệ */}
                    <div className={s.contact}>
                        <a href={`tel:${SCHOOL.phone.replace(/\s/g, '')}`}>
                            <Icon name="phone" size={14} />
                            {SCHOOL.phone}
                        </a>
                        <a href={`mailto:${SCHOOL.email}`}>
                            <Icon name="mail" size={14} />
                            {SCHOOL.email}
                        </a>
                    </div>

                    {/* Nút hành động */}
                    <div className={s.headerAct}>
                        <Link href="/he-thong" className={`${s.btn} ${s.btnLine} ${s.hideSm}`}>
                            Cổng thông tin
                        </Link>
                        <Link href="/tuyen-sinh#dang-ky" className={`${s.btn} ${s.btnHot} ${s.hideXs}`}>
                            Đăng ký nhập học
                        </Link>
                        <button
                            className={s.burger}
                            aria-label={open ? 'Đóng menu' : 'Mở menu'}
                            aria-expanded={open}
                            aria-controls="menu-mobile"
                            onClick={() => setOpen((v) => !v)}
                        >
                            <Icon name={open ? 'close' : 'menu'} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Menu mobile */}
            {open && (
                <div id="menu-mobile" className={s.sheet}>
                    <nav aria-label="Menu di động">
                        {NAV.map((n) => (
                            <Link
                                key={n.href}
                                href={n.href}
                                className={on(n.href) ? s.navOn : ''}
                            >
                                {n.label}
                            </Link>
                        ))}
                    </nav>

                    <div className={s.sheetAct}>
                        <Link href="/tuyen-sinh#dang-ky" className={`${s.btn} ${s.btnHot} ${s.btnBlock}`}>
                            Đăng ký nhập học
                        </Link>
                        <Link href="/he-thong" className={`${s.btn} ${s.btnLine} ${s.btnBlock}`}>
                            Cổng thông tin
                        </Link>
                    </div>

                    <div className={s.sheetContact}>
                        <a href={`tel:${SCHOOL.phone.replace(/\s/g, '')}`}>
                            <Icon name="phone" size={16} />
                            {SCHOOL.phone}
                        </a>
                        <a href={`mailto:${SCHOOL.email}`}>
                            <Icon name="mail" size={16} />
                            {SCHOOL.email}
                        </a>
                    </div>
                </div>
            )}
        </header>
    );
}