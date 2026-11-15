'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Send } from 'lucide-react';

export default function CreateReportPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const defaultType = searchParams.get('type') || 'monthly';

    const [form, setForm] = useState({
        report_type: defaultType,
        title: '',
        period_start: '',
        period_end: '',
        content: '',
        academic_year: '2025-2026',
        semester: 1,
    });

    const [saving, setSaving] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (asDraft = true) => {
        setSaving(true);
        try {
            // TODO: gọi API create
            // await homeroomReportService.createReport({ ...form, status: asDraft ? 'draft' : 'submitted' });
            alert(asDraft ? 'Đã lưu bản nháp' : 'Đã gửi báo cáo');
            router.push('/homeroom/reports');
        } catch (err) {
            alert('Có lỗi xảy ra');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/homeroom/reports" className="p-2 hover:bg-slate-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </Link>
                        <h1 className="text-xl font-bold text-slate-800">Tạo báo cáo mới</h1>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleSubmit(true)}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700"
                        >
                            <Save className="w-4 h-4" /> Lưu nháp
                        </button>
                        <button
                            onClick={() => handleSubmit(false)}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                        >
                            <Send className="w-4 h-4" /> Gửi báo cáo
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-6">
                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Loại báo cáo</label>
                            <select
                                name="report_type"
                                value={form.report_type}
                                onChange={handleChange}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="weekly">Báo cáo tuần</option>
                                <option value="monthly">Báo cáo tháng</option>
                                <option value="semester">Báo cáo học kỳ</option>
                                <option value="yearly">Báo cáo năm học</option>
                                <option value="custom">Tùy chọn</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Học kỳ</label>
                            <select
                                name="semester"
                                value={form.semester}
                                onChange={handleChange}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value={1}>Học kỳ 1</option>
                                <option value={2}>Học kỳ 2</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Tiêu đề báo cáo</label>
                        <input
                            name="title"
                            value={form.title}
                            onChange={handleChange}
                            placeholder="VD: Báo cáo tháng 10/2026 - Lớp 10A1"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Từ ngày</label>
                            <input
                                type="date"
                                name="period_start"
                                value={form.period_start}
                                onChange={handleChange}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Đến ngày</label>
                            <input
                                type="date"
                                name="period_end"
                                value={form.period_end}
                                onChange={handleChange}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Nội dung / Nhận xét</label>
                        <textarea
                            name="content"
                            value={form.content}
                            onChange={handleChange}
                            rows={8}
                            placeholder="Nhập nhận xét tổng quan về lớp..."
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}