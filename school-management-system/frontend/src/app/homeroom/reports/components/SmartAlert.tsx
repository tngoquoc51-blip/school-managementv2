import { AlertTriangle } from 'lucide-react';
import { SmartAlert as SmartAlertType } from '@/types/homeroom-report';

interface Props {
    alerts: SmartAlertType[];
}

export default function SmartAlert({ alerts }: Props) {
    if (!alerts?.length) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-5 text-center text-slate-400 text-sm">
                Không có cảnh báo nào
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-slate-800">Cảnh báo thông minh</h3>
            </div>
            <div className="space-y-3">
                {alerts.map((alert, idx) => (
                    <div
                        key={idx}
                        className={`p-3 rounded-lg border text-sm ${
                            alert.level === 'danger'
                                ? 'bg-red-50 border-red-100'
                                : 'bg-amber-50 border-amber-100'
                        }`}
                    >
                        <p className="font-medium text-slate-800">{alert.student_name}</p>
                        <p className="text-xs text-slate-600 mt-1">{alert.message}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}