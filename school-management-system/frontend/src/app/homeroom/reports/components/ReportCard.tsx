import Link from 'next/link';
import { Eye, Send, Users, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';
import { HomeroomReport } from '@/types/homeroom-report';
import StatusBadge from './StatusBadge';

const typeMap: Record<string, string> = {
    weekly: 'Tuần',
    monthly: 'Tháng',
    semester: 'Học kỳ',
    yearly: 'Năm học',
    custom: 'Tùy chọn',
};

interface Props {
    report: HomeroomReport;
    onSubmit?: (id: number) => void;
}

export default function ReportCard({ report, onSubmit }: Props) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <StatusBadge status={report.status} />
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
              {typeMap[report.report_type]}
            </span>
                        <span className="text-xs text-slate-400">{report.class_name}</span>
                    </div>

                    <h3 className="font-semibold text-slate-800 text-lg truncate">{report.title}</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        {report.period_start} → {report.period_end}
                    </p>

                    <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-600">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" /> {report.summary.total_students} HS
            </span>
                        <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" /> ĐTB: {report.summary.avg_score}
            </span>
                        <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> {report.summary.attendance_rate}%
            </span>
                        {report.summary.need_attention > 0 && (
                            <span className="flex items-center gap-1.5 text-amber-600">
                <AlertTriangle className="w-4 h-4" /> {report.summary.need_attention} cần chú ý
              </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                    <Link
                        href={`/homeroom/reports/${report.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition"
                    >
                        <Eye className="w-4 h-4" /> Xem
                    </Link>
                    {report.status === 'draft' && onSubmit && (
                        <button
                            onClick={() => onSubmit(report.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium text-blue-700 transition"
                        >
                            <Send className="w-4 h-4" /> Gửi
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}