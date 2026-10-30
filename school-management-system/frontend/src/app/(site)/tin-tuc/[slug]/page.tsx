import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import s from '@/modules/website/site.module.css';
import Icon from '@/modules/website/components/Icons';
import { Cover, NewsCard, PageHead } from '@/modules/website/components/Parts';
import { API, fmtDate, type NewsItem } from '@/modules/website/lib/api';

type Detail = { item: NewsItem; related: NewsItem[] };

/* Đọc bài bằng fetch riêng để phân biệt "không có bài" (404) với "API chưa chạy". */
async function getPost(slug: string): Promise<Detail | null | 'down'> {
    try {
        const res = await fetch(`${API}/public/news/${encodeURIComponent(slug)}`, { cache: 'no-store', signal: AbortSignal.timeout(3000), headers: { Accept: 'application/json' } });
        if (res.status === 404) return null;
        if (!res.ok) return 'down';
        return (await res.json()).data as Detail;
    } catch { return 'down'; }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const p = await getPost(params.slug);
    return p && p !== 'down' ? { title: p.item.title, description: p.item.summary } : { title: 'Tin tức' };
}

export default async function PostPage({ params }: { params: { slug: string } }) {
    const p = await getPost(params.slug);
    if (p === null) notFound();
    if (p === 'down') {
        return (
            <PageHead title="Chưa tải được bài viết" desc="Máy chủ tin tức tạm thời chưa phản hồi. Vui lòng tải lại trang sau ít phút." trail={[['Tin tức', '/tin-tuc'], ['Bài viết']]}>
                <p><Link href="/tin-tuc" className={s.link}>Về danh sách tin tức</Link></p>
            </PageHead>
        );
    }
    const { item: n, related } = p;
    return (
        <>
            <PageHead title={n.title} desc={n.summary} trail={[['Tin tức', '/tin-tuc'], [n.category]]}>
                <p className={s.postMeta}><span className={s.tag}>{n.category}</span><time dateTime={n.date}>{fmtDate(n.date)}</time><span><Icon name="eye" size={16} />{n.views.toLocaleString('vi-VN')} lượt xem</span></p>
            </PageHead>
            <section className={s.section}>
                <div className={`${s.container} ${s.post}`}>
                    <div className={s.postCover}><Cover tone={n.tone} kind={n.kind} /></div>
                    {n.kind === 'event' && n.event_date && (
                        <p className={s.eventBox}><Icon name="calendar" size={20} /><span><b>{fmtDate(n.event_date)}</b>{n.event_place ? ` · ${n.event_place}` : ''}</span></p>
                    )}
                    <article className={s.prose}>{(n.paragraphs ?? []).map((t, i) => <p key={i}>{t}</p>)}</article>
                    <p><Link href="/tin-tuc" className={s.link}>Tất cả tin tức<Icon name="arrow" size={18} /></Link></p>
                </div>
            </section>
            {related.length > 0 && (
                <section className={`${s.section} ${s.sectionTint}`}>
                    <div className={s.container}>
                        <h2 className={s.h2}>Có thể bạn quan tâm</h2>
                        <div className={s.newsRow}>{related.map((r) => <NewsCard key={r.id} n={r} />)}</div>
                    </div>
                </section>
            )}
        </>
    );
}