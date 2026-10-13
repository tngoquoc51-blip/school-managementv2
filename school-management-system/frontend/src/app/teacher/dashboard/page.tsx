'use client';

export default function TeacherDashboard() {
    return (
        <div className="space-y-6">
            {/* Chào mừng */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Xin chào, Giáo viên!</h1>
                    <p className="text-slate-500 mt-1">Hôm nay là Thứ Hai, 10/10/2026</p>
                </div>
            </div>

            {/* Thống kê nhanh */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <p className="text-sm text-slate-500">Lớp đang dạy</p>
                    <p className="text-3xl font-bold text-blue-600 mt-2">6</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <p className="text-sm text-slate-500">Tiết hôm nay</p>
                    <p className="text-3xl font-bold text-emerald-600 mt-2">4</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <p className="text-sm text-slate-500">Chưa nhập điểm</p>
                    <p className="text-3xl font-bold text-amber-500 mt-2">2</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <p className="text-sm text-slate-500">Thông báo mới</p>
                    <p className="text-3xl font-bold text-violet-600 mt-2">3</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Thời khóa biểu hôm nay */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="font-semibold text-lg text-slate-800">Thời khóa biểu hôm nay</h2>
                        <a href="/teacher/schedule" className="text-sm text-blue-600 hover:underline">
                            Xem tất cả
                        </a>
                    </div>

                    <div className="space-y-3">
                        {[
                            { period: 'Tiết 1', subject: 'Toán 12A1', room: 'Phòng 201', time: '07:00 – 07:45', status: 'done' },
                            { period: 'Tiết 3', subject: 'Toán 11B2', room: 'Phòng 305', time: '09:00 – 09:45', status: 'current' },
                            { period: 'Tiết 5', subject: 'Toán 10A3', room: 'Phòng 102', time: '13:30 – 14:15', status: 'upcoming' },
                            { period: 'Tiết 6', subject: 'Toán 12A2', room: 'Phòng 201', time: '14:25 – 15:10', status: 'upcoming' },
                        ].map((item, idx) => (
                            <div
                                key={idx}
                                className={`flex items-center justify-between p-4 rounded-xl border ${
                                    item.status === 'current'
                                        ? 'bg-blue-50 border-blue-200'
                                        : 'bg-slate-50 border-slate-100'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 text-center">
                                        <div className="text-xs text-slate-500">{item.period}</div>
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800">{item.subject}</p>
                                        <p className="text-sm text-slate-500">{item.room}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-slate-700">{item.time}</p>
                                    {item.status === 'current' && (
                                        <span className="text-xs text-blue-600 font-medium">Đang diễn ra</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Việc cần làm */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h2 className="font-semibold text-lg text-slate-800 mb-5">Việc cần làm</h2>
                    <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                            <span className="text-lg">🎯</span>
                            <div>
                                <p className="text-sm font-medium text-slate-800">Nhập điểm 15 phút Toán 12A1</p>
                                <p className="text-xs text-slate-500 mt-0.5">Hạn hôm nay</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-lg">📝</span>
                            <div>
                                <p className="text-sm font-medium text-slate-800">Ghi sổ đầu bài tiết 3</p>
                                <p className="text-xs text-slate-500 mt-0.5">Lớp 11B2</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-lg">📋</span>
                            <div>
                                <p className="text-sm font-medium text-slate-800">Nộp kế hoạch bài dạy tuần 8</p>
                                <p className="text-xs text-slate-500 mt-0.5">Hạn 12/10</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}