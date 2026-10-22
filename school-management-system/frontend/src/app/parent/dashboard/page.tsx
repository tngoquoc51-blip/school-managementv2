'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ParentLayout from '@/layouts/ParentLayout';
import './dashboard.css';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

type Dash = {
    parentName: string;
    child: { id: number; name: string; className: string; code: string } | null;
    summary: {
        gpa: number | null;
        academic: string | null;
        conduct: string | null;
        absent: number | null;
    };
    notices: { id: number; title: string; time: string }[];
    attendanceWeek: { day: string; status: string }[];
    todaySchedule: { period: number; time: string; subject: string; teacher: string }[];
};

export default function ParentDashboardPage() {
    const [data, setData] = useState<Dash | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('token');
        const ctrl = new AbortController();

        fetch(`${API}/parent/dashboard`, {
            signal: ctrl.signal,
            headers: {
                Accept: 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        })
            .then(async (r) => {
                const json = await r.json().catch(() => ({}));
                if (!r.ok || !json.success) throw new Error(json.message || 'api');
                const d = json.data;
                setData({
                    parentName: d.parent_name || d.parentName || 'Phụ huynh',
                    child: d.child
                        ? {
                            id: d.child.id,
                            name: d.child.name,
                            className: d.child.class_name || d.child.className || '',
                            code: d.child.code || d.child.username || '',
                        }
                        : null,
                    summary: {
                        gpa: d.summary?.gpa ?? null,
                        academic: d.summary?.academic ?? null,
                        conduct: d.summary?.conduct ?? null,
                        absent: d.summary?.absent ?? d.summary?.buoi_nghi ?? null,
                    },
                    notices: (d.notices || []).map((n: any, i: number) => ({
                        id: n.id ?? i,
                        title: n.title,
                        time: n.time || n.created_at || '',
                    })),
                    attendanceWeek: (d.attendance_week || d.attendanceWeek || []).map((a: any) => ({
                        day: a.day,
                        status: a.status,
                    })),
                    todaySchedule: (d.today_schedule || d.todaySchedule || []).map((s: any) => ({
                        period: s.period,
                        time: s.time,
                        subject: s.subject,
                        teacher: s.teacher || '',
                    })),
                });

                if (d.child) {
                    localStorage.setItem(
                        'parent_child',
                        JSON.stringify({
                            id: d.child.id,
                            name: d.child.name,
                            className: d.child.class_name || d.child.className,
                        })
                    );
                }
            })
            .catch(() => {
                // Fallback demo khi API chưa có — bỏ khi API sẵn sàng
                setData({
                    parentName: 'Lê Văn Phụ',
                    child: { id: 0, name: 'Nguyễn Văn A', className: '10A1', code: 'hs…' },
                    summary: { gpa: 8.2, academic: 'Giỏi', conduct: 'Tốt', absent: 0 },
                    notices: [
                        { id: 1, title: 'Thông báo họp phụ huynh cuối kỳ', time: '2 giờ trước' },
                        { id: 2, title: 'Điểm kiểm tra 15 phút môn Toán đã có', time: 'Hôm qua' },
                    ],
                    attendanceWeek: [
                        { day: 'T2', status: 'Có mặt' },
                        { day: 'T3', status: 'Có mặt' },
                        { day: 'T4', status: 'Có mặt' },
                        { day: 'T5', status: 'Có mặt' },
                    ],
                    todaySchedule: [],
                });
                setError('');
            })
            .finally(() => setLoading(false));

        return () => ctrl.abort();
    }, []);

    if (loading) {
        return (
            <ParentLayout>
                <div className="phd-skel">Đang tải…</div>
            </ParentLayout>
        );
    }

    if (!data) {
        return (
            <ParentLayout>
                <div className="phd-alert">Không tải được dữ liệu.</div>
            </ParentLayout>
        );
    }

    const s = data.summary;

    return (
        <ParentLayout>
            <div className="phd">
                <section className="phd-hero">
                    <div>
                        <p className="phd-eyebrow">Xin chào</p>
                        <h2>{data.parentName}</h2>
                        <p className="phd-sub">
                            {data.child
                                ? <>Đang xem: <b>{data.child.name}</b> · Lớp {data.child.className}</>
                                : 'Chưa chọn con — vào mục Chọn con để theo dõi'}
                        </p>
                    </div>
                    <Link href="/parent/children" className="phd-btn">
                        Đổi / chọn con
                    </Link>
                </section>

                <div className="phd-stats">
                    <div className="phd-stat sky">
                        <span className="val">{s.gpa ?? '—'}</span>
                        <span className="lbl">Điểm TB HK</span>
                    </div>
                    <div className="phd-stat green">
                        <span className="val">{s.academic || '—'}</span>
                        <span className="lbl">Học lực</span>
                    </div>
                    <div className="phd-stat violet">
                        <span className="val">{s.conduct || '—'}</span>
                        <span className="lbl">Rèn luyện</span>
                    </div>
                    <div className="phd-stat amber">
                        <span className="val">{s.absent ?? '—'}</span>
                        <span className="lbl">Buổi nghỉ</span>
                    </div>
                </div>

                <div className="phd-grid">
                    <section className="phd-card">
                        <div className="phd-card-head">
                            <h3>Thông báo gần đây</h3>
                            <Link href="/parent/notifications">Xem tất cả</Link>
                        </div>
                        <ul className="phd-list">
                            {data.notices.length === 0 && <li className="empty">Chưa có thông báo</li>}
                            {data.notices.map((n) => (
                                <li key={n.id}>
                                    <span className="dot" />
                                    <div>
                                        <b>{n.title}</b>
                                        <small>{n.time}</small>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="phd-card">
                        <div className="phd-card-head">
                            <h3>Chuyên cần tuần này</h3>
                            <Link href="/parent/attendance">Chi tiết</Link>
                        </div>
                        <div className="phd-week">
                            {data.attendanceWeek.length === 0 && <p className="empty">Chưa có dữ liệu</p>}
                            {data.attendanceWeek.map((a) => (
                                <div key={a.day} className="phd-week-item">
                                    <span>{a.day}</span>
                                    <b className={a.status.includes('vắng') || a.status.includes('Vắng') ? 'bad' : 'ok'}>
                                        {a.status}
                                    </b>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="phd-quick">
                    <Link href="/parent/grades" className="phd-q">Bảng điểm</Link>
                    <Link href="/parent/schedule" className="phd-q">Thời khóa biểu</Link>
                    <Link href="/parent/fees" className="phd-q">Học phí</Link>
                    <Link href="/parent/leave" className="phd-q">Xin nghỉ phép</Link>
                    <Link href="/parent/messages" className="phd-q">Nhắn GVCN</Link>
                </div>
            </div>
        </ParentLayout>
    );
}