import Link from 'next/link';
import s from '../website.module.css';
import { NAV, SCHOOL } from '../data/school';
import Icon from './Icons';

export default function SiteFooter() {
    return (
        <footer className={s.footer} id="lien-he">
            <div className={s.container}>
                <div className={s.footerGrid}>
                    <div>
                        <div className={s.footerName}>{SCHOOL.fullName}</div>
                        <p className={s.footerSlogan}>{SCHOOL.slogan}</p>
                    </div>

                    <ul className={s.contactList}>
                        <li><Icon name="pin" size={20} /><span>{SCHOOL.address}</span></li>
                        <li><Icon name="phone" size={20} /><span>{SCHOOL.phone}</span></li>
                        <li><Icon name="mail" size={20} /><span>{SCHOOL.email}</span></li>
                        <li><Icon name="clock" size={20} /><span>{SCHOOL.hours}</span></li>
                    </ul>

                    <nav className={s.footerLinks} aria-label="Liên kết nhanh">
                        {NAV.map((n) => (
                            <Link key={n.href} href={n.href}>{n.label}</Link>
                        ))}
                        <Link href="/he-thong">Cổng thông tin</Link>
                    </nav>
                </div>
                <p className={s.footerCopy}>© {new Date().getFullYear()} {SCHOOL.fullName}. Bảo lưu mọi quyền.</p>
            </div>
        </footer>
    );
}
