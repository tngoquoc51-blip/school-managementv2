import Link from 'next/link';
import s from './site.module.css';
import HeroSlider from './components/HeroSlider';
import ImageSlot from './components/ImageSlot';
import CountUp from './components/CountUp';
import Icon from './components/Icons';
import { AdmitBand, Faq, NewsCard, SectionHead } from './components/Parts';
import { load, fmtDate, type NewsItem, type NewsList, type Overview } from './lib/api';
import {
    ABOUT, ADMISSION_STEPS, CLUBS, CLUB_COUNT, DAY, FALLBACK_OVERVIEW, GALLERY, IMG, NEWS_FALLBACK, PORTAL, PROGRAMS, SCHOOL, STAFF, TESTIMONIALS, WHY,
} from './data/school';

/** Trang chủ kiểu "trang giới thiệu bán hàng": banner ảnh lớn, lý do chọn trường, chương trình, thư viện ảnh,
 số liệu thật, phản hồi, tin tức, quy trình tuyển sinh. Ảnh đặt trong public/images (xem data/school.ts). */
export default async function HomePage() {
    const [ov, nw, ev] = await Promise.all([
        load<Overview>('overview', FALLBACK_OVERVIEW, 300),
        load<NewsList>('news?per_page=4', { items: NEWS_FALLBACK as NewsItem[], total: 2, page: 1, pages: 1, per_page: 4, categories: [] }),
        load<{ items: NewsItem[] }>('events?limit=4', { items: [] }),
    ]);
    const o = ov.data;
    const [lead, ...rest] = nw.data.items;
    const groups = Array.from(new Set(CLUBS.map((c) => c.group)));
    const sample = TESTIMONIALS.some((t) => t.sample);

    return (
        <>
            <HeroSlider />

            {/* ---------- Dải lợi ích nhanh ---------- */}
            <section className={s.perks} aria-label="Điểm nổi bật">
                <div className={`${s.container} ${s.perksGrid}`}>
                    <Link href="/chuong-trinh"><Icon name="book" size={26} /><span><b>Chương trình 2018</b>Hai tổ hợp môn, chọn theo năng lực</span></Link>
                    <Link href="/he-thong"><Icon name="monitor" size={26} /><span><b>Cổng thông tin</b>Điểm, học phí, thông báo trên điện thoại</span></Link>
                    <Link href="/doi-song"><Icon name="spark" size={26} /><span><b>Hơn {CLUB_COUNT} câu lạc bộ</b>Thể thao, nghệ thuật, học thuật</span></Link>
                    <Link href="/tuyen-sinh/tra-cuu"><Icon name="search" size={26} /><span><b>Tra cứu hồ sơ</b>Biết ngay tiến độ tuyển sinh</span></Link>
                </div>
            </section>

            {/* ---------- Giới thiệu ---------- */}
            <section className={s.section}>
                <div className={`${s.container} ${s.aboutGrid}`}>
                    <div className={s.aboutPics}>
                        <ImageSlot src={IMG.about} alt="Thầy cô và học sinh trường" tone="a" className={s.aboutImg} />
                        <p className={s.badge}><b><CountUp to={o.students} /></b>học sinh năm học {o.school_year ?? SCHOOL.schoolYear}</p>
                    </div>
                    <div>
                        <h2 className={s.h2}>{ABOUT.title}</h2>
                        {ABOUT.paras.map((p) => <p key={p.slice(0, 24)} className={s.body}>{p}</p>)}
                        <ul className={s.ticks}>{ABOUT.bullets.map((b) => <li key={b}><Icon name="check" size={18} />{b}</li>)}</ul>
                        <div className={s.row}><Link href="/gioi-thieu" className={`${s.btn} ${s.btnPri}`}>Đọc thêm về trường</Link><Link href="/lien-he" className={`${s.btn} ${s.btnLine}`}>Đặt lịch tham quan</Link></div>
                    </div>
                </div>
            </section>

            {/* ---------- Vì sao chọn ---------- */}
            <section className={`${s.section} ${s.sectionTint}`}>
                <div className={s.container}>
                    <SectionHead title="Vì sao phụ huynh chọn THPT Ngô Sỹ Liên" desc="Sáu điều chúng tôi cam kết làm tốt mỗi ngày, từ lớp học đến cổng thông tin gia đình." />
                    <div className={s.whyGrid}>
                        {WHY.map((w) => (
                            <article key={w.title} className={s.why}>
                                <span className={s.whyIc}><Icon name={w.icon} size={28} /></span>
                                <h3>{w.title}</h3>
                                <p>{w.text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* ---------- Chương trình dạng ảnh ---------- */}
            <section className={s.section}>
                <div className={s.container}>
                    <SectionHead title="Chọn hướng học phù hợp với con" desc="Học sinh học các môn chung và chọn tổ hợp môn từ lớp 10, có giáo viên chủ nhiệm tư vấn trước khi quyết định." action={<Link href="/chuong-trinh" className={s.link}>Xem chi tiết chương trình<Icon name="arrow" size={18} /></Link>} />
                    <div className={s.catGrid}>
                        {PROGRAMS.map((p, k) => (
                            <Link key={p.key} href="/chuong-trinh" className={s.cat}>
                                <ImageSlot src={k === 0 ? IMG.tn : IMG.xh} alt={p.title} tone={p.tone} className={s.catImg} />
                                <div className={s.catShade} />
                                <div className={s.catBody}>
                                    <h3>{p.title}</h3>
                                    <p>{p.text}</p>
                                    <ul className={s.chipsW}>{p.subjects.slice(0, 5).map((x) => <li key={x}>{x}</li>)}</ul>
                                    <span className={s.catGo}>Tìm hiểu<Icon name="arrow" size={18} /></span>
                                </div>
                            </Link>
                        ))}
                        <Link href="/chuong-trinh" className={`${s.cat} ${s.catWide}`}>
                            <ImageSlot src={IMG.exp} alt="Hoạt động trải nghiệm và hướng nghiệp" tone="c" className={s.catImg} />
                            <div className={s.catShade} />
                            <div className={s.catBody}>
                                <h3>Trải nghiệm và hướng nghiệp</h3>
                                <p>STEM, dự án nhóm, kỹ năng sống và tư vấn chọn ngành. Các em hiểu bản thân trước khi chọn con đường cho mình.</p>
                                <span className={s.catGo}>Tìm hiểu<Icon name="arrow" size={18} /></span>
                            </div>
                        </Link>
                    </div>
                </div>
            </section>

            {/* ---------- Số liệu trên nền ảnh ---------- */}
            <section className={s.statsBand} aria-label="Nhà trường qua các con số">
                <ImageSlot src={IMG.stats} alt="" tone="d" className={s.statsBg} hint={false} />
                <div className={s.statsShade} />
                <div className={`${s.container} ${s.statsIn}`}>
                    <h2>Nhà trường năm học {o.school_year ?? SCHOOL.schoolYear}</h2>
                    <dl className={s.statsRow}>
                        <div><dt>Lớp học</dt><dd><CountUp to={o.classes} /></dd></div>
                        <div><dt>Học sinh</dt><dd><CountUp to={o.students} /></dd></div>
                        <div><dt>Giáo viên</dt><dd><CountUp to={o.teachers} /></dd></div>
                        <div><dt>Môn học</dt><dd><CountUp to={o.subjects} /></dd></div>
                        <div><dt>Câu lạc bộ</dt><dd><CountUp to={CLUB_COUNT} suffix="+" /></dd></div>
                    </dl>
                    <p className={s.statsNote}>Số liệu lấy trực tiếp từ hệ thống quản lý học sinh của nhà trường.</p>
                </div>
            </section>

            {/* ---------- Thư viện ảnh ---------- */}
            <section className={s.section}>
                <div className={s.container}>
                    <SectionHead title="Không gian học tập" desc="Những nơi các em dành phần lớn thời gian ở trường: phòng học, phòng thí nghiệm, thư viện, sân chơi." action={<Link href="/doi-song" className={s.link}>Xem đời sống học đường<Icon name="arrow" size={18} /></Link>} />
                    <div className={s.gallery}>
                        {GALLERY.map((g, k) => (
                            <figure key={g.title} className={`${s.shot} ${g.size === 'big' ? s.shotBig : g.size === 'tall' ? s.shotTall : ''}`}>
                                <ImageSlot src={g.img} alt={g.title} tone={['a', 'b', 'c', 'd'][k % 4]} className={s.shotImg} hint={false} />
                                <figcaption><b>{g.title}</b><span>{g.text}</span></figcaption>
                            </figure>
                        ))}
                    </div>
                </div>
            </section>

            {/* ---------- Đội ngũ ---------- */}
            <section className={`${s.section} ${s.sectionTint}`}>
                <div className={`${s.container} ${s.aboutGrid} ${s.aboutFlip}`}>
                    <div>
                        <h2 className={s.h2}>{STAFF.title}</h2>
                        <p className={s.body}>{STAFF.text}</p>
                        <ul className={s.ticks}>{STAFF.points.map((b) => <li key={b}><Icon name="check" size={18} />{b}</li>)}</ul>
                        <p className={s.body}><b><CountUp to={o.teachers} /></b> giáo viên đang giảng dạy tại trường năm học này.</p>
                    </div>
                    <div className={s.aboutPics}><ImageSlot src={IMG.staff} alt="Đội ngũ giáo viên của trường" tone="b" className={s.aboutImg} /></div>
                </div>
            </section>

            {/* ---------- Một ngày ở trường + câu lạc bộ ---------- */}
            <section className={s.section}>
                <div className={`${s.container} ${s.split} ${s.splitFlip}`}>
                    <div>
                        <h2 className={s.h2}>Một ngày ở trường</h2>
                        <p className={s.lead}>Giờ giấc rõ ràng, có thời gian học và thời gian sống. Học sinh vừa học tốt, vừa có chỗ để chơi và thử sức.</p>
                        <h3 className={s.h3s}>Câu lạc bộ</h3>
                        {groups.map((g) => <p key={g} className={s.clubLine}><b>{g}:</b> {CLUBS.filter((c) => c.group === g).map((c) => c.name).join(', ')}</p>)}
                    </div>
                    <ol className={s.day}>{DAY.map(([t, h, d]) => <li key={t}><time>{t}</time><div><h3>{h}</h3><p>{d}</p></div></li>)}</ol>
                </div>
            </section>

            {/* ---------- Phản hồi ---------- */}
            <section className={`${s.section} ${s.sectionTint}`}>
                <div className={s.container}>
                    <SectionHead title="Phụ huynh và học sinh nói gì" desc={sample ? 'Nội dung mẫu để minh họa bố cục. Nhà trường thay bằng chia sẻ thật trong data/school.ts.' : undefined} />
                    <div className={s.quotes}>
                        {TESTIMONIALS.map((t) => (
                            <figure key={t.who} className={s.quote}>
                                <blockquote>{t.text}</blockquote>
                                <figcaption>{t.who}{t.sample && <em>Nội dung mẫu</em>}</figcaption>
                            </figure>
                        ))}
                    </div>
                </div>
            </section>

            {/* ---------- Tin tức ---------- */}
            <section className={s.section}>
                <div className={s.container}>
                    <SectionHead title="Tin tức và sự kiện" action={<Link href="/tin-tuc" className={s.link}>Tất cả tin tức<Icon name="arrow" size={18} /></Link>} />
                    <div className={s.newsGrid}>
                        {lead && <NewsCard n={lead} big />}
                        <div className={s.newsSide}>{rest.slice(0, 2).map((n) => <NewsCard key={n.id} n={n} />)}</div>
                        <aside className={s.events} aria-label="Sự kiện sắp tới">
                            <h3>Sắp diễn ra</h3>
                            {ev.data.items.length === 0 ? <p className={s.muted}>Chưa có sự kiện nào được lên lịch.</p> : (
                                <ul>{ev.data.items.map((e) => {
                                    const [, m, d] = (e.event_date ?? '').split('-');
                                    return (
                                        <li key={e.id}>
                                            <time dateTime={e.event_date ?? ''} className={s.cal}><b>{d}</b><span>Th{Number(m)}</span></time>
                                            <div><Link href={`/tin-tuc/${e.slug}`}>{e.title}</Link>{e.event_place && <small>{e.event_place} · {fmtDate(e.event_date)}</small>}</div>
                                        </li>
                                    );
                                })}</ul>
                            )}
                        </aside>
                    </div>
                </div>
            </section>

            {/* ---------- Quy trình tuyển sinh ---------- */}
            <section className={`${s.section} ${s.sectionTint}`}>
                <div className={s.container}>
                    <SectionHead title="Nhập học chỉ trong bốn bước" desc="Đăng ký trực tuyến trước để nhà trường tư vấn sớm. Hồ sơ bản giấy nộp theo lịch hẹn." action={<Link href="/tuyen-sinh" className={s.link}>Xem hướng dẫn tuyển sinh<Icon name="arrow" size={18} /></Link>} />
                    <ol className={s.steps}>
                        {ADMISSION_STEPS.map((x, i) => <li key={x.title}><span>{i + 1}</span><h3>{x.title}</h3><p>{x.text}</p></li>)}
                    </ol>
                </div>
            </section>

            {/* ---------- Cổng thông tin ---------- */}
            <section className={`${s.section} ${s.portalSec}`}>
                <div className={`${s.container} ${s.aboutGrid}`}>
                    <div>
                        <h2 className={s.h2}>Cổng thông tin cho học sinh và giáo viên</h2>
                        <p className={s.lead}>Mọi việc học tập và học phí nằm trên một hệ thống. Học sinh đăng nhập bằng tài khoản do nhà trường cấp.</p>
                        <ul className={s.portalList}>{PORTAL.map(([t, d]) => <li key={t}><Icon name="check" size={20} /><div><h3>{t}</h3><p>{d}</p></div></li>)}</ul>
                        <div className={s.row}><Link href="/login/student" className={`${s.btn} ${s.btnPri}`}>Học sinh đăng nhập</Link><Link href="/login/teacher" className={`${s.btn} ${s.btnLine}`}>Giáo viên đăng nhập</Link></div>
                    </div>
                    <div className={s.aboutPics}><ImageSlot src={IMG.portal} alt="Học sinh xem điểm trên điện thoại" tone="a" className={s.aboutImg} /></div>
                </div>
            </section>

            <section className={s.section}>
                <div className={`${s.container} ${s.narrow}`}>
                    <SectionHead title="Câu hỏi thường gặp" />
                    <Faq />
                </div>
            </section>

            <AdmitBand />
        </>
    );
}