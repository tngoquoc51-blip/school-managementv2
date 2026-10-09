import '@/styles/globals.css';
import type { ReactNode } from 'react';
import { Be_Vietnam_Pro, Lora } from 'next/font/google';

const sans = Be_Vietnam_Pro({
    subsets: ['vietnamese', 'latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-sans',
    display: 'swap',
});

const serif = Lora({
    subsets: ['vietnamese', 'latin'],
    weight: ['600', '700'],
    variable: '--font-serif',
    display: 'swap',
});

export const metadata = {
    title: 'Hệ thống Quản lý Trường THPT',
    description: 'Quản lý điểm, điểm danh, sổ đầu bài và thời khóa biểu cho trường trung học phổ thông',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="vi" className={`${sans.variable} ${serif.variable}`}>
        <body>{children}</body>
        </html>
    );
}