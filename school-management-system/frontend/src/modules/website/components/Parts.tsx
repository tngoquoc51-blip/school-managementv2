import Link from 'next/link';
import type { ReactNode } from 'react';
import s from '../site.module.css';
import Icon from './Icons';
import CountUp from './CountUp';
import { fmtDate, type NewsItem, type Overview } from '../lib/api';
import { FAQ, SCHOOL } from '../data/school';

/** Đầu trang con: đường dẫn, tiêu đề, mô tả. */
export function PageHead({ title, desc, trail, children }: { title: string; desc?: string; trail: [string, string?][]; children?: ReactNode }) {
    return (
        <section className={s.pageHead}>
            <div className={s.container}>
                <nav className={s.crumb} aria-label="Đường dẫn">
                    <Link href="/">Trang chủ</Link>
                    {trail.map(([label, href], i) => (
                        <span key={label}><Icon name="chevron" size={14} />{href && i < trail.length - 1 ? <Link href={href}>{label}</Link> : <b aria-current="page">{label}</b>}</span>
                    ))}
                </nav>
                <h1>{title}</h1>
                {desc && <p>{desc}</p>}
                {children}
            </div>
        </section>
    );
}

export function SectionHead({ title, desc, action, center = false }: { title: string; desc?: string; action?: ReactNode; center?: boolean }) {
    return (
        <div className={`${s.secHead} ${center ? s.secHeadCenter : ''}`}>
            <div>
                <h2>{title}</h2>
                {desc && <p>{desc}</p>}
            </div>
            {action && <div className={s.secAction}>{action}</div>}
        </div>
    );
}

/** Khối ảnh bìa vẽ bằng màu / hoa văn */
export function Cover({ tone, kind }: { tone: string; kind?: string }) {
    return (
        <div className={`${s.cover} ${s['tone_' + tone] ?? s.tone_a}`} aria-hidden="true">
            <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice">
                <circle cx="150" cy="30" r="26" fill="rgba(255,255,255,.35)" />
                <path d="M0 96c40-24 80-4 120-18s60-6 80-14v56H0Z" fill="rgba(255,255,255,.28)" />
                <path d="M0 110c50-18 90 0 130-10s50-4 70-8v28H0Z" fill="rgba(255,255,255,.4)" />
            </svg>
            {kind === 'event' && <i><Icon name="calendar" size={18} /></i>}
        </div>
    );
}

export function NewsCard({ n, big = false }: { n: NewsItem; big?: boolean }) {
    const href = n.slug ? `/tin-tuc/${n.slug}` : '/tin-tuc';
    return (
        <article className={`${s.news} ${big ? s.newsBig : ''}`}>
            <Link href={href} className={s.newsCover} tabIndex={-1} aria-hidden="true"><Cover tone={n.tone} kind={n.kind} /></Link>
            <div className={s.newsBody}>
                <p className={s.newsMeta}>
                    <span className={s.tag}>{n.category}</span>
                    <time dateTime={n.date}>{fmtDate(n.date)}</time>
                </p>
                <h3><Link href={href}>{n.title}</Link></h3>
                <p className={s.newsSum}>{n.summary}</p>
                {n.kind === 'event' && n.event_date && (
                    <p className={s.newsWhen}>
                        <Icon name="calendar" size={16} />
                        {fmtDate(n.event_date)}{n.event_place ? ` · ${n.event_place}` : ''}
                    </p>
                )}
            </div>
        </article>
    );
}

/** Quy mô theo khối: dữ liệu thật từ hệ thống quản lý học sinh */
export function GradeBars({ o }: { o: Overview }) {
    const max = Math.max(1, ...o.grades.map((g) => g.students));
    return (
        <div className={s.grades}>
            <p className={s.gradesTotal}>
                <span><b><CountUp to={o.classes} /></b> lớp</span>
                <span><b><CountUp to={o.students} /></b> học sinh</span>
                <span><b><CountUp to={o.teachers} /></b> giáo viên</span>
                <span><b><CountUp to={o.subjects} /></b> môn học</span>
            </p>
            <ul className={s.gradeList} aria-label="Số học sinh theo khối">
                {o.grades.map((g) => (
                    <li key={g.grade}>
                        <span className={s.gradeName}>Khối {g.grade}</span>
                        <span className={s.gradeBar}><i style={{ width: `${(g.students / max) * 100}%` }} /></span>
                        <span className={s.gradeNum}><b>{g.students.toLocaleString('vi-VN')}</b> học sinh · {g.classes} lớp</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function Faq({ items = FAQ }: { items?: { q: string; a: string }[] }) {
    return (
        <div className={s.faq}>
            {items.map((f, idx) => (
                <details key={f.q} open={idx === 0}>
                    <summary>
                        <span>{f.q}</span>
                        <Icon name="chevron" size={18} />
                    </summary>
                    <p>{f.a}</p>
                </details>
            ))}
        </div>
    );
}

export function AdmitBand() {
    return (
        <section className={s.band}>
            <div className={`${s.container} ${s.bandIn}`}>
                <div className={s.bandText}>
                    <span className={s.bandTag}>Tuyển sinh vào lớp 10</span>
                    <h2>Năm học {SCHOOL.admissionYear} đang mở cổng đăng ký</h2>
                    <p>Nhận mã hồ sơ trực tuyến chỉ trong 1 phút để được ưu tiên tư vấn chọn tổ hợp môn và nhận thông báo sớm nhất từ nhà trường.</p>
                </div>
                <div className={s.bandAct}>
                    <Link href="/tuyen-sinh#dang-ky" className={`${s.btn} ${s.btnHot} ${s.btnLg}`}>
                        <span>Đăng ký xét tuyển ngay</span>
                        <Icon name="arrow" size={18} />
                    </Link>
                    <a href={`tel:${SCHOOL.hotline.replace(/\s/g, '')}`} className={`${s.btn} ${s.btnGhostW} ${s.btnLg}`}>
                        <Icon name="phone" size={18} />
                        <span>Hotline: {SCHOOL.hotline}</span>
                    </a>
                </div>
            </div>
        </section>
    );
}
