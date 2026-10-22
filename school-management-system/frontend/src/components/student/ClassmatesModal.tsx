'use client';

import { useEffect, useState } from 'react';
import { getStudentToken } from '@/hooks/useCurrentStudent';
import './classmates-modal.css';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

type Row = { stt: number; id: number; code: string; name: string };

type Props = {
    open: boolean;
    onClose: () => void;
    cell?: {
        subject?: string;
        teacher?: string;
        dayLabel?: string;
        period?: number;
    } | null;
};

export default function ClassmatesModal({ open, onClose, cell }: Props) {
    const [loading, setLoading] = useState(false);
    const [className, setClassName] = useState('');
    const [students, setStudents] = useState<Row[]>([]);
    const [error, setError] = useState('');
    const [q, setQ] = useState('');

    useEffect(() => {
        if (!open) return;

        setLoading(true);
        setError('');
        setQ('');

        const token = getStudentToken();
        if (!token) {
            setError('Chưa đăng nhập');
            setLoading(false);
            return;
        }

        fetch(`${API}/hs/classmates`, {
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
            },
        })
            .then(async (r) => {
                const j = await r.json().catch(() => ({}));
                if (!r.ok || j.success === false) {
                    throw new Error(j.message || `Lỗi ${r.status}`);
                }
                // hỗ trợ cả { success, data } và { data }
                const data = j.data ?? j;
                setClassName(data?.class?.name || '');
                setStudents(Array.isArray(data?.students) ? data.students : []);
            })
            .catch((e) => setError(e.message || 'Không tải được'))
            .finally(() => setLoading(false));
    }, [open]);

    if (!open) return null;

    const filtered = q.trim()
        ? students.filter(
            (s) =>
                s.name.toLowerCase().includes(q.toLowerCase()) ||
                s.code.toLowerCase().includes(q.toLowerCase())
        )
        : students;

    return (
        <div className="cm-overlay" onClick={onClose}>
            <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
                <header className="cm-head">
                    <div>
                        <h2>Danh sách lớp {className || '…'}</h2>
                        {cell?.subject && (
                            <p>
                                {cell.subject}
                                {cell.teacher ? ` · ${cell.teacher}` : ''}
                                {cell.dayLabel ? ` · ${cell.dayLabel}` : ''}
                                {cell.period != null ? ` · Tiết ${cell.period}` : ''}
                            </p>
                        )}
                    </div>
                    <button type="button" className="cm-close" onClick={onClose}>
                        ×
                    </button>
                </header>

                <div className="cm-toolbar">
                    <input
                        type="search"
                        placeholder="Tìm tên hoặc mã HS…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    <span>{filtered.length} học sinh</span>
                </div>

                <div className="cm-body">
                    {loading && <div className="cm-state">Đang tải…</div>}
                    {error && !loading && <div className="cm-state err">{error}</div>}
                    {!loading && !error && (
                        <table className="cm-table">
                            <thead>
                            <tr>
                                <th style={{ width: 56 }}>STT</th>
                                <th style={{ width: 130 }}>Mã học sinh</th>
                                <th>Họ và tên</th>
                            </tr>
                            </thead>
                            <tbody>
                            {filtered.map((s) => (
                                <tr key={s.id}>
                                    <td style={{ textAlign: 'center', color: '#64748b' }}>{s.stt}</td>
                                    <td>
                                        <code>{s.code}</code>
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="cm-state">
                                        Không có học sinh trong lớp
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}