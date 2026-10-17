import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Be_Vietnam_Pro, Lexend } from 'next/font/google';
import SiteHeader from '@/modules/website/components/SiteHeader';
import SiteFooter from '@/modules/website/components/SiteFooter';
import s from '@/modules/website/website.module.css';
import { SCHOOL } from '@/modules/website/data/school';

/* Phông riêng của website: Lexend (tiêu đề, dễ đọc) + Be Vietnam Pro (nội dung).
   Cả hai đều có đủ dấu tiếng Việt. */
const head = Lexend({ subsets: ['vietnamese', 'latin'], weight: ['500', '600', '700'], variable: '--sk-font-head', display: 'swap' });
const body = Be_Vietnam_Pro({ subsets: ['vietnamese', 'latin'], weight: ['400', '500', '600', '700'], variable: '--sk-font-body', display: 'swap' });

export const metadata: Metadata = {
    title: `${SCHOOL.fullName} – Giới thiệu và tuyển sinh`,
    description: SCHOOL.slogan,
};

export default function SiteLayout({ children }: { children: ReactNode }) {
    return (
        <div className={`${s.site} ${head.variable} ${body.variable}`}>
            <a href="#noi-dung" className={s.skip}>Bỏ qua, tới nội dung chính</a>
            <SiteHeader />
            <main id="noi-dung">{children}</main>
            <SiteFooter />
        </div>
    );
}
