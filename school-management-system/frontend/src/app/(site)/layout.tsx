import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import SiteFrame from '@/modules/website/components/SiteFrame';
import { SCHOOL } from '@/modules/website/data/school';

export const metadata: Metadata = {
    title: { default: `${SCHOOL.fullName}: giới thiệu và tuyển sinh`, template: `%s | ${SCHOOL.name}` },
    description: `${SCHOOL.slogan} ${SCHOOL.intro}`,
    openGraph: { title: SCHOOL.fullName, description: SCHOOL.slogan, locale: 'vi_VN', type: 'website' },
};

export default function SiteLayout({ children }: { children: ReactNode }) {
    return <SiteFrame>{children}</SiteFrame>;
}