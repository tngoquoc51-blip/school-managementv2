import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Lora } from 'next/font/google';
import type { ReactNode } from 'react';
import '@/styles/globals.css';
import SystemBanner from '@/components/SystemBanner';

// Cả hai font đều có bộ ký tự tiếng Việt đầy đủ.
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

export const metadata: Metadata = {
    title: 'Hệ thống Quản lý Trường THPT',
    description: 'Quản lý điểm, điểm danh, sổ đầu bài và thời khóa biểu cho trường trung học phổ thông',
    icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="vi" className={`${sans.variable} ${serif.variable}`}>
        <body>
        {children}
        <SystemBanner />
        </body>
        </html>
    );
}