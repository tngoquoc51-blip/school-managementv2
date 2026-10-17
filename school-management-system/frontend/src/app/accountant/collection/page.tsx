'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

export default function AccountantCollectionPage() {
    const [studentCode, setStudentCode] = useState('');
    const [className, setClassName] = useState('');
    const [student, setStudent] = useState<any>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const search = () => {
        setLoading(true);
        setError('');
        setStudent(null);
        const params = new URLSearchParams();
        if (studentCode.trim()) params.set('q', studentCode.trim());
        if (className) params.set('class', className);

        fetch(`${API}/accountant/students/search?${params}`)
            .then(async (r) => {
                const json = await r.json();
                if (!r.ok || !json.success) {
                    setError(json.message || 'Không tìm thấy học sinh');
                    return;
                }
                setStudent(json.data);
            })
            .catch(() => setError('Lỗi kết nối API'))
            .finally(() => setLoading(false));
    };

    return (
        <div className="acc-page">
            <div className="acc-hero">
                <h1>Thu học phí</h1>
                <p>Tìm học sinh theo mã / tên / lớp · Dữ liệu từ hệ thống</p>
            </div>

            <div className="acc-panel">
                <h2>Tìm học sinh</h2>
                <div className="acc-toolbar">
                    <input
                        className="acc-input"
                        style={{ minWidth: 220 }}
                        placeholder="Mã HS / Họ tên..."
                        value={studentCode}
                        onChange={(e) => setStudentCode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && search()}
                    />
                    <select className="acc-select" value={className} onChange={(e) => setClassName(e.target.value)}>
                        <option value="">Chọn lớp</option>
                        <option value="10A1">10A1</option>
                        <option value="10A2">10A2</option>
                        <option value="10A3">10A3</option>
                        <option value="11B1">11B1</option>
                        <option value="11B2">11B2</option>
                        <option value="12A1">12A1</option>
                        <option value="12A3">12A3</option>
                    </select>
                    <button type="button" className="acc-btn-primary" onClick={search} disabled={loading}>
                        {loading ? 'Đang tìm...' : 'Tìm kiếm'}
                    </button>
                </div>

                {error && <p style={{ color: '#dc2626', marginTop: 8 }}>{error}</p>}

                {student && (
                    <div style={{ marginTop: 12, padding: 16, background: '#f0f9ff', borderRadius: 12, border: '1px solid #e0f2fe' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                                <div style={{ fontWeight: 700, color: '#0c4a6e', fontSize: 16 }}>{student.name}</div>
                                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                                    Mã HS: {student.code} · Lớp {student.class}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 12, color: '#64748b' }}>Trạng thái</div>
                                <span className={student.remain_total > 0 ? 'acc-badge-partial' : 'acc-badge-ok'}>
                  {student.status_label}
                </span>
                            </div>
                        </div>

                        <div className="acc-table-wrap" style={{ marginTop: 16 }}>
                            <table className="acc-table">
                                <thead>
                                <tr>
                                    <th>Khoản thu</th>
                                    <th>Phải thu</th>
                                    <th>Đã thu</th>
                                    <th>Còn lại</th>
                                    <th>Thu thêm</th>
                                </tr>
                                </thead>
                                <tbody>
                                {(student.debts || []).map((d: any) => (
                                    <tr key={d.id}>
                                        <td>{d.fee_name}</td>
                                        <td>{d.amount_due_label}</td>
                                        <td className="acc-money green">{d.amount_paid_label}</td>
                                        <td className="acc-money red">{d.remain_label}</td>
                                        <td>
                                            <input
                                                className="acc-input"
                                                style={{ width: 110 }}
                                                defaultValue={d.remain > 0 ? d.remain : 0}
                                                disabled={d.remain <= 0}
                                            />
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <select className="acc-select" defaultValue="cash">
                                <option value="cash">Tiền mặt</option>
                                <option value="transfer">Chuyển khoản</option>
                            </select>
                            <button type="button" className="acc-btn-primary">
                                Ghi nhận & In phiếu thu
                            </button>
                        </div>
                        <p style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>
                            * Nút ghi nhận sẽ nối API POST ở bước sau (hiện mới xem được công nợ thật).
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}