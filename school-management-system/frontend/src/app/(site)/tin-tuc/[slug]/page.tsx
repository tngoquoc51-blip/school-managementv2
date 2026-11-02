import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import BaiVietPage from '@/modules/website/components/TinTuc/BaiVietPage';
import { API, type NewsItem } from '@/modules/website/lib/api';

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

export default async function Page({ params }: { params: { slug: string } }) {
    const p = await getPost(params.slug);
    if (p === null) notFound();
    if (p === 'down') {
        return (
            <section style={{ padding: '96px 0', textAlign: 'center' }}>
                <h1>Chưa tải được bài viết</h1>
                <p>Máy chủ tin tức tạm thời chưa phản hồi. Vui lòng tải lại trang sau ít phút.</p>
                <p><Link href="/tin-tuc">Về danh sách tin tức</Link></p>
            </section>
        );
    }
    return <BaiVietPage item={p.item} related={p.related} />;
}