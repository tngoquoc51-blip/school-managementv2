import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Patrick_Hand } from 'next/font/google';
import HomeworkPage from '@/modules/student/homework/HomeworkPage';

/* Be Vietnam Pro: giao diện. Patrick Hand: nét bút đỏ của giáo viên (điểm số). Cả hai đủ dấu tiếng Việt. */
const ui = Be_Vietnam_Pro({ subsets: ['vietnamese', 'latin'], weight: ['400', '500', '600', '700'], variable: '--hw-ui', display: 'swap' });
const pen = Patrick_Hand({ subsets: ['vietnamese', 'latin'], weight: '400', variable: '--hw-pen', display: 'swap' });

export const metadata: Metadata = { title: 'Bài tập – Cổng thông tin Học sinh' };

// Không bọc StudentLayout ở đây: src/app/student/layout.tsx đã bọc sẵn.
export default function Page() {
    return <HomeworkPage className={`${ui.variable} ${pen.variable}`} />;
}