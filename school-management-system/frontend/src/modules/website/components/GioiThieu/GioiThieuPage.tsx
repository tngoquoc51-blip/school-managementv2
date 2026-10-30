import Link from 'next/link';
import s from './GioiThieu.module.css';
import ImageSlot from '../ImageSlot';
import CountUp from '../CountUp';
import Icon from '../Icons';
import { load, type Overview } from '../../lib/api';
import { FALLBACK_OVERVIEW, SCHOOL } from '../../data/school';
import {
    GT_APPROACH, GT_COMMIT, GT_CTA, GT_FACILITIES, GT_HERO, GT_HISTORY, GT_IMG, GT_LEADERS, GT_LETTER,
    GT_PILLARS, GT_STAFF, GT_STATS, GT_STORY, GT_VALUES, GT_VISIT,
} from './gioi-thieu.data';

/** Trang Giới thiệu: giao diện nằm ở file này, lời văn ở gioi-thieu.data.ts, màu và bố cục ở GioiThieu.module.css. */
function Head({ eyebrow, title, desc, light }: { eyebrow?: string; title: string; desc?: string; light?: boolean }) {
    return (
        <div className={`${s.head} ${light ? s.headLight : ''}`}>
            {eyebrow && <span className={s.eyebrow}>{eyebrow}</span>}
            <h2>{title}</h2>
            {desc && <p>{desc}</p>}
        </div>
    );
}

export default async function GioiThieuPage() {
    const o = (await load<Overview>('overview', FALLBACK_OVERVIEW, 300)).data;
    const leaders = GT_LEADERS.items;

    return (
        <div className={s.page}>
            {/* 1. ĐẦU TRANG */}
            <section className={s.hero}>
                <ImageSlot src={GT_IMG.hero} fallback="/images/hero-chung.jpg" alt="" tone="a" className={s.heroBg} hint={false} eager />
                <div className={s.heroShade} />
                <div className={`${s.container} ${s.heroIn}`}>
                    <nav className={s.crumb} aria-label="Đường dẫn">
                        <Link href="/">Trang chủ</Link><span aria-hidden="true">›</span><b aria-current="page">Giới thiệu</b>
                    </nav>
                    <span className={s.eyebrow}>{GT_HERO.eyebrow}</span>
                    <h1>{GT_HERO.title}</h1>
                    <p>{GT_HERO.intro}</p>
                    <div className={s.heroBtns}>
                        <Link href="/tuyen-sinh#dang-ky" className={`${s.btn} ${s.btnHot}`}>Đăng ký nhập học</Link>
                        <Link href="/lien-he" className={`${s.btn} ${s.btnGhost}`}>Đặt lịch tham quan</Link>
                    </div>
                </div>
            </section>

            <div className={s.container}>
                <ul className={s.facts}>
                    {GT_HERO.facts.map((f) => (
                        <li key={f.big}><Icon name={f.icon} size={26} /><span><b>{f.big}</b>{f.small}</span></li>
                    ))}
                </ul>
            </div>

            {/* 2. THƯ NGỎ */}
            <section className={s.section}>
                <div className={`${s.container} ${s.narrow}`}>
                    <Head eyebrow={GT_LETTER.eyebrow} title={GT_LETTER.title} />
                    <div className={s.letter}>
                        {GT_LETTER.paras.map((p) => <p key={p.slice(0, 20)}>{p}</p>)}
                        <p className={s.sign}>{GT_LETTER.signer}</p>
                    </div>
                </div>
            </section>

            {/* 3. CÂU CHUYỆN */}
            <section className={`${s.section} ${s.tint}`}>
                <div className={`${s.container} ${s.two}`}>
                    <div>
                        <span className={s.eyebrow}>{GT_STORY.eyebrow}</span>
                        <h2 className={s.h2}>{GT_STORY.title}</h2>
                        {GT_STORY.paras.map((p) => <p key={p.slice(0, 20)} className={s.body}>{p}</p>)}
                        <ul className={s.chips}>{GT_STORY.points.map((x) => <li key={x}><Icon name="check" size={16} />{x}</li>)}</ul>
                    </div>
                    <ImageSlot src={GT_IMG.story} alt="Thầy cô và học sinh trường" tone="a" className={s.photo} />
                </div>
            </section>

            {/* 4. TẦM NHÌN, SỨ MỆNH, GIÁ TRỊ */}
            <section className={s.section}>
                <div className={s.container}>
                    <Head eyebrow="Định hướng" title="Tầm nhìn, sứ mệnh và giá trị cốt lõi" desc="Những điều định hướng mọi hoạt động chuyên môn và giáo dục của nhà trường." />
                    <div className={s.pillars}>
                        {GT_PILLARS.map((p) => (
                            <article key={p.title}>
                                <span className={s.ic}><Icon name={p.icon} size={28} /></span>
                                <h3>{p.title}</h3>
                                <p>{p.text}</p>
                            </article>
                        ))}
                    </div>
                    <h3 className={s.sub}>Năm giá trị cốt lõi</h3>
                    <ol className={s.values}>
                        {GT_VALUES.map((v, i) => <li key={v.title}><span>{i + 1}</span><b>{v.title}</b><p>{v.text}</p></li>)}
                    </ol>
                </div>
            </section>

            {/* 5. SỐ LIỆU (lấy từ hệ thống) */}
            <section className={s.stats} aria-label="Nhà trường trong những con số">
                <div className={s.container}>
                    <Head title={GT_STATS.title} desc={GT_STATS.desc} light />
                    <dl className={s.statRow}>
                        <div><dd><CountUp to={o.classes} /></dd><dt>Lớp học</dt></div>
                        <div><dd><CountUp to={o.students} /></dd><dt>Học sinh</dt></div>
                        <div><dd><CountUp to={o.teachers} /></dd><dt>Giáo viên</dt></div>
                        <div><dd><CountUp to={o.subjects} /></dd><dt>Môn học</dt></div>
                    </dl>
                </div>
            </section>

            {/* 6. PHƯƠNG PHÁP */}
            <section className={`${s.section} ${s.tint}`}>
                <div className={s.container}>
                    <Head eyebrow="Phương pháp" title={GT_APPROACH.title} desc={GT_APPROACH.desc} />
                    <div className={s.approach}>
                        {GT_APPROACH.items.map((a, i) => (
                            <article key={a.title}><span className={s.num}>0{i + 1}</span><h3>{a.title}</h3><p>{a.text}</p></article>
                        ))}
                    </div>
                </div>
            </section>

            {/* 7. CƠ SỞ VẬT CHẤT */}
            <section className={s.section}>
                <div className={s.container}>
                    <Head eyebrow="Cơ sở vật chất" title={GT_FACILITIES.title} desc={GT_FACILITIES.desc} />
                    <div className={s.facs}>
                        {GT_FACILITIES.items.map((f, i) => (
                            <figure key={f.title} className={s.fac}>
                                <ImageSlot src={GT_IMG.fac[i]} alt={f.title} tone={['a', 'b', 'c', 'd'][i % 4]} className={s.facImg} hint={false} />
                                <figcaption><h3>{f.title}</h3><p>{f.text}</p></figcaption>
                            </figure>
                        ))}
                    </div>
                </div>
            </section>

            {/* 8. ĐỘI NGŨ */}
            <section className={`${s.section} ${s.tint}`}>
                <div className={`${s.container} ${s.two} ${s.twoFlip}`}>
                    <ImageSlot src={GT_IMG.staff} alt="Đội ngũ giáo viên" tone="b" className={s.photo} />
                    <div>
                        <span className={s.eyebrow}>{GT_STAFF.eyebrow}</span>
                        <h2 className={s.h2}>{GT_STAFF.title}</h2>
                        <p className={s.body}>{GT_STAFF.text}</p>
                        <ul className={s.ticks}>{GT_STAFF.points.map((x) => <li key={x}><Icon name="check" size={18} />{x}</li>)}</ul>
                        <p className={s.body}><b className={s.hl}><CountUp to={o.teachers} /></b> giáo viên đang giảng dạy tại trường năm học này.</p>
                    </div>
                </div>
            </section>

            {/* 9. LỊCH SỬ */}
            <section className={s.section}>
                <div className={s.container}>
                    <Head eyebrow="Lịch sử" title={GT_HISTORY.title} desc={GT_HISTORY.desc} />
                    {GT_HISTORY.sample && <p className={s.note}>Các mốc có dấu [ngoặc vuông] là nội dung mẫu. Nhà trường điền thông tin thật trong gioi-thieu.data.ts.</p>}
                    <ol className={s.timeline}>
                        {GT_HISTORY.items.map((h, i) => (
                            <li key={i}><time>{h.year}</time><div><h3>{h.title}</h3><p>{h.text}</p></div></li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* 10. BAN LÃNH ĐẠO */}
            <section className={`${s.section} ${s.tint}`}>
                <div className={s.container}>
                    <Head eyebrow="Lãnh đạo" title={GT_LEADERS.title} desc={GT_LEADERS.desc} />
                    <div className={s.leaders}>
                        {leaders.map((l, i) => (
                            <article key={i}>
                                <span className={s.avatar} aria-hidden="true">{l.name.startsWith('[') ? <Icon name="user" size={38} /> : l.name.trim().split(' ').pop()!.charAt(0).toUpperCase()}</span>
                                <h3>{l.name}</h3>
                                <b className={s.role}>{l.role}</b>
                                <p>{l.note}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* 11. CAM KẾT + THAM QUAN */}
            <section className={s.section}>
                <div className={`${s.container} ${s.two}`}>
                    <div>
                        <span className={s.eyebrow}>Cam kết</span>
                        <h2 className={s.h2}>{GT_COMMIT.title}</h2>
                        <ul className={s.ticks}>{GT_COMMIT.items.map((x) => <li key={x}><Icon name="check" size={18} />{x}</li>)}</ul>
                    </div>
                    <div className={s.visit}>
                        <h2>{GT_VISIT.title}</h2>
                        <p>{GT_VISIT.desc}</p>
                        <ol>{GT_VISIT.steps.map((v, i) => <li key={v.title}><span>{i + 1}</span><div><b>{v.title}</b><small>{v.text}</small></div></li>)}</ol>
                        <ul className={s.contact}>
                            <li><Icon name="pin" size={18} />{SCHOOL.address}</li>
                            <li><Icon name="phone" size={18} />{SCHOOL.phone}</li>
                            <li><Icon name="mail" size={18} />{SCHOOL.email}</li>
                            <li><Icon name="clock" size={18} />{SCHOOL.hours}</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* 12. KÊU GỌI */}
            <section className={s.ctaWrap}>
                <div className={s.container}>
                    <div className={s.cta}>
                        <div><h2>{GT_CTA.title}</h2><p>{GT_CTA.text}</p></div>
                        <div className={s.ctaBtns}>
                            <Link href="/tuyen-sinh#dang-ky" className={`${s.btn} ${s.btnWhite}`}>Đăng ký nhập học</Link>
                            <Link href="/lien-he" className={`${s.btn} ${s.btnGhost}`}>Liên hệ nhà trường</Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}