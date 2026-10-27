'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import './fees.css';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

type FeeItem = {
    id: number;
    stt?: number;
    code?: string;
    name: string;
    description?: string;
    target?: string;
    amount?: string;
    amount_raw?: number;
    period?: string;
    is_mandatory?: boolean;
    status?: string;
    status_label?: string;
};

type FormState = {
    code: string;
    name: string;
    amount: string;
    target_type: string;
    period_type: string;
    semester: string;
    is_mandatory: boolean;
    description: string;
};

const emptyForm: FormState = {
    code: '',
    name: '',
    amount: '',
    target_type: 'all',
    period_type: 'semester',
    semester: '1',
    is_mandatory: true,
    description: '',
};

export default function AccountantFeesPage() {
    const [items, setItems] = useState<FeeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [editId, setEditId] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const url = `${API}/accountant/fees${filter !== 'all' ? `?status=${filter}` : ''}`;
            const r = await fetch(url, { headers: { Accept: 'application/json' } });
            const json = await r.json().catch(() => null);
            if (!r.ok) throw new Error(json?.message || `HTTP ${r.status}`);
            if (!json?.success) throw new Error(json?.message || 'Không tải được');
            setItems(Array.isArray(json.data) ? json.data : []);
        } catch (e: any) {
            setError(e?.message || 'Lỗi kết nối API');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
        const n = q.trim().toLowerCase();
        if (!n) return items;
        return items.filter(
            (x) =>
                x.name?.toLowerCase().includes(n) ||
                x.code?.toLowerCase().includes(n) ||
                x.target?.toLowerCase().includes(n)
        );
    }, [items, q]);

    const openCreate = () => {
        setEditId(null);
        setForm(emptyForm);
        setOpen(true);
    };

    const openEdit = (f: FeeItem) => {
        setEditId(f.id);
        setForm({
            code: f.code || '',
            name: f.name,
            amount: String(f.amount_raw ?? 0),
            target_type: 'all',
            period_type: 'semester',
            semester: '1',
            is_mandatory: !!f.is_mandatory,
            description: f.description || '',
        });
        setOpen(true);
    };

    const save = async () => {
        if (!form.name.trim() || !form.amount) {
            alert('Nhập tên và số tiền');
            return;
        }
        setSaving(true);
        try {
            const body = {
                code: form.code || `FEE_${Date.now().toString(36).toUpperCase()}`,
                name: form.name.trim(),
                amount: parseInt(form.amount.replace(/\D/g, ''), 10) || 0,
                target_type: form.target_type,
                period_type: form.period_type,
                semester: form.period_type === 'semester' ? Number(form.semester) : null,
                is_mandatory: form.is_mandatory,
                description: form.description || null,
                status: 'active',
            };
            const r = await fetch(
                editId ? `${API}/accountant/fees/${editId}` : `${API}/accountant/fees`,
                {
                    method: editId ? 'PUT' : 'POST',
                    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                }
            );
            const json = await r.json().catch(() => null);
            if (!r.ok || !json?.success) throw new Error(json?.message || 'Lưu thất bại');
            setOpen(false);
            await load();
        } catch (e: any) {
            alert(e?.message || 'Lỗi lưu');
        } finally {
            setSaving(false);
        }
    };

    const toggle = async (id: number) => {
        try {
            const r = await fetch(`${API}/accountant/fees/${id}/status`, {
                method: 'PATCH',
                headers: { Accept: 'application/json' },
            });
            const json = await r.json().catch(() => null);
            if (!r.ok || !json?.success) throw new Error(json?.message || 'Không đổi trạng thái');
            await load();
        } catch (e: any) {
            alert(e?.message || 'Lỗi');
        }
    };

    return (
        <div className="fee-page">
            <div className="fee-head">
                <div>
                    <h1>Danh mục học phí & khoản thu</h1>
                    <p>Khai báo các khoản nhà trường thu · Liên kết đợt thu, phiếu thu, công nợ</p>
                </div>
                <div className="fee-head-actions">
                    <Link href="/accountant/periods" className="fee-link">
                        Đợt thu / Kỳ thu
                    </Link>
                    <Link href="/accountant/collection" className="fee-link">
                        Thu học phí
                    </Link>
                    <button type="button" className="fee-btn-primary" onClick={openCreate}>
                        + Thêm khoản thu
                    </button>
                </div>
            </div>

            <div className="fee-stats">
                <div className="fee-stat">
                    <b>{items.length}</b>
                    <span>Tổng khoản</span>
                </div>
                <div className="fee-stat ok">
                    <b>{items.filter((x) => x.status === 'active').length}</b>
                    <span>Đang thu</span>
                </div>
                <div className="fee-stat muted">
                    <b>{items.filter((x) => x.status === 'inactive').length}</b>
                    <span>Ngừng</span>
                </div>
            </div>

            <div className="fee-panel">
                <div className="fee-toolbar">
                    <input
                        className="fee-search"
                        placeholder="Tìm theo tên, mã, đối tượng…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    <div className="fee-seg">
                        {(['all', 'active', 'inactive'] as const).map((k) => (
                            <button
                                key={k}
                                type="button"
                                className={filter === k ? 'on' : ''}
                                onClick={() => setFilter(k)}
                            >
                                {k === 'all' ? 'Tất cả' : k === 'active' ? 'Đang thu' : 'Ngừng'}
                            </button>
                        ))}
                    </div>
                    <button type="button" className="fee-btn-ghost" onClick={load} disabled={loading}>
                        Làm mới
                    </button>
                </div>

                {error && (
                    <div className="fee-alert">
                        <span>{error}</span>
                        <button type="button" onClick={load}>
                            Thử lại
                        </button>
                    </div>
                )}

                <div className="fee-table-wrap">
                    <table className="fee-table">
                        <thead>
                        <tr>
                            <th>STT</th>
                            <th>Mã</th>
                            <th>Tên khoản thu</th>
                            <th>Đối tượng</th>
                            <th className="num">Số tiền</th>
                            <th>Kỳ thu</th>
                            <th>Bắt buộc</th>
                            <th>Trạng thái</th>
                            <th></th>
                        </tr>
                        </thead>
                        <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={9} className="fee-empty">
                                    Đang tải…
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            filtered.map((f, i) => (
                                <tr key={f.id}>
                                    <td>{f.stt ?? i + 1}</td>
                                    <td>
                                        <code>{f.code || '—'}</code>
                                    </td>
                                    <td>
                                        <div className="fee-name">{f.name}</div>
                                        {f.description && <div className="fee-desc">{f.description}</div>}
                                    </td>
                                    <td>{f.target}</td>
                                    <td className="num fee-money">{f.amount} đ</td>
                                    <td>{f.period}</td>
                                    <td>{f.is_mandatory ? 'Có' : 'Không'}</td>
                                    <td>
                                            <span className={`fee-badge ${f.status === 'active' ? 'ok' : 'off'}`}>
                                                {f.status_label}
                                            </span>
                                    </td>
                                    <td className="fee-acts">
                                        <button type="button" onClick={() => openEdit(f)}>
                                            Sửa
                                        </button>
                                        <button type="button" onClick={() => toggle(f.id)}>
                                            {f.status === 'active' ? 'Ngừng' : 'Bật'}
                                        </button>
                                        <Link href={`/accountant/collection?fee_id=${f.id}`}>Thu</Link>
                                    </td>
                                </tr>
                            ))}
                        {!loading && !error && filtered.length === 0 && (
                            <tr>
                                <td colSpan={9} className="fee-empty">
                                    Chưa có khoản thu — bấm «Thêm khoản thu» để khai báo.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>

                <p className="fee-hint">
                    Khoản thu gắn với <Link href="/accountant/periods">đợt thu</Link>, khi thu tạo{' '}
                    <Link href="/accountant/receipts">phiếu thu</Link>; chưa đóng đủ vào{' '}
                    <Link href="/accountant/debts">công nợ</Link>.
                </p>
            </div>

            {open && (
                <div className="fee-modal-bg" onClick={() => setOpen(false)}>
                    <div className="fee-modal" onClick={(e) => e.stopPropagation()}>
                        <h2>{editId ? 'Sửa khoản thu' : 'Thêm khoản thu'}</h2>
                        <div className="fee-form">
                            <label>
                                Mã
                                <input
                                    value={form.code}
                                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                                    placeholder="VD: HP_HK1"
                                />
                            </label>
                            <label>
                                Tên khoản thu *
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Học phí học kỳ 1"
                                />
                            </label>
                            <label>
                                Số tiền (đ) *
                                <input
                                    value={form.amount}
                                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                    inputMode="numeric"
                                    placeholder="1200000"
                                />
                            </label>
                            <label>
                                Đối tượng
                                <select
                                    value={form.target_type}
                                    onChange={(e) => setForm({ ...form, target_type: e.target.value })}
                                >
                                    <option value="all">Toàn trường</option>
                                    <option value="grade">Theo khối</option>
                                    <option value="class">Theo lớp</option>
                                </select>
                            </label>
                            <label>
                                Kỳ thu
                                <select
                                    value={form.period_type}
                                    onChange={(e) => setForm({ ...form, period_type: e.target.value })}
                                >
                                    <option value="semester">Theo học kỳ</option>
                                    <option value="year">Cả năm</option>
                                    <option value="once">Một lần</option>
                                    <option value="month">Hàng tháng</option>
                                </select>
                            </label>
                            {form.period_type === 'semester' && (
                                <label>
                                    Học kỳ
                                    <select
                                        value={form.semester}
                                        onChange={(e) => setForm({ ...form, semester: e.target.value })}
                                    >
                                        <option value="1">HK1</option>
                                        <option value="2">HK2</option>
                                    </select>
                                </label>
                            )}
                            <label className="fee-check">
                                <input
                                    type="checkbox"
                                    checked={form.is_mandatory}
                                    onChange={(e) => setForm({ ...form, is_mandatory: e.target.checked })}
                                />
                                Khoản bắt buộc
                            </label>
                            <label className="full">
                                Mô tả
                                <textarea
                                    rows={2}
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                />
                            </label>
                        </div>
                        <div className="fee-modal-acts">
                            <button type="button" className="fee-btn-ghost" onClick={() => setOpen(false)}>
                                Hủy
                            </button>
                            <button type="button" className="fee-btn-primary" disabled={saving} onClick={save}>
                                {saving ? 'Đang lưu…' : 'Lưu'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}