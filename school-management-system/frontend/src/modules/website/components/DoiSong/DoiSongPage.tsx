import Link from 'next/link';
import s from './DoiSong.module.css';
import ImageSlot from '../ImageSlot';
import Icon from '../Icons';
import ClubTabs from './ClubTabs';
import {
    DS_CARE, DS_CLUBS, DS_CTA, DS_DAY, DS_HERO, DS_IMG, DS_INTRO, DS_RULES, DS_VOICES, DS_YEAR,
} from './doi-song.data';

/** Trang Đời sống học đường: giao diện ở file này, lời văn ở doi-song.data.ts, tab câu lạc bộ ở ClubTabs.tsx, màu và bố cục ở DoiSong.module.css. */
function Head({ eyebrow, title, desc }: { eyebrow?: string; title: string; desc?: string }) {
    return (
        <div className={s.head}>
            {eyebrow && <span className={s.eyebrow}>{eyebrow}</span>}
            <h2>{title}</h2>
            {desc && <p>{desc}</p>}
        </div>
    );
}

export default function DoiSongPage() {
    const sample = DS_VOICES.items.some((v) => v.sample);
    return (
        <div className={s.page}>
            {/* 1. ĐẦU TRANG: các thẻ nhỏ bồng bềnh bên phải */}
            <section className={s.hero}>
                <ImageSlot src={DS_IMG.hero} fallback="/images/hero-chung.jpg" alt="" tone="a" className={s.heroBg} hint={false} eager />
                <div className={s.heroShade} />
                <ul className={s.floats} aria-hidden="true">
                    {DS_HERO.chips.map((c, k) => <li key={c} className={s[`f${k + 1}`]}>{c}</li>)}
                </ul>
                <div className={`${s.container} ${s.heroIn}`}>
                    <nav className={s.crumb} aria-label="Đường dẫn">
                        <Link href="/">Trang chủ</Link><span aria-hidden="true">›</span><b aria-current="page">Đời sống học đường</b>
                    </nav>
                    <span className={s.eyebrow}>{DS_HERO.eyebrow}</span>
                    <h1>{DS_HERO.title}</h1>
                    <p>{DS_HERO.intro}</p>
                    <div className={s.heroBtns}>
                        <a href="#cau-lac-bo" className={`${s.btn} ${s.btnHot}`}>Khám phá câu lạc bộ</a>
                        <Link href="/lien-he" className={`${s.btn} ${s.btnGhost}`}>Đặt lịch tham quan</Link>
                    </div>
                </div>
            </section>

            <div className={s.container}>
                <ul className={s.facts}>
                    {DS_HERO.facts.map((f) => <li key={f.big}><Icon name={f.icon} size={26} /><span><b>{f.big}</b>{f.small}</span></li>)}
                </ul>
            </div>

            {/* 2. TRIẾT LÝ + TRÍCH DẪN */}
            <section className={s.section}>
                <div className={`${s.container} ${s.two}`}>
                    <figure className={s.bigQuote}>
                        <span className={s.eyebrow}>{DS_INTRO.eyebrow}</span>
                        <blockquote>{DS_INTRO.quote}</blockquote>
                    </figure>
                    <div>{DS_INTRO.paras.map((p) => <p key={p.slice(0, 20)} className={s.body}>{p}</p>)}</div>
                </div>
            </section>

            {/* 3. MỘT NGÀY Ở TRƯỜNG */}
            <section className={`${s.section} ${s.tint}`}>
                <div className={`${s.container} ${s.dayWrap}`}>
                    <div className={s.daySide}>
                        <span className={s.eyebrow}>Lịch trong ngày</span>
                        <h2 className={s.h2}>{DS_DAY.title}</h2>
                        <p className={s.body}>{DS_DAY.desc}</p>
                    </div>
                    <ol className={s.day}>
                        {DS_DAY.items.map((d) => (
                            <li key={d.time}>
                                <time>{d.time}</time>
                                <div><h3>{d.title}</h3><p>{d.text}</p></div>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* 4. CÂU LẠC BỘ */}
            <section className={s.section} id="cau-lac-bo">
                <div className={s.container}>
                    <Head eyebrow="Ngoài giờ học" title={DS_CLUBS.title} desc={DS_CLUBS.desc} />
                    <ClubTabs />
                </div>
            </section>

            {/* 5. CẢ NĂM HỌC */}
            <section className={`${s.section} ${s.tint}`}>
                <div className={s.container}>
                    <Head eyebrow="Trong năm học" title={DS_YEAR.title} desc={DS_YEAR.desc} />
                    <p className={s.note}>{DS_YEAR.note}</p>
                    <ol className={s.year}>
                        {DS_YEAR.items.map((y) => (
                            <li key={y.title}><span>{y.month}</span><h3>{y.title}</h3><p>{y.text}</p></li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* 6. ĂN UỐNG VÀ SỨC KHỎE */}
            <section className={s.section}>
                <div className={`${s.container} ${s.two} ${s.twoFlip}`}>
                    <ImageSlot src={DS_IMG.meal} alt="Bữa trưa bán trú của học sinh" tone="d" className={s.photo} />
                    <div>
                        <span className={s.eyebrow}>{DS_CARE.eyebrow}</span>
                        <h2 className={s.h2}>{DS_CARE.title}</h2>
                        <p className={s.body}>{DS_CARE.text}</p>
                        <ul className={s.care}>
                            {DS_CARE.points.map((p) => (
                                <li key={p.title}><Icon name="check" size={18} /><div><b>{p.title}</b><span>{p.text}</span></div></li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            {/* 7. KHÔNG GIAN */}
            <section className={`${s.section} ${s.tint}`}>
                <div className={s.container}>
                    <Head eyebrow="Không gian" title="Những nơi các em gắn bó" desc="Mỗi góc trường là một ký ức của tuổi học trò." />
                    <div className={s.space}>
                        {DS_IMG.space.map((p, k) => (
                            <figure key={p.title}>
                                <ImageSlot src={p.src} alt={p.title} tone={['a', 'b', 'c', 'd'][k % 4]} className={s.spaceImg} hint={false} />
                                <figcaption><b>{p.title}</b><span>{p.text}</span></figcaption>
                            </figure>
                        ))}
                    </div>
                </div>
            </section>

            {/* 8. NỀN NẾP */}
            <section className={s.section}>
                <div className={s.container}>
                    <Head eyebrow="Nền nếp" title={DS_RULES.title} desc={DS_RULES.desc} />
                    <div className={s.rules}>
                        {DS_RULES.items.map((r) => (
                            <article key={r.title}><span className={s.ic}><Icon name={r.icon} size={22} /></span><h3>{r.title}</h3><p>{r.text}</p></article>
                        ))}
                    </div>
                </div>
            </section>

            {/* 9. LỜI TRÍCH DẪN */}
            <section className={s.voices}>
                <div className={s.container}>
                    <div className={`${s.head} ${s.headLight}`}>
                        <span className={s.eyebrow}>Chia sẻ</span>
                        <h2>{DS_VOICES.title}</h2>
                        <p>{sample ? 'Nội dung mẫu để minh họa bố cục. Nhà trường thay bằng chia sẻ thật trong doi-song.data.ts.' : DS_VOICES.desc}</p>
                    </div>
                    <div className={s.quotes}>
                        {DS_VOICES.items.map((v) => (
                            <figure key={v.who} className={s.quote}>
                                <blockquote>{v.text}</blockquote>
                                <figcaption>{v.who}{v.sample && <em>Nội dung mẫu</em>}</figcaption>
                            </figure>
                        ))}
                    </div>
                </div>
            </section>

            {/* 10. KÊU GỌI */}
            <section className={s.ctaWrap}>
                <div className={s.container}>
                    <div className={s.cta}>
                        <div><h2>{DS_CTA.title}</h2><p>{DS_CTA.text}</p></div>
                        <div className={s.ctaBtns}>
                            <Link href="/lien-he" className={`${s.btn} ${s.btnWhite}`}>Đặt lịch tham quan</Link>
                            <Link href="/tuyen-sinh#dang-ky" className={`${s.btn} ${s.btnGhost}`}>Đăng ký nhập học</Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}