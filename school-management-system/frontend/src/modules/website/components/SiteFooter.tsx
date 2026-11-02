import Link from 'next/link';
import s from '../site.module.css';
import { NAV, PROGRAMS, SCHOOL } from '../data/school';
import Icon from './Icons';

export default function SiteFooter() {
    return (
        <footer className={s.footer}>
            {/* Dải thông tin liên hệ khẩn cấp / Hotline */}
            <div className={s.footCtaBar}>
                <div className={`${s.container} ${s.footCtaIn}`}>
                    <div className={s.footCtaLeft}>
                        <h3>Quý phụ huynh cần tư vấn trực tiếp về Tuyển sinh lớp 10?</h3>
                        <p>Đội ngũ tuyển sinh nhà trường luôn sẵn sàng giải đáp mọi thắc mắc về hồ sơ và tổ hợp môn.</p>
                    </div>
                    <div className={s.footCtaRight}>
                        <a href={`tel:${SCHOOL.hotline.replace(/\s/g, '')}`} className={`${s.btn} ${s.btnHot} ${s.btnLg}`}>
                            <Icon name="phone" size={18} />
                            <span>Gọi Hotline: {SCHOOL.hotline}</span>
                        </a>
                        <Link href="/tuyen-sinh#dang-ky" className={`${s.btn} ${s.btnGhostW} ${s.btnLg}`}>
                            <span>Đăng ký tư vấn trực tuyến</span>
                            <Icon name="arrow" size={18} />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Nội dung chính chân trang */}
            <div className={s.container}>
                <div className={s.footGrid}>
                    {/* Cột 1: Thông tin trường + Giới thiệu */}
                    <div className={s.footAbout}>
                        <div className={s.footBrand}>
                            <img
                                src="/images/logo-thpt-ngo-sy-lien.png"
                                alt={SCHOOL.name}
                                className={s.footLogo}
                            />
                            <div>
                                <h2 className={s.footSchoolName}>{SCHOOL.fullName}</h2>
                                <span className={s.footTag}>Trường Đạt Chuẩn Quốc Gia Mức Độ 2</span>
                            </div>
                        </div>
                        <p className={s.footIntroText}>
                            {SCHOOL.slogan} {SCHOOL.intro}
                        </p>
                        <div className={s.socialLinks}>
                            <a href={SCHOOL.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                                <span className={s.socialIco}>fb</span>
                            </a>
                            <a href={SCHOOL.youtube} target="_blank" rel="noopener noreferrer" aria-label="Youtube">
                                <span className={s.socialIco}>yt</span>
                            </a>
                            <a href={SCHOOL.zalo} target="_blank" rel="noopener noreferrer" aria-label="Zalo">
                                <span className={s.socialIco}>zl</span>
                            </a>
                        </div>
                    </div>

                    {/* Cột 2: Thông tin liên hệ trực tiếp */}
                    <div>
                        <h3 className={s.footH}>Trụ sở & Liên hệ</h3>
                        <ul className={s.footList}>
                            <li>
                                <Icon name="pin" size={18} />
                                <span>{SCHOOL.address}</span>
                            </li>
                            <li>
                                <Icon name="phone" size={18} />
                                <div>
                                    <a href={`tel:${SCHOOL.phone.replace(/\s/g, '')}`}>Điện thoại: {SCHOOL.phone}</a>
                                    <br />
                                    <a href={`tel:${SCHOOL.hotline.replace(/\s/g, '')}`} className={s.footHotline}>Hotline: <b>{SCHOOL.hotline}</b></a>
                                </div>
                            </li>
                            <li>
                                <Icon name="mail" size={18} />
                                <div>
                                    <a href={`mailto:${SCHOOL.email}`}>{SCHOOL.email}</a>
                                    <br />
                                    <a href={`mailto:${SCHOOL.supportEmail}`}>{SCHOOL.supportEmail}</a>
                                </div>
                            </li>
                            <li>
                                <Icon name="clock" size={18} />
                                <span>{SCHOOL.hours}</span>
                            </li>
                        </ul>
                    </div>

                    {/* Cột 3: Chương trình đào tạo */}
                    <div>
                        <h3 className={s.footH}>Chương trình 2018</h3>
                        <ul className={s.footLinks}>
                            {PROGRAMS.map((p) => (
                                <li key={p.key}>
                                    <Link href="/chuong-trinh">{p.title}</Link>
                                </li>
                            ))}
                            <li><Link href="/doi-song">Hoạt động trải nghiệm & STEM</Link></li>
                            <li><Link href="/doi-song">25+ Câu lạc bộ học đường</Link></li>
                            <li><Link href="/tuyen-sinh">Chính sách học bổng khuyến tài</Link></li>
                        </ul>
                    </div>

                    {/* Cột 4: Tiện ích & Cổng thông tin */}
                    <div>
                        <h3 className={s.footH}>Cổng dịch vụ số</h3>
                        <ul className={s.footLinks}>
                            <li><Link href="/login/student">Cổng thông tin Học sinh</Link></li>
                            <li><Link href="/login/teacher">Cổng nghiệp vụ Giáo viên</Link></li>
                            <li><Link href="/accountant/dashboard">Cổng Kế toán & Tài chính</Link></li>
                            <li><Link href="/admin">Cổng Quản trị hệ thống</Link></li>
                            <li><Link href="/tuyen-sinh/tra-cuu">Tra cứu hồ sơ tuyển sinh</Link></li>
                            <li><Link href="/tuyen-sinh#dang-ky">Đăng ký dự tuyển trực tuyến</Link></li>
                        </ul>
                    </div>
                </div>

                {/* Dòng bản quyền dưới cùng */}
                <div className={s.footBottom}>
                    <p className={s.footCopy}>
                        © {new Date().getFullYear()} {SCHOOL.fullName}. Bản quyền thuộc về nhà trường.
                    </p>
                    <div className={s.footBottomLinks}>
                        <Link href="/gioi-thieu">Về nhà trường</Link>
                        <span>·</span>
                        <Link href="/tuyen-sinh">Tuyển sinh</Link>
                        <span>·</span>
                        <Link href="/lien-he">Sơ đồ chỉ đường</Link>
                        <span>·</span>
                        <Link href="/he-thong">Cổng thông tin</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
