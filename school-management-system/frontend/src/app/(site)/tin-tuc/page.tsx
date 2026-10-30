import type { Metadata } from 'next';
import Link from 'next/link';
import s from '@/modules/website/site.module.css';
import Icon from '@/modules/website/components/Icons';
import { NewsCard, PageHead } from '@/modules/website/components/Parts';
import { load, type NewsList } from '@/modules/website/lib/api';

export const metadata: Metadata = { title: 'Tin tức và sự kiện', description: 'Thông báo, hoạt động và sự kiện mới nhất của nhà trường.' };

type SP = { q?: string; category?: string; kind?: string; page?: string };
const href = (p: SP, over: Partial<SP>) => {
    const m = { ...p, ...over } as Record<string, string | undefined>;
    const u = Object.entries(m).filter(([k, v]) => v && !(k === 'page' && v === '1')).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&');
    return `/tin-tuc${u ? `?${u}` : ''}`;
};

export default async function NewsPage({ searchParams }: { searchParams: SP }) {
    const qs = new URLSearchParams();
    (['q', 'category', 'kind', 'page'] as const).forEach((k) => searchParams[k] && qs.set(k, String(searchParams[k]).slice(0, 60)));
    qs.set('per_page', '9');
    const { data: d, live } = await load<NewsList>(`news?${qs}`, { items: [], total: 0, page: 1, pages: 1, per_page: 9, categories: [] }, 20);
    const kinds: [string, string][] = [['', 'Tất cả'], ['news', 'Tin tức'], ['event', 'Sự kiện']];

    return (
        <>
            <PageHead title="Tin tức và sự kiện" desc="Thông báo, hoạt động và sự kiện mới nhất của nhà trường." trail={[['Tin tức']]} />
            <section className={s.section}>
                <div className={s.container}>
                    <form className={s.filterBar} action="/tin-tuc" role="search">
                        <div className={s.pills} role="group" aria-label="Loại tin">
                            {kinds.map(([k, l]) => <Link key={k} href={href(searchParams, { kind: k || undefined, page: undefined })} className={(searchParams.kind || '') === k ? s.pillOn : ''}>{l}</Link>)}
                        </div>
                        <div className={s.searchBox}>
                            <Icon name="search" size={18} />
                            <input name="q" defaultValue={searchParams.q ?? ''} placeholder="Tìm trong tin tức" aria-label="Tìm trong tin tức" maxLength={60} />
                            {searchParams.kind && <input type="hidden" name="kind" value={searchParams.kind} />}
                            {searchParams.category && <input type="hidden" name="category" value={searchParams.category} />}
                            <button className={`${s.btn} ${s.btnPri} ${s.btnSm}`}>Tìm</button>
                        </div>
                    </form>
                    {d.categories.length > 0 && (
                        <div className={s.pills} role="group" aria-label="Chuyên mục">
                            <Link href={href(searchParams, { category: undefined, page: undefined })} className={!searchParams.category ? s.pillOn : ''}>Mọi chuyên mục</Link>
                            {d.categories.map((c) => <Link key={c} href={href(searchParams, { category: c, page: undefined })} className={searchParams.category === c ? s.pillOn : ''}>{c}</Link>)}
                        </div>
                    )}

                    {!live ? (
                        <p className={s.empty}>Chưa kết nối được máy chủ tin tức. Vui lòng thử lại sau ít phút.</p>
                    ) : d.items.length === 0 ? (
                        <p className={s.empty}>Không có bài nào khớp. <Link href="/tin-tuc" className={s.link}>Xóa bộ lọc</Link></p>
                    ) : (
                        <div className={s.newsRow}>{d.items.map((n) => <NewsCard key={n.id} n={n} />)}</div>
                    )}

                    {d.pages > 1 && (
                        <nav className={s.pager} aria-label="Phân trang">
                            {d.page > 1 && <Link href={href(searchParams, { page: String(d.page - 1) })}>Trang trước</Link>}
                            <span>Trang {d.page} / {d.pages}</span>
                            {d.page < d.pages && <Link href={href(searchParams, { page: String(d.page + 1) })}>Trang sau</Link>}
                        </nav>
                    )}
                </div>
            </section>
        </>
    );
}