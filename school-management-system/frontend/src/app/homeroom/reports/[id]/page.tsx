'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Edit, Send, CheckCircle2, Clock,
    Users, TrendingUp, Calendar, AlertTriangle, FileText
} from 'lucide-react';
import { HomeroomReport } from '@/types/homeroom-report';
import StatusBadge from '../components/StatusBadge';
import ExportButtons from '../components/ExportButtons';
import AttendanceSection from '../components/AttendanceSection';
import AcademicSection from '../components/AcademicSection';
import ConductSection from '../components/ConductSection';
import DisciplineSection from '../components/DisciplineSection';

export default function ReportDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = Number(params.id);

    const [report, setReport] = useState<HomeroomReport | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Mock data - thay bằng API thật
        const mock: HomeroomReport = {
            id,
            class_id: 1,
            class_name: '10A1',
            teacher_id: 2,
            teacher_name: 'Trần Xuân Hậu',
            report_type: 'monthly',
            title: 'Báo cáo tháng 10/2026 - Lớp 10A1',
            period_start: '2026-10-01',
            period_end: '2026-10-31',
            academic_year: '2025-2026',
            semester: 1,
            status: 'submitted',
            summary: {
                total_students: 42,
                avg_score: 7.85,
                attendance_rate: 96.2,
                good_conduct: 38,
                violations: 3,
                need_attention: 4,
            },
            content: 'Lớp có tinh thần học tập tốt. Một số học sinh còn cần nhắc nhở về chuyên cần và ý thức.',
            submitted_at: '2026-11-02T08:30:00',
            created_at: '2026-11-01T14:00:00',
            updated_at: '2026-11-02T08:30:00',
        };

        setTimeout(() => {
            setReport(mock);
            setLoading(false);
        }, 400);
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <p className="text-slate-400">Đang tải báo cáo...</p>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <p className="text-slate-500">Không tìm thấy báo cáo</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/homeroom/reports" className="p-2 hover:bg-slate-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold text-slate-800">{report.title}</h1>
                                <StatusBadge status={report.status} />
                            </div>
                            <p className="text-sm text-slate-500 mt-0.5">
                                {report.class_name} • {report.period_start} → {report.period_end}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <ExportButtons reportId={report.id} />
                        {report.status === 'draft' && (
                            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
                                <Send className="w-4 h-4" /> Gửi báo cáo
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="bg-white rounded-xl p-4 border border-slate-200">
                        <p className="text-xs text-slate-500">Sĩ số</p>
                        <p className="text-xl font-bold text-slate-800 mt-1">{report.summary.total_students}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-slate-200">
                        <p className="text-xs text-slate-500">Điểm TB</p>
                        <p className="text-xl font-bold text-slate-800 mt-1">{report.summary.avg_score}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-slate-200">
                        <p className="text-xs text-slate-500">Chuyên cần</p>
                        <p className="text-xl font-bold text-slate-800 mt-1">{report.summary.attendance_rate}%</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-slate-200">
                        <p className="text-xs text-slate-500">Hạnh kiểm tốt</p>
                        <p className="text-xl font-bold text-slate-800 mt-1">{report.summary.good_conduct}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-slate-200">
                        <p className="text-xs text-slate-500">Vi phạm</p>
                        <p className="text-xl font-bold text-red-600 mt-1">{report.summary.violations}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-slate-200">
                        <p className="text-xs text-slate-500">Cần chú ý</p>
                        <p className="text-xl font-bold text-amber-600 mt-1">{report.summary.need_attention}</p>
                    </div>
                </div>

                {/* Sections */}
                <AttendanceSection />
                <AcademicSection />
                <ConductSection />
                <DisciplineSection />

                {/* Nhận xét */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        Nhận xét của Giáo viên Chủ nhiệm
                    </h2>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                        {report.content || 'Chưa có nhận xét.'}
                    </p>
                </div>
            </div>
        </div>
    );
}