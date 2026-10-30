import type { Metadata } from 'next';
import GioiThieuPage from '@/modules/website/components/GioiThieu/GioiThieuPage';
import { SCHOOL } from '@/modules/website/data/school';

export const metadata: Metadata = {
    title: 'Giới thiệu',
    description: `Tầm nhìn, sứ mệnh, lịch sử, đội ngũ và cơ sở vật chất của ${SCHOOL.fullName}.`,
};

export default function Page() {
    return <GioiThieuPage />;
}