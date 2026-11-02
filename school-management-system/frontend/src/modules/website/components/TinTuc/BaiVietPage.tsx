import Link from 'next/link';
import s from './TinTuc.module.css';
import Icon from '../Icons';
import NewsTile from './NewsTile';
import CopyLink from './CopyLink';
import { fmtDate, type NewsItem } from '../../lib/api';
import { TT_CTA, TT_POST } from './tin-tuc.data';
import { SCHOOL } from '../../data/school';

/** Trang một bài viết. Dùng chung TinTuc.module.css với trang danh sách. */
export default function BaiVietPage({ item: n, related }: { item: NewsItem; related: NewsItem[] }) {
    const words = (n.paragraphs ?? []).join(' ').split(/\s+/).filter(Boolean).length;
    const mins = Math.max(1, Math.round(words / 180));
    return (
        <div className={s.page}>
            <section className={`${s.postHero} ${s['tone_' + n.tone] ?? s.tone_a}`}>
                <div className={`${s.container} ${s.postHeroIn}`}>
                    <nav className={s.crumb} aria-label="Đường dẫn">
                        <Link href="/">Trang chủ</Link><span aria-hidden="true">›</span><Link href="/tin-tuc">Tin tức</Link><span aria-hidden="true">›</span><b aria-current="page">{n.category}</b>
                    </nav>
                    <p className={s.meta}><span className={s.tag}>{n.category}</span><span className={s.kindLite}>{n.kind === 'event' ? 'Sự kiện' : 'Tin tức'}</span></p>
                    <h1>{n.title}</h1>
                    <p className={s.postSum}>{n.summary}</p>
                    <p className={s.postMeta}>
                        <span><Icon name="calendar" size={16} /><time dateTime={n.date}>{fmtDate(n.date)}</time></span>
                        <span><Icon name="eye" size={16} />{n.views.toLocaleString('vi-VN')} {TT_POST.views}</span>
                        <span><Icon name="clock" size={16} />{mins} {TT_POST.read}</span>
                    </p>
                </div>
            </section>

            <section className={s.section}>
                <div className={`${s.container} ${s.postLayout}`}>
                    <div className={s.postMain}>
                        {n.kind === 'event' && n.event_date && (
                            <div className={s.eventBox}>
                                <span className={s.ic}><Icon name="calendar" size={22} /></span>
                                <div><small>{TT_POST.event}</small><b>{fmtDate(n.event_date)}</b>{n.event_place && <span>{n.event_place}</span>}</div>
                            </div>
                        )}
                        <article className={s.prose}>
                            {(n.paragraphs ?? []).map((t, i) => <p key={i}>{t}</p>)}
                        </article>
                        <CopyLink />
                        <p className={s.notice}><Icon name="mail" size={18} />{TT_POST.notice}</p>
                        <p><Link href="/tin-tuc" className={s.back}><Icon name="arrow" size={16} />{TT_POST.back}</Link></p>
                    </div>
                    <aside className={s.aside}>
                        <section className={s.card}>
                            <h2>{TT_POST.related}</h2>
                            {related.length === 0 ? <p className={s.muted}>Chưa có bài liên quan.</p> : (
                                <ul className={s.relList}>
                                    {related.slice(0, 4).map((r) => (
                                        <li key={r.id}><Link href={`/tin-tuc/${r.slug}`}><small>{fmtDate(r.date)} · {r.category}</small><b>{r.title}</b></Link></li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </aside>
                </div>
            </section>

            {related.length > 0 && (
                <section className={`${s.section} ${s.tint}`}>
                    <div className={s.container}>
                        <h2 className={s.h2c}>{TT_POST.related}</h2>
                        <div className={s.grid}>{related.slice(0, 3).map((r) => <NewsTile key={r.id} n={r} />)}</div>
                    </div>
                </section>
            )}

            <section className={s.ctaWrap}>
                <div className={s.container}>
                    <div className={s.cta}>
                        <div><h2>{TT_CTA.title}</h2><p>{TT_CTA.text}</p></div>
                        <div className={s.ctaBtns}>
                            {SCHOOL.phone?.trim() && <a href={`tel:${SCHOOL.phone.replace(/\s/g, '')}`} className={`${s.btn} ${s.btnWhite}`}>Gọi {SCHOOL.phone}</a>}
                            <Link href="/lien-he" className={`${s.btn} ${s.btnGhost}`}>Gửi câu hỏi</Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}