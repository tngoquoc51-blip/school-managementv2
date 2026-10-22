'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getStudentToken, useCurrentStudent } from '@/hooks/useCurrentStudent';
import './dashboard.css';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

interface Lesson { period: number; subject: string; teacher: string }
interface Stats { label: string; gpa: number | null; academic: string; conduct: string }

const rankOf = (n: number) => (n >= 8 ? 'Giỏi' : n >= 6.5 ? 'Khá' : n >= 5 ? 'Trung bình' : n >= 3.5 ? 'Yếu' : 'Kém');

/** Tính điểm TB + học lực + rèn luyện của học kỳ gần nhất đã có điểm (năm học hiện tại). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pickStats(data: any): Stats | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const years: any[] = data?.years ?? [];
    const y = years.find((x) => x.is_current) ?? years[years.length - 1];
    if (!y) return null;
    for (const key of ['hk2', 'hk1'] as const) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scored = (y.semesters?.[key] ?? []).filter((r: any) => typeof r.tbm === 'number');
        if (scored.length) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const avg = scored.reduce((a: number, r: any) => a + r.tbm, 0) / scored.length;
            return {
                label: key === 'hk2' ? 'HK2' : 'HK1',
                gpa: Math.round(avg * 10) / 10,
                academic: rankOf(avg),
                conduct: y.conduct?.[key] || '—',
            };
        }
    }
    return null;
}

const WEEKDAY_VN = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export default function StudentDashboard() {
    const { student, loading } = useCurrentStudent();
    const [stats, setStats] = useState<Stats | null>(null);
    const [lessons, setLessons] = useState<Lesson[] | null>(null);
    const [times, setTimes] = useState<Record<number, string>>({});

    useEffect(() => {
        const token = getStudentToken();
        if (!token) return;
        const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };

        fetch(`${API}/hs/grades`, { headers })
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => j?.data && setStats(pickStats(j.data)))
            .catch(() => {});

        fetch(`${API}/hs/schedule`, { headers })
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => {
                const d = j?.data;
                if (!d) return;
                const t: Record<number, string> = {};
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (d.periods ?? []).forEach((p: any) => { t[p.period] = p.start; });
                setTimes(t);
                const js = new Date().getDay(); // 0 = Chủ nhật
                const wd = js === 0 ? 8 : js + 1; // 2 = Thứ Hai … 7 = Thứ Bảy
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const day = (d.days ?? []).find((x: any) => x.weekday === wd);
                setLessons(day ? day.lessons : []);
            })
            .catch(() => {});
    }, []);

    const today = new Date().toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    if (loading) {
        return <div className="st-dashboard" style={{ padding: 24 }}>Đang tải...</div>;
    }

    const name = student?.full_name || 'Học sinh';
    const className = student?.class_name || '';

    return (
        <div className="st-dashboard">
            <div className="st-banner">
                <div className="st-banner-text">
                    <p className="st-banner-hello">Chào buổi sáng,</p>
                    <h1>{name}</h1>
                    <p className="st-banner-date">
                        {today}
                        {className ? ` · Lớp ${className}` : ''}
                    </p>
                </div>
                <div className="st-banner-icon">🎓</div>
            </div>

            {/* Giữ nguyên 4 ô quick + stats + 2 cột — số liệu sau nối API /student/dashboard */}
            <div className="st-quick-grid">
                <Link href="/student/schedule" className="st-quick-card">
                    <div className="st-quick-icon blue">📅</div>
                    <div>
                        <h3>Thời khóa biểu</h3>
                        <p>Xem lịch học tuần</p>
                    </div>
                </Link>
                <Link href="/student/grades" className="st-quick-card">
                    <div className="st-quick-icon green">📊</div>
                    <div>
                        <h3>Góc Học Tập</h3>
                        <p>Điểm các môn học</p>
                    </div>
                </Link>
                <Link href="/student/attendance" className="st-quick-card">
                    <div className="st-quick-icon orange">✅</div>
                    <div>
                        <h3>Chuyên cần</h3>
                        <p>Điểm danh & nghỉ học</p>
                    </div>
                </Link>
                <Link href="/student/notifications" className="st-quick-card">
                    <div className="st-quick-icon red">🔔</div>
                    <div>
                        <h3>Thông báo</h3>
                        <p>Tin mới từ nhà trường</p>
                    </div>
                </Link>
            </div>

            {/* Phần stats + thông báo + lịch hôm nay giữ UI như cũ;
          khi có API /student/dashboard thì thay số hardcode */}
            <div className="st-stats">
                <div className="st-stat-card">
                    <p className="st-stat-label">Điểm TB {stats?.label ?? 'HK'}</p>
                    <p className="st-stat-value sky">{stats?.gpa !== null && stats?.gpa !== undefined ? stats.gpa.toFixed(1) : '—'}</p>
                </div>
                <div className="st-stat-card">
                    <p className="st-stat-label">Học lực</p>
                    <p className="st-stat-value green">{stats?.academic ?? '—'}</p>
                </div>
                <div className="st-stat-card">
                    <p className="st-stat-label">Rèn luyện</p>
                    <p className="st-stat-value blue">{stats?.conduct ?? '—'}</p>
                </div>
                <div className="st-stat-card">
                    <p className="st-stat-label">Số buổi nghỉ</p>
                    <p className="st-stat-value">—</p>
                </div>
            </div>

            <div className="st-two-col">
                <div className="st-panel">
                    <div className="st-panel-head">
                        <h2>Thông báo nhà trường</h2>
                        <Link href="/student/notifications">Xem tất cả</Link>
                    </div>
                    <div className="st-notice-list">
                        <div className="st-notice-item">
                            <div className="st-notice-dot" />
                            <div>
                                <p className="st-notice-title">Lịch thi giữa kỳ I năm học 2025-2026</p>
                                <p className="st-notice-date">08/10/2026</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="st-panel">
                    <div className="st-panel-head">
                        <h2>Lịch học hôm nay</h2>
                        <Link href="/student/schedule">Xem TKB</Link>
                    </div>
                    {lessons === null ? (
                        <p style={{ fontSize: 13.5, color: '#64748b', margin: 0 }}>Đang tải thời khóa biểu...</p>
                    ) : lessons.length === 0 ? (
                        <p style={{ fontSize: 13.5, color: '#64748b', margin: 0 }}>
                            {WEEKDAY_VN[new Date().getDay()]} không có tiết học. Xem lịch cả tuần tại mục Lịch học
                            {className ? ` (lớp ${className})` : ''}.
                        </p>
                    ) : (
                        <div className="st-notice-list">
                            {lessons.map((l) => (
                                <div className="st-notice-item" key={l.period}>
                                    <div className="st-notice-dot" />
                                    <div>
                                        <p className="st-notice-title">
                                            Tiết {l.period}{times[l.period] ? ` · ${times[l.period]}` : ''} — {l.subject}
                                        </p>
                                        <p className="st-notice-date">GV: {l.teacher}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}