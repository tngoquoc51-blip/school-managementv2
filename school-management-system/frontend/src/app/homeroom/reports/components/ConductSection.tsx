export default function ConductSection() {
    const levels = [
        { label: 'Tốt', count: 28, color: 'bg-green-500' },
        { label: 'Khá', count: 10, color: 'bg-blue-500' },
        { label: 'Trung bình', count: 3, color: 'bg-amber-500' },
        { label: 'Yếu', count: 1, color: 'bg-red-500' },
    ];

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-800 mb-4">3. Hạnh kiểm</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {levels.map((l) => (
                    <div key={l.label} className="p-4 rounded-lg bg-slate-50 text-center">
                        <div className={`w-3 h-3 rounded-full ${l.color} mx-auto mb-2`} />
                        <p className="text-sm text-slate-600">{l.label}</p>
                        <p className="text-2xl font-bold text-slate-800 mt-1">{l.count}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}