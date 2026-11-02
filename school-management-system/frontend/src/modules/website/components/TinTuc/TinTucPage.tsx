import Link from 'next/link';
import s from './TinTuc.module.css';
import ImageSlot from '../ImageSlot';
import Icon from '../Icons';
import NewsTile from './NewsTile';
import { API, fmtDate, load, type NewsItem, type NewsList } from '../../lib/api';
import { SCHOOL } from '../../data/school';
import { TT_ASIDE, TT_CTA, TT_HERO, TT_IMG, TT_KINDS, TT_TEXT } from './tin-tuc.data';

export type SP = { q?: string; category?: string; kind?: string; page?: string };
const href = (p: SP, over: Partial<SP>) => {
    const m = { ...p, ...over } as Record<string, string | undefined>;
    const u = Object.entries(m).filter(([k, v]) => v && !(k === 'page' && v === '1')).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&');
    return `/tin-tuc${u ? `?${u}` : ''}`;
};

/** Trang danh sách tin: giao diện ở file này, lời văn ở tin-tuc.data.ts, thẻ bài ở NewsTile.tsx, màu và bố cục ở TinTuc.module.css. */
export default async function TinTucPage({ searchParams }: { searchParams: SP }) {
    const qs = new URLSearchParams();
    (['q', 'category', 'kind', 'page'] as const).forEach((k) => searchParams[k] && qs.set(k, String(searchParams[k]).slice(0, 60)));
    qs.set('per_page', '9');
    const [list, ev] = await Promise.all([
        load<NewsList>(`news?${qs}`, { items: [], total: 0, page: 1, pages: 1, per_page: 9, categories: [] }, 20),
        load<{ items: NewsItem[] }>('events?limit=4', { items: [] }, 60),
    ]);
    const d = list.data;
    const filtered = Boolean(searchParams.q || searchParams.category || searchParams.kind);
    const showFeatured = !filtered && d.page === 1 && d.items.length > 0;
    const lead = showFeatured ? (d.items.find((x) => x.featured) ?? d.items[0]) : null;
    const rest = lead ? d.items.filter((x) => x.id !== lead.id) : d.items;
    const kind = searchParams.kind || '';

    return (
        <div className={s.page}>
            {/* 1. ĐẦU TRANG + Ô TÌM KIẾM */}
            <section className={s.hero}>
                <ImageSlot src={TT_IMG.hero} fallback="/images/hero-chung.jpg" alt="" tone="a" className={s.heroBg} hint={false} eager />
                <div className={s.heroShade} />
                <div className={`${s.container} ${s.heroIn}`}>
                    <nav className={s.crumb} aria-label="Đường dẫn">
                        <Link href="/">Trang chủ</Link><span aria-hidden="true">›</span><b aria-current="page">Tin tức</b>
                    </nav>
                    <span className={s.eyebrow}>{TT_HERO.eyebrow}</span>
                    <h1>{TT_HERO.title}</h1>
                    <p>{TT_HERO.intro}</p>
                    <form className={s.heroSearch} action="/tin-tuc" role="search">
                        <Icon name="search" size={20} />
                        <input name="q" defaultValue={searchParams.q ?? ''} placeholder={TT_TEXT.searchPlaceholder} aria-label="Tìm trong tin tức" maxLength={60} />
                        {searchParams.kind && <input type="hidden" name="kind" value={searchParams.kind} />}
                        <button className={`${s.btn} ${s.btnHot}`}>Tìm kiếm</button>
                    </form>
                </div>
            </section>

            {/* 2. BỘ LỌC */}
            <div className={s.container}>
                <div className={s.filter}>
                    <div className={s.pills} role="group" aria-label="Loại tin">
                        {TT_KINDS.map(([k, l]) => <Link key={k} href={href(searchParams, { kind: k || undefined, page: undefined })} className={kind === k ? s.pillOn : ''}>{l}</Link>)}
                    </div>
                    {d.categories.length > 0 && (
                        <div className={s.pills} role="group" aria-label="Chuyên mục">
                            <Link href={href(searchParams, { category: undefined, page: undefined })} className={!searchParams.category ? s.pillOn : ''}>{TT_TEXT.allCategories}</Link>
                            {d.categories.map((c) => <Link key={c} href={href(searchParams, { category: c, page: undefined })} className={searchParams.category === c ? s.pillOn : ''}>{c}</Link>)}
                        </div>
                    )}
                </div>
            </div>

            {/* 3. DANH SÁCH + CỘT PHỤ */}
            <section className={s.section}>
                <div className={`${s.container} ${s.layout}`}>
                    <div>
                        {!list.live ? (
                            <div className={s.state} role="alert">
                                <Icon name="shield" size={34} />
                                <p>{TT_TEXT.down}</p>
                                <Link href="/tin-tuc" className={`${s.btn} ${s.btnPri}`}>{TT_TEXT.reload}</Link>
                                {process.env.NODE_ENV !== 'production' && <small>Dành cho lập trình viên. Địa chỉ gọi: {API}/public/news. Nguyên nhân: {list.why ?? 'không rõ'}</small>}
                            </div>
                        ) : d.items.length === 0 ? (
                            <div className={s.state}>
                                <Icon name="search" size={34} />
                                <p>{TT_TEXT.empty}</p>
                                <Link href="/tin-tuc" className={`${s.btn} ${s.btnPri}`}>{TT_TEXT.clear}</Link>
                            </div>
                        ) : (
                            <>
                                {lead && (
                                    <div className={s.block}>
                                        <h2 className={s.blockTitle}>{TT_TEXT.featured}</h2>
                                        <NewsTile n={lead} big />
                                    </div>
                                )}
                                <div className={s.block}>
                                    <div className={s.blockHead}>
                                        <h2 className={s.blockTitle}>{lead ? TT_TEXT.latest : TT_TEXT.results(d.total)}</h2>
                                        {filtered && <Link href="/tin-tuc" className={s.clear}>{TT_TEXT.clear}</Link>}
                                    </div>
                                    {rest.length > 0 && <div className={s.grid}>{rest.map((n) => <NewsTile key={n.id} n={n} />)}</div>}
                                </div>
                                {d.pages > 1 && (
                                    <nav className={s.pager} aria-label="Phân trang">
                                        {d.page > 1 ? <Link href={href(searchParams, { page: String(d.page - 1) })}>{TT_TEXT.prev}</Link> : <span />}
                                        <b>Trang {d.page} / {d.pages}</b>
                                        {d.page < d.pages ? <Link href={href(searchParams, { page: String(d.page + 1) })}>{TT_TEXT.next}</Link> : <span />}
                                    </nav>
                                )}
                            </>
                        )}
                    </div>

                    <aside className={s.aside}>
                        <section className={s.card}>
                            <h2>{TT_ASIDE.events.title}</h2>
                            {ev.data.items.length === 0 ? <p className={s.muted}>{TT_ASIDE.events.empty}</p> : (
                                <ul className={s.events}>
                                    {ev.data.items.map((e) => {
                                        const [, m, dd] = (e.event_date ?? '').split('-');
                                        return (
                                            <li key={e.id}>
                                                <time dateTime={e.event_date ?? ''} className={s.cal}><b>{dd}</b><span>Th{Number(m)}</span></time>
                                                <div><Link href={`/tin-tuc/${e.slug}`}>{e.title}</Link>{e.event_place && <small>{e.event_place} · {fmtDate(e.event_date)}</small>}</div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>
                        <section className={s.card}>
                            <h2>{TT_ASIDE.channels.title}</h2>
                            <p className={s.muted}>{TT_ASIDE.channels.text}</p>
                            <ul className={s.channels}>
                                {TT_ASIDE.channels.items.map((c) => (
                                    <li key={c.title}><Link href={c.href}><span className={s.ic}><Icon name={c.icon} size={20} /></span><div><b>{c.title}</b><small>{c.text}</small></div></Link></li>
                                ))}
                            </ul>
                            <p className={s.warn}><Icon name="shield" size={18} />{TT_ASIDE.note}</p>
                        </section>
                    </aside>
                </div>
            </section>

            {/* 4. KÊU GỌI */}
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