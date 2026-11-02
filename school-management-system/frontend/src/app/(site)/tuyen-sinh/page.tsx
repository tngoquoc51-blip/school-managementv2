import type { Metadata } from 'next';
import TuyenSinhPage from '@/modules/website/components/TuyenSinh/TuyenSinhPage';
import { SCHOOL } from '@/modules/website/data/school';

export const metadata: Metadata = {
    title: 'Tuyển sinh',
    description: `Đăng ký nhập học lớp 10 năm học ${SCHOOL.admissionYear}: quy trình, hồ sơ cần chuẩn bị, mốc thời gian và cách tra cứu tiến độ.`,
};

export default function Page() {
    return <TuyenSinhPage />;
}