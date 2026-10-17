import Link from 'next/link';
import s from '../website.module.css';
import { NAV, SCHOOL } from '../data/school';
import Icon from './Icons';

export default function SiteHeader() {
    return (
        <header className={s.header}>
            <div className={`${s.container} ${s.headerInner}`}>
                <Link href="/" className={s.brand} aria-label={`${SCHOOL.name} – trang chủ`}>
                    <span className={s.brandMark} aria-hidden="true">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff">
                            <path d="m12 3 10 5-10 5L2 8l10-5Zm-6 9.200 6 3 6-3V16c0 1.700-2.700 3-6 3s-6-1.300-6-3v-3.800Z" />
                        </svg>
                    </span>
                    <span>
                        <span className={s.brandName}>{SCHOOL.name}</span>
                        <span className={s.brandSub}>Năm học {SCHOOL.schoolYear}</span>
                    </span>
                </Link>

                <nav className={s.nav} aria-label="Điều hướng chính">
                    {NAV.map((n) => (
                        <Link key={n.href} href={n.href} className={s.navLink}>{n.label}</Link>
                    ))}
                </nav>

                <div className={s.headerActions}>
                    <Link href="/he-thong" className={`${s.btn} ${s.btnGhost} ${s.hideMd}`}>Cổng thông tin</Link>
                    <Link href="/tuyen-sinh#dang-ky" className={`${s.btn} ${s.btnPrimary}`}>Đăng ký nhập học</Link>

                    <details className={s.menu}>
                        <summary aria-label="Mở menu"><Icon name="menu" /></summary>
                        <div className={s.menuPanel}>
                            {NAV.map((n) => (
                                <Link key={n.href} href={n.href}>{n.label}</Link>
                            ))}
                            <Link href="/he-thong">Cổng thông tin</Link>
                        </div>
                    </details>
                </div>
            </div>
        </header>
    );
}
