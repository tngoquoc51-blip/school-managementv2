import type { Metadata } from 'next';
import ChuongTrinhPage from '@/modules/website/components/ChuongTrinh/ChuongTrinhPage';

export const metadata: Metadata = {
    title: 'Chương trình học',
    description: 'Chương trình Giáo dục phổ thông 2018: môn bắt buộc, môn lựa chọn, hai hướng học, trải nghiệm hướng nghiệp và cách đánh giá.',
};

export default function Page() {
    return <ChuongTrinhPage />;
}