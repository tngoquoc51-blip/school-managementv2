import type { ReactNode } from 'react';
import { Be_Vietnam_Pro, Bricolage_Grotesque } from 'next/font/google';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import FloatingBar from './FloatingBar';
import s from '../site.module.css';

/* Khung chung của website: phông chữ, đầu trang, chân trang.
   Dùng cho cả trang chủ (src/app/page.tsx) và các trang con trong (site)/.
   Tiêu đề: Bricolage Grotesque. Nội dung: Be Vietnam Pro. Cả hai đều có đủ dấu tiếng Việt. */
const head = Bricolage_Grotesque({ subsets: ['vietnamese', 'latin'], weight: ['600', '700', '800'], variable: '--f-head', display: 'swap' });
const body = Be_Vietnam_Pro({ subsets: ['vietnamese', 'latin'], weight: ['400', '500', '600', '700'], variable: '--f-body', display: 'swap' });

export default function SiteFrame({ children }: { children: ReactNode }) {
    return (
        <div className={`${s.site} ${head.variable} ${body.variable}`}>
            {/* Bỏ lề mặc định 8px của trình duyệt để website tràn hết màn hình */}
            <style>{'html,body{margin:0;padding:0}'}</style>
            <a href="#noi-dung" className={s.skip}>Bỏ qua, tới nội dung chính</a>
            <SiteHeader />
            <main id="noi-dung">{children}</main>
            <SiteFooter />
            <FloatingBar />
        </div>
    );
}