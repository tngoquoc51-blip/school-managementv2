import './seating.css';
import type { ReactNode } from 'react';
import SeatingShell from '@/components/hr-seating/Shell';

export const metadata = { title: 'Sơ đồ & Sĩ số lớp – Giáo viên chủ nhiệm' };

export default function SeatingLayout({ children }: { children: ReactNode }) {
    return <SeatingShell>{children}</SeatingShell>;
}