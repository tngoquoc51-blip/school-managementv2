import Link from 'next/link';
import s from './LienHe.module.css';
import ImageSlot from '../ImageSlot';
import Icon from '../Icons';
import LienHeForm from './LienHeForm';
import { SCHOOL } from '../../data/school';
import { LH_CHANNELS, LH_CTA, LH_DEPTS, LH_FAQ, LH_HERO, LH_IMG, LH_MAP_EMBED, LH_MAP_LINK, LH_VISIT } from './lien-he.data';

/** Trang Liên hệ: giao diện ở file này, lời văn ở lien-he.data.ts, biểu mẫu ở LienHeForm.tsx, màu và bố cục ở LienHe.module.css. */
function Head({ eyebrow, title, desc }: { eyebrow?: string; title: string; desc?: string }) {
    return (
        <div className={s.head}>
            {eyebrow && <span className={s.eyebrow}>{eyebrow}</span>}
            <h2>{title}</h2>
            {desc && <p>{desc}</p>}
        </div>
    );
}

export default function LienHePage() {
    const phone = SCHOOL.phone?.trim() || '';
    const email = SCHOOL.email?.trim() || '';
    const tel = phone.replace(/\s/g, '');
    const EMPTY = 'Đang cập nhật';
    return (
        <div className={s.page}>
            {/* 1. ĐẦU TRANG */}
            <section className={s.hero}>
                <ImageSlot src={LH_IMG.hero} fallback="/images/hero-chung.jpg" alt="" tone="a" className={s.heroBg} hint={false} eager />
                <div className={s.heroShade} />
                <div className={`${s.container} ${s.heroIn}`}>
                    <nav className={s.crumb} aria-label="Đường dẫn">
                        <Link href="/">Trang chủ</Link><span aria-hidden="true">›</span><b aria-current="page">Liên hệ</b>
                    </nav>
                    <span className={s.eyebrow}>{LH_HERO.eyebrow}</span>
                    <h1>{LH_HERO.title}</h1>
                    <p>{LH_HERO.intro}</p>
                    <div className={s.heroBtns}>
                        {phone && <a href={`tel:${tel}`} className={`${s.btn} ${s.btnHot}`}>Gọi {phone}</a>}
                        <a href="#gui-tin" className={`${s.btn} ${s.btnGhost}`}>Gửi tin nhắn</a>
                    </div>
                </div>
            </section>

            {/* 2. BỐN KÊNH LIÊN HỆ */}
            <div className={s.container}>
                <ul className={s.channels}>
                    <li>{phone ? <a href={`tel:${tel}`}><span className={s.ic}><Icon name="phone" size={24} /></span><div><small>{LH_CHANNELS.phone.title}</small><b>{phone}</b><em>{LH_CHANNELS.phone.hint}</em></div></a> : <div className={s.chItem}><span className={s.ic}><Icon name="phone" size={24} /></span><div><small>{LH_CHANNELS.phone.title}</small><b>{EMPTY}</b><em>{LH_CHANNELS.phone.hint}</em></div></div>}</li>
                    <li>{email ? <a href={`mailto:${email}`}><span className={s.ic}><Icon name="mail" size={24} /></span><div><small>{LH_CHANNELS.mail.title}</small><b>{email}</b><em>{LH_CHANNELS.mail.hint}</em></div></a> : <div className={s.chItem}><span className={s.ic}><Icon name="mail" size={24} /></span><div><small>{LH_CHANNELS.mail.title}</small><b>{EMPTY}</b><em>{LH_CHANNELS.mail.hint}</em></div></div>}</li>
                    <li><div className={s.chItem}><span className={s.ic}><Icon name="pin" size={24} /></span><div><small>{LH_CHANNELS.address.title}</small><b>{SCHOOL.address}</b><em>{LH_CHANNELS.address.hint}</em></div></div></li>
                    <li><div className={s.chItem}><span className={s.ic}><Icon name="clock" size={24} /></span><div><small>{LH_CHANNELS.hours.title}</small><b>{SCHOOL.hours}</b><em>{LH_CHANNELS.hours.hint}</em></div></div></li>
                </ul>
            </div>

            {/* 3. BIỂU MẪU + BỘ PHẬN */}
            <section className={s.section}>
                <div className={`${s.container} ${s.main}`}>
                    <LienHeForm />
                    <aside className={s.depts}>
                        <h2>{LH_DEPTS.title}</h2>
                        <p className={s.deptsDesc}>{LH_DEPTS.desc}</p>
                        <ul>
                            {LH_DEPTS.items.map((d) => (
                                <li key={d.name}>
                                    <span className={s.ic}><Icon name={d.icon} size={22} /></span>
                                    <div>
                                        <h3>{d.name}</h3>
                                        <p>{d.text}</p>
                                        <small>Số máy lẻ: {d.ext}</small>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </aside>
                </div>
            </section>

            {/* 4. BẢN ĐỒ + ĐƯỜNG ĐI */}
            <section className={`${s.section} ${s.tint}`}>
                <div className={s.container}>
                    <Head eyebrow="Đường đi" title={LH_VISIT.title} desc={LH_VISIT.desc} />
                    <div className={s.visit}>
                        <div className={s.map}>
                            {LH_MAP_EMBED ? (
                                <iframe src={LH_MAP_EMBED} title="Bản đồ vị trí nhà trường" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
                            ) : (
                                <div className={s.mapEmpty} role="img" aria-label="Bản đồ nhà trường đang chờ gắn">
                                    <Icon name="pin" size={34} />
                                    <b>Bản đồ đường đi</b>
                                    <span>{SCHOOL.address}</span>
                                    <small>Nhà trường dán địa chỉ nhúng Google Maps vào <code>LH_MAP_EMBED</code> trong file lien-he.data.ts.</small>
                                </div>
                            )}
                            {LH_MAP_LINK && <a href={LH_MAP_LINK} target="_blank" rel="noopener noreferrer" className={`${s.btn} ${s.btnPri} ${s.mapBtn}`}>Chỉ đường</a>}
                        </div>
                        <div className={s.visitSide}>
                            {LH_VISIT.cards.map((c) => (
                                <article key={c.title}>
                                    <span className={s.ic}><Icon name={c.icon} size={22} /></span>
                                    <div><h3>{c.title}</h3>{c.lines.map((l) => <p key={l}>{l}</p>)}</div>
                                </article>
                            ))}
                            <ol className={s.visitSteps}>
                                {LH_VISIT.steps.map((x, i) => <li key={x}><span>{i + 1}</span>{x}</li>)}
                            </ol>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. HỎI ĐÁP */}
            <section className={s.section}>
                <div className={`${s.container} ${s.narrow}`}>
                    <Head eyebrow="Hỏi đáp" title={LH_FAQ.title} />
                    <div className={s.faq}>
                        {LH_FAQ.items.map((f) => (
                            <details key={f.q}><summary>{f.q}<Icon name="chevron" size={18} /></summary><p>{f.a}</p></details>
                        ))}
                    </div>
                </div>
            </section>

            {/* 6. KÊU GỌI */}
            <section className={s.ctaWrap}>
                <div className={s.container}>
                    <div className={s.cta}>
                        <div><h2>{LH_CTA.title}</h2><p>{LH_CTA.text}</p></div>
                        <div className={s.ctaBtns}>
                            <Link href="/tuyen-sinh#dang-ky" className={`${s.btn} ${s.btnWhite}`}>Đăng ký nhập học</Link>
                            <Link href="/tuyen-sinh/tra-cuu" className={`${s.btn} ${s.btnGhost}`}>Tra cứu hồ sơ</Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}