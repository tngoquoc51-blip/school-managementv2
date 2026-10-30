import Link from 'next/link';
import s from '@/modules/website/site.module.css';
import Hero from '@/modules/website/components/Hero';
import Icon from '@/modules/website/components/Icons';
import { AdmitBand, Faq, GradeBars, NewsCard, SectionHead } from '@/modules/website/components/Parts';
import { load, fmtDate, type NewsList, type Overview, type NewsItem } from '@/modules/website/lib/api';
import { CLUB_COUNT, DAY, FACILITIES, FALLBACK_OVERVIEW, NEWS_FALLBACK, PILLARS, PORTAL, PROGRAMS, SCHOOL } from '@/modules/website/data/school';

export default async function SiteHome() {
    const [ov, nw, ev] = await Promise.all([
        load<Overview>('overview', FALLBACK_OVERVIEW, 300),
        load<NewsList>('news?per_page=4', { items: NEWS_FALLBACK as NewsItem[], total: 2, page: 1, pages: 1, per_page: 4, categories: [] }),
        load<{ items: NewsItem[] }>('events?limit=4', { items: [] }),
    ]);
    const o = ov.data;
    const [lead, ...rest] = nw.data.items;

    return (
        <>
            {/* ---------- Hero ---------- */}
            <section className={s.hero}>
                <div className={`${s.container} ${s.heroGrid}`}>
                    <div className={s.heroText}>
                        <p className={s.heroKicker}>{SCHOOL.fullName} · Chương trình GDPT 2018</p>
                        <h1>Học thật vững để bay thật xa</h1>
                        <p className={s.heroLead}>{SCHOOL.intro}</p>
                        <div className={s.row}>
                            <Link href="/tuyen-sinh#dang-ky" className={`${s.btn} ${s.btnHot} ${s.btnLg}`}>Đăng ký nhập học</Link>
                            <Link href="/he-thong" className={`${s.btn} ${s.btnLine} ${s.btnLg}`}>Vào cổng thông tin</Link>
                        </div>
                        <ul className={s.facts}>
                            <li><Icon name="check" size={18} />Xem điểm, học phí, thời khóa biểu trực tuyến</li>
                            <li><Icon name="check" size={18} />{o.classes} lớp, {o.students.toLocaleString('vi-VN')} học sinh, hơn {CLUB_COUNT} câu lạc bộ</li>
                        </ul>
                    </div>
                    <Hero year={o.school_year} />
                </div>
            </section>

            {/* ---------- Lối vào nhanh ---------- */}
            <section className={s.quick} aria-label="Truy cập nhanh">
                <div className={`${s.container} ${s.quickGrid}`}>
                    <Link href="/login/student"><Icon name="user" /><span><b>Học sinh</b>Đăng nhập xem điểm, học phí</span><Icon name="chevron" size={18} /></Link>
                    <Link href="/login/teacher"><Icon name="teacher" /><span><b>Giáo viên</b>Điểm danh, nhập điểm, sổ đầu bài</span><Icon name="chevron" size={18} /></Link>
                    <Link href="/tuyen-sinh#dang-ky"><Icon name="spark" /><span><b>Đăng ký nhập học</b>Lớp 10 năm học {SCHOOL.admissionYear}</span><Icon name="chevron" size={18} /></Link>
                    <Link href="/tuyen-sinh/tra-cuu"><Icon name="search" /><span><b>Tra cứu hồ sơ</b>Bằng mã hồ sơ và số điện thoại</span><Icon name="chevron" size={18} /></Link>
                </div>
            </section>

            {/* ---------- Nhà trường hôm nay ---------- */}
            <section className={s.section}>
                <div className={`${s.container} ${s.split}`}>
                    <div>
                        <h2 className={s.h2}>Nhà trường hôm nay</h2>
                        <p className={s.lead}>Năm học {o.school_year ?? SCHOOL.schoolYear}, trường có ba khối với quy mô như bên cạnh. Số liệu lấy trực tiếp từ hệ thống quản lý học sinh, nên luôn khớp với sổ sách của nhà trường.</p>
                        <ul className={s.pillars}>
                            {PILLARS.map((p) => <li key={p.title}><h3>{p.title}</h3><p>{p.text}</p></li>)}
                        </ul>
                        <p><Link href="/gioi-thieu" className={s.link}>Đọc về nhà trường<Icon name="arrow" size={18} /></Link></p>
                    </div>
                    <GradeBars o={o} />
                </div>
            </section>

            {/* ---------- Chương trình ---------- */}
            <section className={`${s.section} ${s.sectionTint}`}>
                <div className={s.container}>
                    <SectionHead title="Hai hướng học, một nền tảng chung" desc="Học sinh học các môn chung và chọn tổ hợp môn phù hợp từ lớp 10, theo Chương trình Giáo dục phổ thông 2018." action={<Link href="/chuong-trinh" className={s.link}>Xem chương trình<Icon name="arrow" size={18} /></Link>} />
                    <div className={s.tracks}>
                        {PROGRAMS.map((p) => (
                            <article key={p.key} className={`${s.track_} ${s['tone_' + p.tone]}`}>
                                <h3>{p.title}</h3>
                                <p>{p.text}</p>
                                <ul className={s.chips}>{p.subjects.map((x) => <li key={x}>{x}</li>)}</ul>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* ---------- Một ngày ở trường ---------- */}
            <section className={s.section}>
                <div className={`${s.container} ${s.split} ${s.splitFlip}`}>
                    <div>
                        <h2 className={s.h2}>Một ngày ở trường</h2>
                        <p className={s.lead}>Giờ giấc rõ ràng, có thời gian học và thời gian sống. Học sinh vừa học tốt vừa có chỗ để chơi và thử sức.</p>
                        <p><Link href="/doi-song" className={s.link}>Xem đời sống học đường<Icon name="arrow" size={18} /></Link></p>
                    </div>
                    <ol className={s.day}>
                        {DAY.map(([t, h, d]) => <li key={t}><time>{t}</time><div><h3>{h}</h3><p>{d}</p></div></li>)}
                    </ol>
                </div>
            </section>

            {/* ---------- Cơ sở vật chất ---------- */}
            <section className={`${s.section} ${s.sectionTint}`}>
                <div className={s.container}>
                    <SectionHead title="Nơi các em học và chơi" desc="Cơ sở vật chất phục vụ cả giờ học trên lớp lẫn hoạt động ngoài giờ." />
                    <div className={s.bento}>
                        {FACILITIES.map((f) => (
                            <article key={f.title} className={`${s.bentoItem} ${f.size === 'lg' ? s.bentoLg : f.size === 'wide' ? s.bentoWide : ''}`}>
                                <span className={s.bentoIc}><Icon name={f.icon} size={26} /></span>
                                <h3>{f.title}</h3>
                                <p>{f.text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* ---------- Tin tức và sự kiện ---------- */}
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
                                    const [y, m, d] = (e.event_date ?? '').split('-');
                                    return (
                                        <li key={e.id}>
                                            <time dateTime={e.event_date ?? ''} className={s.cal}><b>{d}</b><span>Th{Number(m)}</span></time>
                                            <div><Link href={`/tin-tuc/${e.slug}`}>{e.title}</Link>{e.event_place && <small>{e.event_place} · {fmtDate(e.event_date)}</small>}</div>
                                            <span hidden>{y}</span>
                                        </li>
                                    );
                                })}</ul>
                            )}
                        </aside>
                    </div>
                </div>
            </section>

            {/* ---------- Cổng thông tin ---------- */}
            <section className={`${s.section} ${s.portal}`}>
                <div className={`${s.container} ${s.split}`}>
                    <div>
                        <h2 className={s.h2}>Cổng thông tin cho học sinh và giáo viên</h2>
                        <p className={s.lead}>Mọi việc học tập và học phí nằm trên một hệ thống. Học sinh đăng nhập bằng tài khoản do nhà trường cấp.</p>
                        <div className={s.row}>
                            <Link href="/login/student" className={`${s.btn} ${s.btnPri}`}>Học sinh đăng nhập</Link>
                            <Link href="/login/teacher" className={`${s.btn} ${s.btnLine}`}>Giáo viên đăng nhập</Link>
                        </div>
                    </div>
                    <ul className={s.portalList}>
                        {PORTAL.map(([t, d]) => <li key={t}><Icon name="check" size={20} /><div><h3>{t}</h3><p>{d}</p></div></li>)}
                    </ul>
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