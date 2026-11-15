'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Plus, Filter, Clock, Send, CheckCircle2 } from 'lucide-react';
import type { HomeroomReport, SmartAlert } from '@/types/homeroom-report';
import c from './reports.module.css';

const STATUS_LABEL: Record<string, string> = {
    draft: 'Bản nháp',
    submitted: 'Đã gửi',
    approved: 'Đã duyệt',
};

const STATUS_BADGE: Record<string, string> = {
    draft: c.badgeDraft,
    submitted: c.badgeSent,
    approved: c.badgeOk,
};

export default function HomeroomReportsPage() {
    const [reports, setReports] = useState<HomeroomReport[]>([]);
    const [alerts, setAlerts] = useState<SmartAlert[]>([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setReports([
            {
                id: 1, class_id: 1, class_name: '10A1', teacher_id: 2, teacher_name: 'Trần Xuân Hậu',
                report_type: 'monthly', title: 'Báo cáo tháng 10/2026 - Lớp 10A1',
                period_start: '2026-10-01', period_end: '2026-10-31',
                academic_year: '2025-2026', semester: 1, status: 'submitted',
                summary: { total_students: 42, avg_score: 7.85, attendance_rate: 96.2, good_conduct: 38, violations: 3, need_attention: 4 },
                submitted_at: '2026-11-02T08:30:00', created_at: '2026-11-01T14:00:00', updated_at: '2026-11-02T08:30:00',
            },
            {
                id: 2, class_id: 1, class_name: '10A1', teacher_id: 2, teacher_name: 'Trần Xuân Hậu',
                report_type: 'weekly', title: 'Báo cáo tuần 44 - Lớp 10A1',
                period_start: '2026-10-27', period_end: '2026-11-02',
                academic_year: '2025-2026', semester: 1, status: 'draft',
                summary: { total_students: 42, avg_score: 7.9, attendance_rate: 97.1, good_conduct: 40, violations: 1, need_attention: 2 },
                created_at: '2026-11-03T09:15:00', updated_at: '2026-11-03T09:15:00',
            },
            {
                id: 3, class_id: 1, class_name: '10A1', teacher_id: 2, teacher_name: 'Trần Xuân Hậu',
                report_type: 'semester', title: 'Báo cáo tổng kết Học kỳ 1 - Lớp 10A1',
                period_start: '2026-09-01', period_end: '2027-01-15',
                academic_year: '2025-2026', semester: 1, status: 'approved',
                summary: { total_students: 42, avg_score: 7.72, attendance_rate: 95.8, good_conduct: 37, violations: 5, need_attention: 6 },
                submitted_at: '2026-01-20T10:00:00', created_at: '2026-01-18T16:00:00', updated_at: '2026-01-22T11:30:00',
            },
        ]);
        setAlerts([
            { student_id: 12, student_name: 'Nguyễn Văn An', type: 'academic', message: 'Điểm Toán giảm 1.5 điểm so với tháng trước', level: 'warning' },
            { student_id: 18, student_name: 'Lê Thị Bình', type: 'attendance', message: 'Vắng 4 buổi không phép trong tháng', level: 'danger' },
            { student_id: 25, student_name: 'Phạm Minh Cường', type: 'violation', message: 'Vi phạm nội quy 2 lần trong tuần', level: 'warning' },
        ]);
        setLoading(false);
    }, []);

    const filtered = filter === 'all' ? reports : reports.filter((r) => r.status === filter);
    const stats = {
        total: reports.length,
        draft: reports.filter((r) => r.status === 'draft').length,
        submitted: reports.filter((r) => r.status === 'submitted').length,
        approved: reports.filter((r) => r.status === 'approved').length,
    };

    return (
        <div className={c.page}>
            <div className={c.head}>
                <div>
                    <h1><FileText size={26} color="#0284c7" /> Báo cáo Lớp Chủ nhiệm</h1>
                    <p>Quản lý và theo dõi các báo cáo lớp của bạn</p>
                </div>
                <Link href="/homeroom/reports/create" className={c.btnPrimary}>
                    <Plus size={18} /> Tạo báo cáo mới
                </Link>
            </div>

            <div className={c.stats}>
                <div className={c.stat}>
                    <div><label>Tổng báo cáo</label><b>{stats.total}</b></div>
                    <div className={c.statIcon}><FileText size={22} /></div>
                </div>
                <div className={c.stat}>
                    <div><label>Bản nháp</label><b>{stats.draft}</b></div>
                    <div className={`${c.statIcon} ${c.gray}`}><Clock size={22} /></div>
                </div>
                <div className={c.stat}>
                    <div><label>Đã gửi</label><b>{stats.submitted}</b></div>
                    <div className={c.statIcon}><Send size={22} /></div>
                </div>
                <div className={c.stat}>
                    <div><label>Đã duyệt</label><b>{stats.approved}</b></div>
                    <div className={`${c.statIcon} ${c.green}`}><CheckCircle2 size={22} /></div>
                </div>
            </div>

            <div className={c.grid}>
                <div>
                    <div className={c.filters}>
                        <Filter size={16} color="#94a3b8" />
                        {(['all', 'draft', 'submitted', 'approved'] as const).map((f) => (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setFilter(f)}
                                className={`${c.chip} ${filter === f ? c.chipOn : ''}`}
                            >
                                {f === 'all' ? 'Tất cả' : STATUS_LABEL[f]}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className={c.loading}>Đang tải...</div>
                    ) : filtered.length === 0 ? (
                        <div className={c.empty}>Chưa có báo cáo nào</div>
                    ) : (
                        <div className={c.list}>
                            {filtered.map((r) => (
                                <Link key={r.id} href={`/homeroom/reports/${r.id}`} className={c.card}>
                                    <div className={c.cardTop}>
                                        <h3>{r.title}</h3>
                                        <span className={`${c.badge} ${STATUS_BADGE[r.status] || c.badgeDraft}`}>
                                            {STATUS_LABEL[r.status] || r.status}
                                        </span>
                                    </div>
                                    <div className={c.meta}>
                                        {r.period_start} → {r.period_end} · Lớp {r.class_name}
                                    </div>
                                    <div className={c.metrics}>
                                        <div className={c.metric}>
                                            <b>{r.summary.total_students}</b>
                                            <small>Học sinh</small>
                                        </div>
                                        <div className={c.metric}>
                                            <b>{r.summary.avg_score}</b>
                                            <small>ĐTB</small>
                                        </div>
                                        <div className={c.metric}>
                                            <b>{r.summary.attendance_rate}%</b>
                                            <small>Chuyên cần</small>
                                        </div>
                                        <div className={c.metric}>
                                            <b>{r.summary.need_attention}</b>
                                            <small>Cần chú ý</small>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                <div className={c.side}>
                    <div className={c.panel}>
                        <h3>Cảnh báo thông minh</h3>
                        {alerts.length === 0 ? (
                            <p style={{ color: 'var(--mut)', margin: 0 }}>Không có cảnh báo</p>
                        ) : (
                            alerts.map((a) => (
                                <div key={a.student_id} className={`${c.alert} ${a.level === 'danger' ? c.danger : ''}`}>
                                    <b>{a.student_name}</b>
                                    <span>{a.message}</span>
                                </div>
                            ))
                        )}
                    </div>

                    <div className={c.quick}>
                        <h3>Thao tác nhanh</h3>
                        <Link href="/homeroom/reports/create?type=weekly">+ Báo cáo tuần mới</Link>
                        <Link href="/homeroom/reports/create?type=monthly">+ Báo cáo tháng mới</Link>
                        <Link href="/homeroom/reports/create?type=semester">+ Báo cáo học kỳ</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}