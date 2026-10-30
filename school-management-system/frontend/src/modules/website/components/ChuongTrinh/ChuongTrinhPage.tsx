import Link from 'next/link';
import s from './ChuongTrinh.module.css';
import ImageSlot from '../ImageSlot';
import Icon from '../Icons';
import {
    CT_ASSESS, CT_CHOOSE, CT_CTA, CT_EXPERIENCE, CT_FAQ, CT_HERO, CT_IMG, CT_OVERVIEW, CT_STRUCTURE, CT_SUPPORT, CT_TRACKS, CT_YEARS,
} from './chuong-trinh.data';

/** Trang Chương trình học: giao diện ở file này, lời văn ở chuong-trinh.data.ts, màu và bố cục ở ChuongTrinh.module.css. */
function Head({ eyebrow, title, desc }: { eyebrow?: string; title: string; desc?: string }) {
    return (
        <div className={s.head}>
            {eyebrow && <span className={s.eyebrow}>{eyebrow}</span>}
            <h2>{title}</h2>
            {desc && <p>{desc}</p>}
        </div>
    );
}

export default function ChuongTrinhPage() {
    return (
        <div className={s.page}>
            {/* 1. ĐẦU TRANG */}
            <section className={s.hero}>
                <ImageSlot src={CT_IMG.hero} fallback="/images/hero-chung.jpg" alt="" tone="a" className={s.heroBg} hint={false} eager />
                <div className={s.heroShade} />
                <div className={`${s.container} ${s.heroIn}`}>
                    <nav className={s.crumb} aria-label="Đường dẫn">
                        <Link href="/">Trang chủ</Link><span aria-hidden="true">›</span><b aria-current="page">Chương trình</b>
                    </nav>
                    <span className={s.eyebrow}>{CT_HERO.eyebrow}</span>
                    <h1>{CT_HERO.title}</h1>
                    <p>{CT_HERO.intro}</p>
                    <div className={s.heroBtns}>
                        <Link href="/lien-he" className={`${s.btn} ${s.btnHot}`}>Nhận tư vấn tổ hợp môn</Link>
                        <Link href="/tuyen-sinh" className={`${s.btn} ${s.btnGhost}`}>Xem tuyển sinh</Link>
                    </div>
                </div>
            </section>

            <div className={s.container}>
                <ul className={s.facts}>
                    {CT_HERO.facts.map((f) => <li key={f.big}><Icon name={f.icon} size={26} /><span><b>{f.big}</b>{f.small}</span></li>)}
                </ul>
            </div>

            {/* 2. TỔNG QUAN + 3 NĂM */}
            <section className={s.section}>
                <div className={s.container}>
                    <div className={s.two}>
                        <div>
                            <span className={s.eyebrow}>{CT_OVERVIEW.eyebrow}</span>
                            <h2 className={s.h2}>{CT_OVERVIEW.title}</h2>
                        </div>
                        <div>{CT_OVERVIEW.paras.map((p) => <p key={p.slice(0, 20)} className={s.body}>{p}</p>)}</div>
                    </div>
                    <ol className={s.years}>
                        {CT_YEARS.map((y) => (
                            <li key={y.grade}><span className={s.grade}>{y.grade}</span><h3>{y.title}</h3><p>{y.text}</p></li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* 3. CẤU TRÚC */}
            <section className={`${s.section} ${s.tint}`}>
                <div className={s.container}>
                    <Head eyebrow="Cấu trúc" title={CT_STRUCTURE.title} desc={CT_STRUCTURE.desc} />
                    <div className={s.cols}>
                        {CT_STRUCTURE.cols.map((c) => (
                            <article key={c.title}>
                                <span className={s.tag}>{c.tag}</span>
                                <h3>{c.title}</h3>
                                <p>{c.text}</p>
                                <ul>{c.items.map((x) => <li key={x}><Icon name="check" size={16} />{x}</li>)}</ul>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* 4. HAI HƯỚNG HỌC */}
            <section className={s.section}>
                <div className={s.container}>
                    <Head eyebrow="Hướng học" title={CT_TRACKS.title} desc={CT_TRACKS.desc} />
                    <p className={s.note}>{CT_TRACKS.note}</p>
                    <div className={s.tracks}>
                        {CT_TRACKS.items.map((t) => (
                            <article key={t.key} className={s.track}>
                                <ImageSlot src={CT_IMG[t.img as 'tn' | 'xh']} alt={t.title} tone={t.tone} className={s.trackImg} hint={false} />
                                <div className={s.trackBody}>
                                    <h3>{t.title}</h3>
                                    <p className={s.lead}>{t.lead}</p>
                                    <h4>Môn học chuyên sâu</h4>
                                    <ul className={s.chips}>{t.subjects.map((x) => <li key={x}>{x}</li>)}</ul>
                                    <p className={s.combo}>{t.combos[0]}</p>
                                    <div className={s.trackCols}>
                                        <div><h4>Hướng ngành phù hợp</h4><ul className={s.ticks}>{t.careers.map((x) => <li key={x}><Icon name="check" size={16} />{x}</li>)}</ul></div>
                                        <div><h4>Phù hợp với em nào</h4><ul className={s.ticks}>{t.fit.map((x) => <li key={x}><Icon name="check" size={16} />{x}</li>)}</ul></div>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* 5. QUY TRÌNH CHỌN */}
            <section className={`${s.section} ${s.tint}`}>
                <div className={s.container}>
                    <Head eyebrow="Tư vấn" title={CT_CHOOSE.title} desc={CT_CHOOSE.desc} />
                    <ol className={s.steps}>
                        {CT_CHOOSE.steps.map((x, i) => <li key={x.title}><span>{i + 1}</span><h3>{x.title}</h3><p>{x.text}</p></li>)}
                    </ol>
                </div>
            </section>

            {/* 6. TRẢI NGHIỆM */}
            <section className={s.section}>
                <div className={`${s.container} ${s.two} ${s.twoTop}`}>
                    <ImageSlot src={CT_IMG.exp} alt="Học sinh làm dự án và trải nghiệm" tone="c" className={s.photo} />
                    <div>
                        <span className={s.eyebrow}>Ngoài giờ học môn</span>
                        <h2 className={s.h2}>{CT_EXPERIENCE.title}</h2>
                        <p className={s.body}>{CT_EXPERIENCE.desc}</p>
                        <ul className={s.exp}>
                            {CT_EXPERIENCE.items.map((e) => (
                                <li key={e.title}><span className={s.ic}><Icon name={e.icon} size={22} /></span><div><h3>{e.title}</h3><p>{e.text}</p></div></li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            {/* 7. ĐÁNH GIÁ */}
            <section className={s.assess}>
                <div className={s.container}>
                    <div className={`${s.head} ${s.headLight}`}>
                        <span className={s.eyebrow}>Đánh giá</span>
                        <h2>{CT_ASSESS.title}</h2>
                        <p>{CT_ASSESS.desc}</p>
                    </div>
                    <div className={s.parts}>
                        {CT_ASSESS.parts.map((p) => (
                            <article key={p.name}><b>{p.weight}</b><h3>{p.name}</h3><p>{p.text}</p></article>
                        ))}
                    </div>
                    <p className={s.formula}>{CT_ASSESS.formula}</p>
                    <ul className={s.levels}>
                        {CT_ASSESS.levels.map((l) => <li key={l.name}><b>{l.name}</b><span>{l.text}</span></li>)}
                    </ul>
                    <p className={s.levelNote}>{CT_ASSESS.levelNote}</p>
                </div>
            </section>

            {/* 8. HỖ TRỢ */}
            <section className={s.section}>
                <div className={s.container}>
                    <Head eyebrow="Đồng hành" title={CT_SUPPORT.title} />
                    <div className={s.support}>
                        {CT_SUPPORT.items.map((x, i) => <article key={x.title}><span className={s.num}>0{i + 1}</span><h3>{x.title}</h3><p>{x.text}</p></article>)}
                    </div>
                </div>
            </section>

            {/* 9. HỎI ĐÁP */}
            <section className={`${s.section} ${s.tint}`}>
                <div className={`${s.container} ${s.narrow}`}>
                    <Head eyebrow="Hỏi đáp" title={CT_FAQ.title} />
                    <div className={s.faq}>
                        {CT_FAQ.items.map((f) => (
                            <details key={f.q}><summary>{f.q}<Icon name="chevron" size={18} /></summary><p>{f.a}</p></details>
                        ))}
                    </div>
                </div>
            </section>

            {/* 10. KÊU GỌI */}
            <section className={s.ctaWrap}>
                <div className={s.container}>
                    <div className={s.cta}>
                        <div><h2>{CT_CTA.title}</h2><p>{CT_CTA.text}</p></div>
                        <div className={s.ctaBtns}>
                            <Link href="/lien-he" className={`${s.btn} ${s.btnWhite}`}>Liên hệ tư vấn</Link>
                            <Link href="/tuyen-sinh#dang-ky" className={`${s.btn} ${s.btnGhost}`}>Đăng ký nhập học</Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}