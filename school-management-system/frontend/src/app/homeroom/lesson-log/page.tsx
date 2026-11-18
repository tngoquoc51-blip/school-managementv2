'use client';

import LessonLogHub from '@/app/teacher/lesson-log/_components/LessonLogHub';

/**
 * Trang Sổ đầu bài dành cho Giáo viên chủ nhiệm (Homeroom)
 * Route: /homeroom/lesson-log
 */
export default function HomeroomLessonLogPage() {
    return <LessonLogHub mode="homeroom" />;
}
