export default function AcademicSection() {
    const subjects = [
        { name: 'Toán', avg: 7.8, weak: 3 },
        { name: 'Ngữ văn', avg: 7.5, weak: 2 },
        { name: 'Tiếng Anh', avg: 8.1, weak: 1 },
        { name: 'Vật lý', avg: 7.2, weak: 4 },
        { name: 'Hóa học', avg: 7.6, weak: 2 },
    ];

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-800 mb-4">2. Học lực</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="pb-3 font-medium">Môn học</th>
                        <th className="pb-3 font-medium">Điểm TB</th>
                        <th className="pb-3 font-medium">HS yếu/kém</th>
                    </tr>
                    </thead>
                    <tbody>
                    {subjects.map((s) => (
                        <tr key={s.name} className="border-b border-slate-100">
                            <td className="py-3 font-medium text-slate-800">{s.name}</td>
                            <td className="py-3">{s.avg}</td>
                            <td className="py-3">
                  <span className={s.weak > 2 ? 'text-red-600 font-medium' : 'text-slate-600'}>
                    {s.weak}
                  </span>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
            <p className="text-sm text-slate-500 mt-4">
                Điểm trung bình cả lớp: <strong>7.85</strong>
            </p>
        </div>
    );
}