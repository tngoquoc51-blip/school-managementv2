import type { Metadata } from 'next';
import DoiSongPage from '@/modules/website/components/DoiSong/DoiSongPage';

export const metadata: Metadata = {
    title: 'Đời sống học đường',
    description: 'Một ngày ở trường, câu lạc bộ, hoạt động trong năm học, bán trú, sức khỏe và nền nếp của học sinh nhà trường.',
};

export default function Page() {
    return <DoiSongPage />;
}