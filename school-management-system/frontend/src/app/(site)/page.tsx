import Link from 'next/link';
import s from '@/modules/website/website.module.css';
import SkyArt from '@/modules/website/components/SkyArt';
import Icon from '@/modules/website/components/Icons';
import Faq from '@/modules/website/components/Faq';
import {
    SCHOOL, STATS, PILLARS, PROGRAMS, FACILITIES, NEWS, ADMISSION_STEPS,
} from '@/modules/website/data/school';

export default function SiteHome() {
    return (
        <>
            {/* ---------- Hero ---------- */}
            <section className={s.hero}>
                <div className={`${s.container} ${s.heroGrid}`}>
                    <div>
                        <h1 className={s.heroTitle}>Chào mừng đến với {SCHOOL.name}</h1>
                        <p className={s.heroText}>{SCHOOL.slogan}</p>
                        <div className={s.heroActions}>
                            <Link href="/tuyen-sinh#dang-ky" className={`${s.btn} ${s.btnPrimary} ${s.btnLg}`}>Đăng ký nhập học</Link>
                            <Link href="#gioi-thieu" className={`${s.btn} ${s.btnGhost} ${s.btnLg}`}>Tìm hiểu về trường</Link>
                        </div>
                        <ul className={s.heroFacts}>
                            <li><Icon name="check" size={20} />Chương trình GDPT 2018</li>
                            <li><Icon name="check" size={20} />Học bạ và điểm số trực tuyến</li>
                            <li><Icon name="check" size={20} />Hơn 20 câu lạc bộ</li>
                        </ul>
                    </div>
                    <SkyArt className={s.heroArt} />
                </div>
                <svg className={s.wave} viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0 40C240 80 480 0 720 30S1200 80 1440 30V80H0Z" fill="#ffffff" />
                </svg>
            </section>

            {/* ---------- Số liệu ---------- */}
            <section className={s.stats} aria-label="Nhà trường qua các con số">
                <div className={s.container}>
                    <dl className={s.statsGrid}>
                        {STATS.map(([num, label]) => (
                            <div className={s.stat} key={label}>
                                <dt>{num}</dt>
                                <dd>{label}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </section>

            {/* ---------- Giới thiệu ---------- */}
            <section id="gioi-thieu" className={s.section}>
                <div className={`${s.container} ${s.aboutGrid}`}>
                    <div>
                        <h2 className={s.sectionTitle}>Một ngôi trường để học sinh lớn lên</h2>
                        <p className={s.sectionDesc}>
                            {SCHOOL.fullName} đồng hành cùng học sinh trong ba năm quan trọng nhất của tuổi học trò:
                            vững kiến thức, giàu trải nghiệm và rõ định hướng cho bước đi tiếp theo.
                        </p>
                        <p className={s.sectionDesc}>
                            Mọi hoạt động học tập, điểm danh, điểm số và thông báo của nhà trường được quản lý trên một hệ thống
                            trực tuyến, giúp học sinh và phụ huynh theo dõi kịp thời.
                        </p>
                        <Link href="/he-thong" className={`${s.btn} ${s.btnSky}`}>Vào cổng thông tin</Link>
                    </div>

                    <ul className={s.pillars}>
                        {PILLARS.map((p) => (
                            <li key={p.title} className={s.pillar}>
                                <h3>{p.title}</h3>
                                <p>{p.text}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* ---------- Chương trình ---------- */}
            <section id="chuong-trinh" className={`${s.section} ${s.sectionSky}`}>
                <div className={s.container}>
                    <div className={s.sectionHead}>
                        <h2 className={s.sectionTitle}>Chương trình học</h2>
                        <p className={s.sectionDesc}>
                            Học sinh học theo Chương trình Giáo dục phổ thông 2018, chọn nhóm môn phù hợp với năng lực và định hướng nghề nghiệp.
                        </p>
                    </div>
                    <div className={s.programGrid}>
                        {PROGRAMS.map((p) => (
                            <article key={p.title} className={`${s.program} ${s['tone' + p.tone.toUpperCase()]}`}>
                                <h3>{p.title}</h3>
                                <p>{p.text}</p>
                                <ul className={s.chips}>
                                    {p.subjects.map((x) => <li key={x}>{x}</li>)}
                                </ul>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* ---------- Cơ sở vật chất & đời sống ---------- */}
            <section id="doi-song" className={s.section}>
                <div className={s.container}>
                    <div className={s.sectionHead}>
                        <h2 className={s.sectionTitle}>Cơ sở vật chất và đời sống học đường</h2>
                        <p className={s.sectionDesc}>Không gian học tập, vui chơi và sinh hoạt dành cho học sinh.</p>
                    </div>
                    <div className={s.bento}>
                        {FACILITIES.map((f) => (
                            <article
                                key={f.title}
                                className={`${s.tile} ${f.size === 'lg' ? s.tileLg : ''}`}
                                style={f.image ? { backgroundImage: `linear-gradient(180deg, rgba(12,74,110,.15), rgba(12,74,110,.78)), url(${f.image})` } : undefined}
                            >
                                <span className={s.tileIcon}><Icon name={f.icon} size={26} /></span>
                                <h3>{f.title}</h3>
                                <p>{f.text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* ---------- Tin tức ---------- */}
            <section id="tin-tuc" className={`${s.section} ${s.sectionSky}`}>
                <div className={s.container}>
                    <div className={s.sectionHead}>
                        <h2 className={s.sectionTitle}>Tin tức và thông báo</h2>
                        <p className={s.sectionDesc}>Cập nhật mới nhất từ nhà trường.</p>
                    </div>
                    <ul className={s.newsList}>
                        {NEWS.map((n) => (
                            <li key={n.title} className={s.newsItem}>
                                <div className={s.newsMeta}>
                                    <span className={s.newsTag}>{n.tag}</span>
                                    <span>{n.date}</span>
                                </div>
                                <h3>{n.title}</h3>
                                <p>{n.text}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* ---------- Tuyển sinh ---------- */}
            <section className={s.cta}>
                <div className={`${s.container} ${s.ctaInner}`}>
                    <div>
                        <h2>Đăng ký nhập học năm học {SCHOOL.admissionYear}</h2>
                        <p>Ba bước đơn giản để trở thành học sinh của trường.</p>
                        <Link href="/tuyen-sinh#dang-ky" className={`${s.btn} ${s.btnPrimary} ${s.btnLg}`}>Đăng ký ngay</Link>
                    </div>
                    <ol className={s.steps}>
                        {ADMISSION_STEPS.map((st, i) => (
                            <li key={st.title} className={s.step}>
                                <span className={s.stepNum}>{i + 1}</span>
                                <div>
                                    <h3>{st.title}</h3>
                                    <p>{st.text}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* ---------- Hỏi đáp ---------- */}
            <section className={s.section}>
                <div className={`${s.container} ${s.faqWrap}`}>
                    <div className={s.sectionHead}>
                        <h2 className={s.sectionTitle}>Câu hỏi thường gặp</h2>
                    </div>
                    <Faq />
                </div>
            </section>
        </>
    );
}
