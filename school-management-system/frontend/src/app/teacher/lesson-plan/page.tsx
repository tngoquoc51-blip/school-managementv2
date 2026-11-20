import type { Metadata } from 'next';
import LessonPlanApp from './LessonPlanApp';

export const metadata: Metadata = { title: 'Kế hoạch bài dạy – Cổng Giáo viên' };

// Không bọc TeacherLayout ở đây: src/app/teacher/layout.tsx (nếu có) đã bọc sẵn.
export default function Page() {
    return <LessonPlanApp />;
}