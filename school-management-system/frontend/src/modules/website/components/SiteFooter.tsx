import Link from 'next/link';
import s from '../site.module.css';
import { NAV, SCHOOL } from '../data/school';
import Icon from './Icons';

export default function SiteFooter() {
    return (
        <footer className={s.footer}>
            <div className={s.container}>
                <div className={s.footGrid}>
                    <div className={s.footAbout}>
                        <div className={s.footName}>{SCHOOL.fullName}</div>
                        <p>{SCHOOL.slogan} {SCHOOL.intro}</p>
                    </div>
                    <div>
                        <h2 className={s.footH}>Liên hệ</h2>
                        <ul className={s.footList}>
                            <li><Icon name="pin" size={18} /><span>{SCHOOL.address}</span></li>
                            <li><Icon name="phone" size={18} /><a href={`tel:${SCHOOL.phone.replace(/\s/g, '')}`}>{SCHOOL.phone}</a></li>
                            <li><Icon name="mail" size={18} /><a href={`mailto:${SCHOOL.email}`}>{SCHOOL.email}</a></li>
                            <li><Icon name="clock" size={18} /><span>{SCHOOL.hours}</span></li>
                        </ul>
                    </div>
                    <div>
                        <h2 className={s.footH}>Trang web</h2>
                        <ul className={s.footLinks}>{NAV.map((n) => <li key={n.href}><Link href={n.href}>{n.label}</Link></li>)}</ul>
                    </div>
                    <div>
                        <h2 className={s.footH}>Dành cho bạn</h2>
                        <ul className={s.footLinks}>
                            <li><Link href="/login/student">Học sinh đăng nhập</Link></li>
                            <li><Link href="/login/teacher">Giáo viên đăng nhập</Link></li>
                            <li><Link href="/tuyen-sinh#dang-ky">Đăng ký nhập học</Link></li>
                            <li><Link href="/tuyen-sinh/tra-cuu">Tra cứu hồ sơ</Link></li>
                        </ul>
                    </div>
                </div>
                <p className={s.footCopy}>© {new Date().getFullYear()} {SCHOOL.fullName}. Bảo lưu mọi quyền.</p>
            </div>
        </footer>
    );
}