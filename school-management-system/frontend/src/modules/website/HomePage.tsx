import Link from 'next/link';
import s from './site.module.css';
import HeroSlider from './components/HeroSlider';
import ImageSlot from './components/ImageSlot';
import CountUp from './components/CountUp';
import Icon from './components/Icons';
import { AdmitBand, Faq, NewsCard, SectionHead } from './components/Parts';
import { load, fmtDate, type NewsItem, type NewsList, type Overview } from './lib/api';
import {
    ABOUT, ADMISSION_STEPS, CLUBS, CLUB_COUNT, DAY, FACILITIES, FALLBACK_OVERVIEW,
    GALLERY, IMG, NEWS_FALLBACK, PORTAL, PROGRAMS, SCHOOL, STAFF, TESTIMONIALS,
    TRUST_STATS, WHY,
} from './data/school';

/**
 * Trang chủ Website THPT Ngô Sĩ Liên:
 * Thiết kế chuẩn Website Giới Thiệu & Bán Hàng (Landing Page Tuyển Sinh Cao Cấp),
 * Full màn hình, ứng dụng ảnh thật, số liệu thực, kịch bản đầy đủ chi tiết.
 */
export default async function HomePage() {
    const [ov, nw, ev] = await Promise.all([
        load<Overview>('overview', FALLBACK_OVERVIEW, 300),
        load<NewsList>('news?per_page=4', {
            items: NEWS_FALLBACK as NewsItem[],
            total: 3,
            page: 1,
            pages: 1,
            per_page: 4,
            categories: [],
        }),
        load<{ items: NewsItem[] }>('events?limit=4', { items: [] }),
    ]);

    const o = ov.data;
    const [lead, ...rest] = nw.data.items;
    const clubGroups = Array.from(new Set(CLUBS.map((c) => c.group)));

    return (
        <div className={s.pageWrap}>
            {/* 1. HERO SLIDER VỚI FORM TƯ VẤN TUYỂN SINH FULL MÀN HÌNH */}
            <HeroSlider />

            {/* 2. DẢI TRUY CẬP NHANH / CỔNG DỊCH VỤ (QUICK ACCESS CARDS) */}
            <section className={s.quickSec} aria-label="Lối vào nhanh tiện ích">
                <div className={`${s.container} ${s.quickGrid}`}>
                    <Link href="/login/student" className={s.quickCard}>
                        <div className={`${s.quickIcon} ${s.icSky}`}>
                            <Icon name="user" size={26} />
                        </div>
                        <div className={s.quickInfo}>
                            <h3>Cổng Học sinh</h3>
                            <p>Điểm số, TKB & học phí online</p>
                        </div>
                        <span className={s.quickArrow}>
                            <Icon name="chevron" size={16} />
                        </span>
                    </Link>

                    <Link href="/login/teacher" className={s.quickCard}>
                        <div className={`${s.quickIcon} ${s.icEmerald}`}>
                            <Icon name="teacher" size={26} />
                        </div>
                        <div className={s.quickInfo}>
                            <h3>Cổng Giáo viên</h3>
                            <p>Điểm danh, sổ điểm & lịch dạy</p>
                        </div>
                        <span className={s.quickArrow}>
                            <Icon name="chevron" size={16} />
                        </span>
                    </Link>

                    <Link href="/tuyen-sinh#dang-ky" className={`${s.quickCard} ${s.quickCardHot}`}>
                        <div className={`${s.quickIcon} ${s.icRose}`}>
                            <Icon name="spark" size={26} />
                        </div>
                        <div className={s.quickInfo}>
                            <h3>Tuyển sinh 2026</h3>
                            <p>Đăng ký xét tuyển trực tuyến</p>
                        </div>
                        <span className={s.quickArrow}>
                            <Icon name="chevron" size={16} />
                        </span>
                    </Link>

                    <Link href="/tuyen-sinh/tra-cuu" className={s.quickCard}>
                        <div className={`${s.quickIcon} ${s.icAmber}`}>
                            <Icon name="search" size={26} />
                        </div>
                        <div className={s.quickInfo}>
                            <h3>Tra cứu hồ sơ</h3>
                            <p>Kiểm tra tiến độ hồ sơ 24/7</p>
                        </div>
                        <span className={s.quickArrow}>
                            <Icon name="chevron" size={16} />
                        </span>
                    </Link>
                </div>
            </section>

            {/* 3. DẢI SỐ LIỆU VÀNG BẢO CHỨNG UY TÍN (TRUST BAR) */}
            <section className={s.trustBarSec} aria-label="Thành tích nổi bật">
                <div className={s.container}>
                    <div className={s.trustBarGrid}>
                        {TRUST_STATS.map((st) => (
                            <div key={st.label} className={s.trustStatBox}>
                                <span className={s.trustNum}>{st.num}</span>
                                <b className={s.trustTitle}>{st.label}</b>
                                <span className={s.trustSub}>{st.sub}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 4. VỀ NHÀ TRƯỜNG: LỊCH SỬ & GIÁ TRỊ CỐT LÕI */}
            <section className={s.section}>
                <div className={`${s.container} ${s.aboutSplit}`}>
                    <div className={s.aboutVisualCol}>
                        <div className={s.aboutFrame}>
                            <ImageSlot
                                src={IMG.about}
                                alt="Khuôn viên trường THPT Ngô Sĩ Liên"
                                tone="a"
                                className={s.aboutMainImg}
                            />
                            <div className={s.aboutFloatingBadge}>
                                <span className={s.badgeIcon}>🏛️</span>
                                <div>
                                    <b>{ABOUT.badge}</b>
                                    <small>{SCHOOL.yearsOfTradition} năm truyền thống vẻ vang</small>
                                </div>
                            </div>
                            <div className={s.aboutStudentBadge}>
                                <b><CountUp to={o.students} /></b>
                                <span>Học sinh năm học {o.school_year ?? SCHOOL.schoolYear}</span>
                            </div>
                        </div>
                    </div>

                    <div className={s.aboutContentCol}>
                        <div className={s.kickerPill}>
                            <span className={s.kickerDot}></span>
                            <span>Tự hào ngôi trường mang tên danh nhân</span>
                        </div>
                        <h2 className={s.h2Title}>{ABOUT.title}</h2>

                        <div className={s.aboutParas}>
                            {ABOUT.paras.map((p, idx) => (
                                <p key={idx} className={s.aboutP}>{p}</p>
                            ))}
                        </div>

                        <div className={s.aboutChecklist}>
                            {ABOUT.bullets.map((b, idx) => (
                                <div key={idx} className={s.checkItem}>
                                    <span className={s.checkIco}>
                                        <Icon name="check" size={16} />
                                    </span>
                                    <span>{b}</span>
                                </div>
                            ))}
                        </div>

                        <div className={s.aboutBtns}>
                            <Link href="/gioi-thieu" className={`${s.btn} ${s.btnPri} ${s.btnLg}`}>
                                <span>Tìm hiểu lịch sử nhà trường</span>
                                <Icon name="arrow" size={16} />
                            </Link>
                            <Link href="/lien-he" className={`${s.btn} ${s.btnLine} ${s.btnLg}`}>
                                <Icon name="calendar" size={16} />
                                <span>Đặt lịch tham quan trường</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. 6 LÝ DO PHỤ HUYNH & HỌC SINH TIN TƯỞNG LỰA CHỌN */}
            <section className={`${s.section} ${s.sectionTint}`}>
                <div className={s.container}>
                    <SectionHead
                        center
                        title="Vì sao phụ huynh trao gửi niềm tin tại THPT Ngô Sĩ Liên?"
                        desc="Sáu trụ cột vững chắc kiến tạo môi trường học tập lý tưởng, nơi các em được tôn trọng, thấu hiểu và phát triển tối đa tiềm năng bản thân."
                    />

                    <div className={s.whyGrid}>
                        {WHY.map((w, idx) => (
                            <article key={w.title} className={s.whyCard}>
                                <div className={s.whyCardHead}>
                                    <span className={s.whyCardIdx}>0{idx + 1}</span>
                                    <div className={s.whyCardIcon}>
                                        <Icon name={w.icon} size={26} />
                                    </div>
                                </div>
                                <h3 className={s.whyCardTitle}>{w.title}</h3>
                                <p className={s.whyCardText}>{w.text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* 6. CHƯƠNG TRÌNH ĐÀO TẠO GDPT 2018 (SẢN PHẨM GIÁO DỤC NỔI BẬT) */}
            <section className={s.section}>
                <div className={s.container}>
                    <SectionHead
                        title="Chương trình đào tạo theo định hướng tương lai"
                        desc="Triển khai chuẩn mực theo Chương trình Giáo dục Phổ thông 2018. Học sinh được lựa chọn tổ hợp môn chuyên sâu theo năng khiếu và định hướng nghề nghiệp Đại học."
                        action={
                            <Link href="/chuong-trinh" className={`${s.btn} ${s.btnLine}`}>
                                <span>Xem toàn bộ tổ hợp môn</span>
                                <Icon name="arrow" size={16} />
                            </Link>
                        }
                    />

                    <div className={s.programGrid}>
                        {PROGRAMS.map((p, idx) => (
                            <article key={p.key} className={`${s.programCard} ${s['progTone_' + p.tone]}`}>
                                <div className={s.programHeader}>
                                    <span className={s.progBadge}>{p.badge}</span>
                                    <h3 className={s.progTitle}>{p.title}</h3>
                                    <p className={s.progDesc}>{p.text}</p>
                                </div>

                                <div className={s.progMedia}>
                                    <ImageSlot
                                        src={idx === 0 ? IMG.tn : idx === 1 ? IMG.xh : IMG.exp}
                                        alt={p.title}
                                        tone={p.tone}
                                        className={s.progImg}
                                    />
                                </div>

                                <div className={s.progBody}>
                                    <div className={s.progBlock}>
                                        <b className={s.blockTitle}>Tổ hợp môn trọng tâm:</b>
                                        <ul className={s.progChips}>
                                            {p.subjects.map((sub) => (
                                                <li key={sub}>{sub}</li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className={s.progBlock}>
                                        <b className={s.blockTitle}>Định hướng ngành nghề & Đại học:</b>
                                        <ul className={s.careerList}>
                                            {p.careers.map((car) => (
                                                <li key={car}>
                                                    <Icon name="check" size={14} />
                                                    <span>{car}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className={s.progFoot}>
                                        <p className={s.progHighlight}>
                                            <b>Điểm nổi bật:</b> {p.highlight}
                                        </p>
                                        <Link href="/chuong-trinh" className={s.progLink}>
                                            <span>Chi tiết chương trình & lộ trình học</span>
                                            <Icon name="arrow" size={16} />
                                        </Link>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* 7. CƠ SỞ VẬT CHẤT ĐẠT CHUẨN QUỐC GIA (BENTO GRID ẢNH THẬT) */}
            <section className={`${s.section} ${s.sectionTint}`}>
                <div className={s.container}>
                    <SectionHead
                        title="Cơ sở vật chất hiện đại bậc nhất"
                        desc="Nhà trường chú trọng đầu tư hệ sinh thái học tập và rèn luyện thể chất đạt chuẩn quốc gia, mang đến trải nghiệm học đường tiện nghi, an toàn cho mọi học sinh."
                    />

                    <div className={s.bentoModernGrid}>
                        {FACILITIES.map((f, i) => (
                            <div
                                key={f.title}
                                className={`${s.bentoCard} ${f.size === 'lg' ? s.bentoColLg : f.size === 'wide' ? s.bentoColWide : ''}`}
                            >
                                <div className={s.bentoImgWrap}>
                                    <ImageSlot
                                        src={f.image}
                                        alt={f.title}
                                        tone={['a', 'b', 'c', 'd'][i % 4]}
                                        className={s.bentoRealImg}
                                    />
                                    <div className={s.bentoOverlay} />
                                </div>
                                <div className={s.bentoMeta}>
                                    <span className={s.bentoIcon}>
                                        <Icon name={f.icon} size={22} />
                                    </span>
                                    <h3 className={s.bentoTitle}>{f.title}</h3>
                                    <p className={s.bentoDesc}>{f.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 8. THƯ VIỆN ẢNH HOẠT ĐỘNG THỰC TẾ CỦA HỌC SINH */}
            <section className={s.section}>
                <div className={s.container}>
                    <SectionHead
                        title="Khoảnh khắc học đường Ngô Sĩ Liên"
                        desc="Nụ cười rạng rỡ, những giờ thí nghiệm say mê và các hoạt động thể thao ngoại khóa tràn đầy năng lượng của học sinh nhà trường."
                        action={
                            <Link href="/doi-song" className={s.link}>
                                <span>Khám phá đời sống học đường</span>
                                <Icon name="arrow" size={16} />
                            </Link>
                        }
                    />

                    <div className={s.galleryModern}>
                        {GALLERY.map((g, k) => (
                            <figure
                                key={g.title}
                                className={`${s.galleryItem} ${g.size === 'big' ? s.galBig : g.size === 'tall' ? s.galTall : ''}`}
                            >
                                <ImageSlot
                                    src={g.img}
                                    alt={g.title}
                                    tone={['a', 'b', 'c', 'd'][k % 4]}
                                    className={s.galImg}
                                    hint={false}
                                />
                                <div className={s.galShade} />
                                <figcaption className={s.galCaption}>
                                    <b>{g.title}</b>
                                    <span>{g.text}</span>
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                </div>
            </section>

            {/* 9. ĐỘI NGŨ NHÀ GIÁO TINH HOA */}
            <section className={`${s.section} ${s.sectionTint}`}>
                <div className={`${s.container} ${s.staffSplit}`}>
                    <div className={s.staffTextCol}>
                        <div className={s.kickerPill}>
                            <span className={s.kickerDot}></span>
                            <span>Đội ngũ sư phạm chất lượng cao</span>
                        </div>
                        <h2 className={s.h2Title}>{STAFF.title}</h2>
                        <p className={s.staffLead}>{STAFF.text}</p>

                        <div className={s.staffPoints}>
                            {STAFF.points.map((pt, idx) => (
                                <div key={idx} className={s.pointItem}>
                                    <span className={s.pointIco}>
                                        <Icon name="check" size={16} />
                                    </span>
                                    <span>{pt}</span>
                                </div>
                            ))}
                        </div>

                        <div className={s.staffNumberCard}>
                            <div className={s.staffNumberIn}>
                                <b><CountUp to={o.teachers} /></b>
                                <div>
                                    <strong>Cán bộ & Giáo viên tâm huyết</strong>
                                    <p>100% đạt chuẩn và trên chuẩn theo quy định Bộ GD&ĐT</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={s.staffVisualCol}>
                        <div className={s.staffPicWrapper}>
                            <ImageSlot
                                src={IMG.staff}
                                alt="Hội đồng Sư phạm Trường THPT Ngô Sĩ Liên"
                                tone="b"
                                className={s.staffImg}
                            />
                            <div className={s.staffCaptionTag}>
                                <b>Hội đồng Sư phạm Trường THPT Ngô Sĩ Liên</b>
                                <span>Đoàn kết — Tận tụy — Sáng tạo — Yêu thương học trò</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 10. MỘT NGÀY Ở TRƯỜNG & HƠN 25 CÂU LẠC BỘ */}
            <section className={s.section}>
                <div className={`${s.container} ${s.daySplit}`}>
                    <div className={s.dayInfoCol}>
                        <div className={s.kickerPill}>
                            <span className={s.kickerDot}></span>
                            <span>Môi trường học tập năng động</span>
                        </div>
                        <h2 className={s.h2Title}>Một ngày đầy cảm hứng tại Ngô Sĩ Liên</h2>
                        <p className={s.aboutP}>
                            Giờ giấc khoa học, cân đối giữa học tập văn hóa, rèn luyện thể chất và nuôi dưỡng đam mê. Ở đây, các em không chỉ học giỏi mà còn có không gian để trải nghiệm và trưởng thành mỗi ngày.
                        </p>

                        <div className={s.clubSummaryBox}>
                            <div className={s.clubBoxHead}>
                                <Icon name="spark" size={20} />
                                <h3>Hệ sinh thái hơn {CLUB_COUNT} Câu lạc bộ</h3>
                            </div>
                            <p className={s.clubBoxDesc}>
                                Nơi học sinh tự quản lý, tổ chức sự kiện và thể hiện tài năng nghệ thuật, thể thao và học thuật:
                            </p>
                            <div className={s.clubGroupsList}>
                                {clubGroups.map((grp) => (
                                    <div key={grp} className={s.clubGroupRow}>
                                        <strong className={s.grpLabel}>{grp}:</strong>
                                        <span className={s.grpNames}>
                                            {CLUBS.filter((c) => c.group === grp).map((c) => c.name).join(' · ')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className={s.dayTimelineCol}>
                        <h3 className={s.timelineTitle}>Lịch trình một ngày học tập</h3>
                        <ol className={s.timelineList}>
                            {DAY.map(([time, heading, desc]) => (
                                <li key={time} className={s.timelineItem}>
                                    <div className={s.timeBadge}>{time}</div>
                                    <div className={s.timelineContent}>
                                        <h4>{heading}</h4>
                                        <p>{desc}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            </section>

            {/* 11. ĐÁNH GIÁ CỦA PHỤ HUYNH & CỰU HỌC SINH (TESTIMONIALS CARDS) */}
            <section className={`${s.section} ${s.sectionTint}`}>
                <div className={s.container}>
                    <SectionHead
                        center
                        title="Phụ huynh và Học sinh nói gì về chúng tôi?"
                        desc="Niềm tin và sự đồng hành của quý phụ huynh cùng thành công của các thế hệ học sinh là phần thưởng vô giá cho sự tận tụy của nhà trường."
                    />

                    <div className={s.quotesGrid}>
                        {TESTIMONIALS.map((t, idx) => (
                            <article key={idx} className={s.quoteCard}>
                                <div className={s.starsRow}>
                                    {[...Array(t.rating || 5)].map((_, i) => (
                                        <span key={i} className={s.starIcon}>★</span>
                                    ))}
                                </div>
                                <blockquote className={s.quoteText}>
                                    "{t.text}"
                                </blockquote>
                                <div className={s.quoteAuthor}>
                                    <div className={s.authorAvatar}>
                                        <ImageSlot
                                            src={t.avatar}
                                            alt={t.who}
                                            tone="a"
                                            className={s.avatarImg}
                                            hint={false}
                                        />
                                    </div>
                                    <div className={s.authorMeta}>
                                        <strong className={s.authorName}>{t.who}</strong>
                                        <span className={s.authorRole}>{t.role}</span>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* 12. TIN TỨC & SỰ KIỆN MỚI NHẤT */}
            <section className={s.section}>
                <div className={s.container}>
                    <SectionHead
                        title="Tin tức & Sự kiện tiêu biểu"
                        desc="Cập nhật những hoạt động giáo dục mới nhất, thông báo tuyển sinh và thành tích vẻ vang của thầy trò nhà trường."
                        action={
                            <Link href="/tin-tuc" className={s.link}>
                                <span>Tất cả tin tức</span>
                                <Icon name="arrow" size={16} />
                            </Link>
                        }
                    />

                    <div className={s.newsLayout}>
                        {lead && (
                            <div className={s.newsFeaturedCol}>
                                <NewsCard n={lead} big />
                            </div>
                        )}

                        <div className={s.newsSubListCol}>
                            {rest.slice(0, 2).map((n) => (
                                <NewsCard key={n.id} n={n} />
                            ))}
                        </div>

                        <aside className={s.eventsSideCol} aria-label="Sự kiện sắp tới">
                            <div className={s.eventsBox}>
                                <h3 className={s.eventsHeading}>
                                    <Icon name="calendar" size={18} />
                                    <span>Lịch trình & Sự kiện</span>
                                </h3>
                                {ev.data.items.length === 0 ? (
                                    <div className={s.upcomingSimple}>
                                        <div className={s.eventRow}>
                                            <div className={s.eventCalBadge}>
                                                <b>15</b>
                                                <span>Th11</span>
                                            </div>
                                            <div>
                                                <h4>Hội thi Văn nghệ Chào mừng Ngày Nhà giáo Việt Nam 20/11</h4>
                                                <small>Hội trường lớn trường THPT Ngô Sĩ Liên</small>
                                            </div>
                                        </div>
                                        <div className={s.eventRow}>
                                            <div className={s.eventCalBadge}>
                                                <b>28</b>
                                                <span>Th11</span>
                                            </div>
                                            <div>
                                                <h4>Ngày hội STEM & Sáng tạo KHKT học sinh cấp trường</h4>
                                                <small>Sân trường & Khu thực hành STEM</small>
                                            </div>
                                        </div>
                                        <div className={s.eventRow}>
                                            <div className={s.eventCalBadge}>
                                                <b>10</b>
                                                <span>Th12</span>
                                            </div>
                                            <div>
                                                <h4>Diễn đàn Hướng nghiệp & Định hướng Đại học cho học sinh Khối 12</h4>
                                                <small>Phối hợp cùng Đại học Bách Khoa & ĐHQG</small>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <ul className={s.eventsList}>
                                        {ev.data.items.map((e) => {
                                            const [, m, d] = (e.event_date ?? '').split('-');
                                            return (
                                                <li key={e.id} className={s.eventRow}>
                                                    <time dateTime={e.event_date ?? ''} className={s.eventCalBadge}>
                                                        <b>{d}</b>
                                                        <span>Th{Number(m)}</span>
                                                    </time>
                                                    <div>
                                                        <h4><Link href={`/tin-tuc/${e.slug}`}>{e.title}</Link></h4>
                                                        {e.event_place && <small>{e.event_place} · {fmtDate(e.event_date)}</small>}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </aside>
                    </div>
                </div>
            </section>

            {/* 13. QUY TRÌNH TUYỂN SINH 4 BƯỚC ĐƠN GIẢN */}
            <section className={`${s.section} ${s.sectionTint}`}>
                <div className={s.container}>
                    <SectionHead
                        center
                        title="Quy trình tuyển sinh & Nhập học trong 4 bước"
                        desc="Nhà trường tối ưu hóa quy trình tiếp nhận hồ sơ xét tuyển trực tuyến, nhanh chóng, chính xác và thuận tiện nhất cho quý phụ huynh."
                        action={
                            <Link href="/tuyen-sinh" className={`${s.btn} ${s.btnHot}`}>
                                <span>Xem hồ sơ & chỉ tiêu chi tiết</span>
                                <Icon name="arrow" size={16} />
                            </Link>
                        }
                    />

                    <div className={s.stepsModernGrid}>
                        {ADMISSION_STEPS.map((x, i) => (
                            <div key={x.title} className={s.stepCard}>
                                <div className={s.stepNumber}>{x.step || `0${i + 1}`}</div>
                                <h3 className={s.stepTitle}>{x.title}</h3>
                                <p className={s.stepText}>{x.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 14. CỔNG THÔNG TIN SỐ HÓA TRƯỜNG HỌC 4.0 */}
            <section className={s.section}>
                <div className={`${s.container} ${s.portalSplit}`}>
                    <div className={s.portalInfoCol}>
                        <div className={s.kickerPill}>
                            <span className={s.kickerDot}></span>
                            <span>Hệ thống chuyển đổi số toàn diện</span>
                        </div>
                        <h2 className={s.h2Title}>Cổng thông tin trực tuyến dành cho Gia đình & Nhà trường</h2>
                        <p className={s.aboutP}>
                            Mọi việc học tập, điểm thi và học phí được quản lý đồng bộ trên một nền tảng số bảo mật. Phụ huynh đồng hành cùng con mọi lúc, mọi nơi ngay trên smartphone.
                        </p>

                        <div className={s.portalFeatures}>
                            {PORTAL.map(([title, desc]) => (
                                <div key={title} className={s.portalFeatItem}>
                                    <div className={s.portalFeatIcon}>
                                        <Icon name="check" size={18} />
                                    </div>
                                    <div>
                                        <h4>{title}</h4>
                                        <p>{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={s.portalBtns}>
                            <Link href="/login/student" className={`${s.btn} ${s.btnPri} ${s.btnLg}`}>
                                <span>Đăng nhập Cổng Học sinh</span>
                                <Icon name="arrow" size={16} />
                            </Link>
                            <Link href="/login/teacher" className={`${s.btn} ${s.btnLine} ${s.btnLg}`}>
                                <span>Đăng nhập Cổng Giáo viên</span>
                            </Link>
                        </div>
                    </div>

                    <div className={s.portalVisualCol}>
                        <div className={s.portalPicWrap}>
                            <ImageSlot
                                src={IMG.portal}
                                alt="Học sinh sử dụng cổng thông tin số hóa"
                                tone="a"
                                className={s.portalImg}
                            />
                            <div className={s.portalBadge}>
                                <Icon name="monitor" size={24} />
                                <div>
                                    <b>Quản lý minh bạch 100%</b>
                                    <span>Tra cứu kết quả học tập & nộp học phí online</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 15. HỎI ĐÁP THƯỜNG GẶP (FAQ ACCORDION) */}
            <section className={`${s.section} ${s.sectionTint}`}>
                <div className={`${s.container} ${s.faqContainer}`}>
                    <SectionHead
                        center
                        title="Câu hỏi thường gặp về Tuyển sinh & Đào tạo"
                        desc="Giải đáp nhanh các thắc mắc phổ biến nhất của phụ huynh và các em học sinh chuẩn bị bước vào lớp 10."
                    />
                    <Faq />
                </div>
            </section>

            {/* 16. CALL TO ACTION BANNER TUYỂN SINH CUỐI TRANG */}
            <AdmitBand />
        </div>
    );
}
