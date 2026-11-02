import type { Metadata } from 'next';
import TraCuuPage from '@/modules/website/components/TuyenSinh/TraCuuPage';

export const metadata: Metadata = {
    title: 'Tra cứu hồ sơ tuyển sinh',
    description: 'Xem tiến độ hồ sơ tuyển sinh bằng mã hồ sơ và số điện thoại đã khai.',
};

export default function Page() {
    return <TraCuuPage />;
}