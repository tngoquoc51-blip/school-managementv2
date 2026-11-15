export default function DisciplineSection() {
    const violations = [
        { student: 'Lê Thị Bình', type: 'Đi muộn', date: '15/10/2026', level: 'Nhẹ' },
        { student: 'Phạm Minh Cường', type: 'Không mặc đồng phục', date: '18/10/2026', level: 'Nhẹ' },
        { student: 'Nguyễn Văn An', type: 'Vắng không phép', date: '22/10/2026', level: 'Trung bình' },
    ];

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-800 mb-4">4. Vi phạm & Kỷ luật</h2>
            {violations.length === 0 ? (
                <p className="text-sm text-slate-400">Không có vi phạm trong kỳ</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-slate-200 text-left text-slate-500">
                            <th className="pb-3 font-medium">Học sinh</th>
                            <th className="pb-3 font-medium">Loại vi phạm</th>
                            <th className="pb-3 font-medium">Ngày</th>
                            <th className="pb-3 font-medium">Mức độ</th>
                        </tr>
                        </thead>
                        <tbody>
                        {violations.map((v, i) => (
                            <tr key={i} className="border-b border-slate-100">
                                <td className="py-3 font-medium text-slate-800">{v.student}</td>
                                <td className="py-3">{v.type}</td>
                                <td className="py-3">{v.date}</td>
                                <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        v.level === 'Nhẹ' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {v.level}
                    </span>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}