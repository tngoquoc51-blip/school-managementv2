export default function AttendanceSection() {
    const data = [
        { label: 'Có mặt', value: 38, color: 'bg-green-500' },
        { label: 'Vắng có phép', value: 2, color: 'bg-blue-500' },
        { label: 'Vắng không phép', value: 1, color: 'bg-red-500' },
        { label: 'Đi muộn', value: 3, color: 'bg-amber-500' },
    ];

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-800 mb-4">1. Chuyên cần</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {data.map((item) => (
                    <div key={item.label} className="p-4 rounded-lg bg-slate-50">
                        <div className="flex items-center gap-2 mb-1">
                            <div className={`w-3 h-3 rounded-full ${item.color}`} />
                            <span className="text-sm text-slate-600">{item.label}</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-800">{item.value}</p>
                    </div>
                ))}
            </div>
            <p className="text-sm text-slate-500 mt-4">
                Tỷ lệ chuyên cần trung bình: <strong>96.2%</strong>
            </p>
        </div>
    );
}