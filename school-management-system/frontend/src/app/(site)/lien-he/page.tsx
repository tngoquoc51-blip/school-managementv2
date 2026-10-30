import type { Metadata } from 'next';
import LienHePage from '@/modules/website/components/LienHe/LienHePage';
import { SCHOOL } from '@/modules/website/data/school';

export const metadata: Metadata = {
    title: 'Liên hệ',
    description: `Địa chỉ, điện thoại, email, bộ phận phụ trách và biểu mẫu liên hệ ${SCHOOL.fullName}.`,
};

export default function Page() {
    return <LienHePage />;
}