import Link from 'next/link';
import s from './TuyenSinh.module.css';
import ImageSlot from '../ImageSlot';
import Icon from '../Icons';
import TuyenSinhForm from './TuyenSinhForm';
import { SCHOOL } from '../../data/school';
import { TS_CTA, TS_DATES, TS_DOCS, TS_FACTS, TS_FAQ, TS_FORM, TS_HERO, TS_IMG, TS_LOOKUP_CTA, TS_STEPS, TS_TRACKS, TS_WHY } from './tuyen-sinh.data';

/** Trang Tuyển sinh: giao diện ở file này, lời văn ở tuyen-sinh.data.ts, biểu mẫu ở TuyenSinhForm.tsx, màu và bố cục ở TuyenSinh.module.css. */
function Head({ eyebrow, title, desc }: { eyebrow?: string; title: string; desc?: string }) {
    return (
        <div className={s.head}>
            {eyebrow && <span className={s.eyebrow}>{eyebrow}</span>}
            <h2>{title}</h2>
            {desc && <p>{desc}</p>}
        </div>
    );
}

export default function TuyenSinhPage() {
    const phone = SCHOOL.phone?.trim() || '';
    const tel = phone.replace(/\s/g, '');
    return (
        <div className={s.page}>
            {/* 1. ĐẦU TRANG */}
            <section className={s.hero}>
                <ImageSlot src={TS_IMG.hero} fallback="/images/hero-chung.jpg" alt="" tone="a" className={s.heroBg} hint={false} eager />
                <div className={s.heroShade} />
                <div className={`${s.container} ${s.heroIn}`}>
                    <nav className={s.crumb} aria-label="Đường dẫn">
                        <Link href="/">Trang chủ</Link><span aria-hidden="true">›</span><b aria-current="page">Tuyển sinh</b>
                    </nav>
                    <span className={s.eyebrow}>{TS_HERO.eyebrow} · năm học {SCHOOL.admissionYear}</span>
                    <h1>{TS_HERO.title}</h1>
                    <p>{TS_HERO.intro}</p>
                    <div className={s.heroBtns}>
                        <a href="#dang-ky" className={`${s.btn} ${s.btnHot}`}>Đăng ký ngay</a>
                        <Link href="/tuyen-sinh/tra-cuu" className={`${s.btn} ${s.btnGhost}`}>Tra cứu hồ sơ</Link>
                    </div>
                </div>
            </section>

            {/* 2. BỐN THÔNG TIN NHANH */}
            <div className={s.container}>
                <ul className={s.facts}>
                    {TS_FACTS.map((f) => (
                        <li key={f.title}>
                            <span className={s.ic}><Icon name={f.icon} size={24} /></span>
                            <div><b>{f.title}</b><p>{f.text}</p></div>
                        </li>
                    ))}
                </ul>
            </div>

            {/* 3. VÌ SAO CHỌN TRƯỜNG */}
            <section className={s.section}>
                <div className={s.container}>
                    <Head eyebrow="Vì sao chọn trường" title={TS_WHY.title} desc={TS_WHY.desc} />
                    <ul className={s.why}>
                        {TS_WHY.items.map((w) => (
                            <li key={w.title}>
                                <span className={s.ic}><Icon name={w.icon} size={24} /></span>
                                <h3>{w.title}</h3>
                                <p>{w.text}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* 4. QUY TRÌNH */}
            <section className={`${s.section} ${s.tint}`}>
                <div className={s.container}>
                    <Head eyebrow="Quy trình" title={TS_STEPS.title} desc={TS_STEPS.desc} />
                    <ol className={s.steps}>
                        {TS_STEPS.items.map((x, i) => (
                            <li key={x.title}>
                                <span className={s.stepNo}>{i + 1}</span>
                                <span className={s.ic}><Icon name={x.icon} size={22} /></span>
                                <h3>{x.title}</h3>
                                <small>{x.who}</small>
                                <p>{x.text}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* 5. HỒ SƠ + MỐC THỜI GIAN */}
            <section className={s.section}>
                <div className={`${s.container} ${s.docsWrap}`}>
                    <div>
                        <h2 className={s.h2}>{TS_DOCS.title}</h2>
                        <p className={s.lead}>{TS_DOCS.desc}</p>
                        <h3 className={s.h3}>{TS_DOCS.must.title}</h3>
                        <ul className={s.checks}>{TS_DOCS.must.items.map((d) => <li key={d}><Icon name="check" size={18} />{d}</li>)}</ul>
                        <h3 className={s.h3}>{TS_DOCS.extra.title}</h3>
                        <ul className={`${s.checks} ${s.checksSoft}`}>{TS_DOCS.extra.items.map((d) => <li key={d}><Icon name="spark" size={18} />{d}</li>)}</ul>
                        <p className={s.note}><Icon name="shield" size={18} />{TS_DOCS.note}</p>
                    </div>
                    <div>
                        <h2 className={s.h2}>{TS_DATES.title}</h2>
                        <p className={s.lead}>{TS_DATES.desc}</p>
                        <ol className={s.timeline}>
                            {TS_DATES.items.map((d) => (
                                <li key={d.title}>
                                    <time>{d.when}</time>
                                    <div><b>{d.title}</b><p>{d.text}</p></div>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            </section>

            {/* 6. HAI HƯỚNG HỌC */}
            <section className={`${s.section} ${s.tint}`}>
                <div className={s.container}>
                    <Head eyebrow="Định hướng" title={TS_TRACKS.title} desc={TS_TRACKS.desc} />
                    <div className={s.tracks}>
                        {TS_TRACKS.items.map((t) => (
                            <article key={t.name}>
                                <span className={s.ic}><Icon name={t.icon} size={26} /></span>
                                <h3>{t.name}</h3>
                                <p>{t.text}</p>
                                <ul>{t.tags.map((g) => <li key={g}>{g}</li>)}</ul>
                            </article>
                        ))}
                    </div>
                    <p className={s.center}><Link href="/chuong-trinh" className={`${s.btn} ${s.btnLine}`}>{TS_TRACKS.link}</Link></p>
                </div>
            </section>

            {/* 7. ĐĂNG KÝ */}
            <section className={s.section} id="dang-ky">
                <div className={`${s.container} ${s.main}`}>
                    <TuyenSinhForm />
                    <aside className={s.side}>
                        <div className={s.sidePhoto}>
                            <ImageSlot src={TS_IMG.side} fallback="/images/hero-chung.jpg" alt="Học sinh nhà trường" tone="b" hint={false} />
                        </div>
                        <h2>{TS_FORM.side.title}</h2>
                        <ul>{TS_FORM.side.points.map((p) => <li key={p}><Icon name="check" size={18} />{p}</li>)}</ul>
                        <div className={s.sideCall}>
                            <span className={s.ic}><Icon name="phone" size={22} /></span>
                            <div>
                                <small>Cần hỗ trợ trực tiếp?</small>
                                {phone ? <a href={`tel:${tel}`}><b>{phone}</b></a> : <b>Đang cập nhật</b>}
                                <em>{SCHOOL.hours}</em>
                            </div>
                        </div>
                        <div className={s.lookCta}>
                            <h3>{TS_LOOKUP_CTA.title}</h3>
                            <p>{TS_LOOKUP_CTA.text}</p>
                            <Link href="/tuyen-sinh/tra-cuu" className={`${s.btn} ${s.btnPri}`}>{TS_LOOKUP_CTA.btn}</Link>
                        </div>
                    </aside>
                </div>
            </section>

            {/* 8. HỎI ĐÁP */}
            <section className={`${s.section} ${s.tint}`}>
                <div className={`${s.container} ${s.narrow}`}>
                    <Head eyebrow="Hỏi đáp" title={TS_FAQ.title} />
                    <div className={s.faq}>
                        {TS_FAQ.items.map((f) => (
                            <details key={f.q}><summary>{f.q}<Icon name="chevron" size={18} /></summary><p>{f.a}</p></details>
                        ))}
                    </div>
                </div>
            </section>

            {/* 9. KÊU GỌI */}
            <section className={s.ctaWrap}>
                <div className={s.container}>
                    <div className={s.cta}>
                        <div><h2>{TS_CTA.title}</h2><p>{TS_CTA.text}</p></div>
                        <div className={s.ctaBtns}>
                            {phone && <a href={`tel:${tel}`} className={`${s.btn} ${s.btnWhite}`}>Gọi {phone}</a>}
                            <Link href="/lien-he" className={`${s.btn} ${s.btnGhost}`}>Gửi tin nhắn</Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}