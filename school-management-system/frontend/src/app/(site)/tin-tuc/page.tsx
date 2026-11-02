import type { Metadata } from 'next';
import TinTucPage, { type SP } from '@/modules/website/components/TinTuc/TinTucPage';

export const metadata: Metadata = { title: 'Tin tức và sự kiện', description: 'Thông báo, hoạt động và sự kiện mới nhất của nhà trường.' };

export default function Page({ searchParams }: { searchParams: SP }) {
    return <TinTucPage searchParams={searchParams} />;
}