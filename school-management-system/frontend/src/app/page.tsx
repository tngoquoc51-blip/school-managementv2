import type { Metadata } from 'next';
import SiteFrame from '@/modules/website/components/SiteFrame';
import HomePage from '@/modules/website/HomePage';
import { SCHOOL } from '@/modules/website/data/school';

/* Trang chủ website, giữ ở đúng chỗ src/app/page.tsx.
   Nội dung trang nằm trong modules/website/HomePage.tsx. */
export const metadata: Metadata = {
    title: `${SCHOOL.fullName}: giới thiệu và tuyển sinh`,
    description: `${SCHOOL.slogan} ${SCHOOL.intro}`,
};

export default function Page() {
    return (
        <SiteFrame>
            <HomePage />
        </SiteFrame>
    );
}