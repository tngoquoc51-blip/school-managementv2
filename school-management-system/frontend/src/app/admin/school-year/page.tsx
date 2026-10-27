'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adm, AdmError } from '@/lib/adminApi';
import './school-year.css';

type Semester = {
    id: number;
    code: number;
    name: string;
    start_date?: string | null;
    end_date?: string | null;
    is_current: boolean;
    status: string;
};

type Year = {
    id: number;
    label: string;
    start_date?: string | null;
    end_date?: string | null;
    is_current: boolean;
    status: string;
    note?: string | null;
    semesters: Semester[];
};

const ST: Record<string, string> = {
    draft: 'Nháp',
    active: 'Đang dùng',
    closed: 'Đã khóa',
    upcoming: 'Sắp tới',
};

function fmt(d?: string | null) {
    if (!d) return '—';
    const x = d.slice(0, 10);
    const [y, m, day] = x.split('-');
    return day && m && y ? `${day}/${m}/${y}` : x;
}

function daysBetween(a?: string | null, b?: string | null) {
    if (!a || !b) return null;
    const t = (Date.parse(b) - Date.parse(a)) / 86400000;
    return Number.isFinite(t) ? Math.round(t) : null;
}

export default function AdminSchoolYearPage() {
    const [years, setYears] = useState<Year[]>([]);
    const [stats, setStats] = useState({ total: 0, active: 0, draft: 0, closed: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [msg, setMsg] = useState('');
    const [openAdd, setOpenAdd] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ label: '', start_date: '', end_date: '', note: '' });
    const [selected, setSelected] = useState<Year | null>(null);
    const [editSem, setEditSem] = useState<Semester | null>(null);
    const [tab, setTab] = useState<'overview' | 'semesters' | 'timeline'>('overview');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const r = await adm<{ years: Year[]; stats: typeof stats; current?: Year }>('school-years');
            const list = r.data.years || [];
            setYears(list);
            setStats(r.data.stats || { total: 0, active: 0, draft: 0, closed: 0 });
            setSelected((prev) => {
                if (prev) {
                    const found = list.find((y) => y.id === prev.id);
                    if (found) return found;
                }
                return list.find((y) => y.is_current) || list[0] || null;
            });
        } catch (e) {
            setError(e instanceof AdmError ? e.message : 'Không tải được dữ liệu');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const toast = (t: string) => {
        setMsg(t);
        setTimeout(() => setMsg(''), 2800);
    };

    const createYear = async () => {
        if (!form.label.trim()) return;
        setSaving(true);
        try {
            await adm('school-years', { method: 'POST', body: form });
            setOpenAdd(false);
            setForm({ label: '', start_date: '', end_date: '', note: '' });
            toast('Đã tạo năm học');
            await load();
        } catch (e) {
            setError(e instanceof AdmError ? e.message : 'Lỗi tạo năm học');
        } finally {
            setSaving(false);
        }
    };

    const setCurrent = async (id: number) => {
        if (!confirm('Đặt năm học này làm năm hiện tại toàn hệ thống?')) return;
        try {
            await adm(`school-years/${id}/set-current`, { method: 'POST' });
            toast('Đã đổi năm học hiện tại');
            await load();
        } catch (e) {
            setError(e instanceof AdmError ? e.message : 'Lỗi');
        }
    };

    const saveSemester = async () => {
        if (!editSem) return;
        setSaving(true);
        try {
            await adm(`semesters/${editSem.id}`, {
                method: 'PUT',
                body: {
                    name: editSem.name,
                    start_date: editSem.start_date,
                    end_date: editSem.end_date,
                    status: editSem.status,
                    is_current: editSem.is_current,
                },
            });
            setEditSem(null);
            toast('Đã lưu học kỳ');
            await load();
        } catch (e) {
            setError(e instanceof AdmError ? e.message : 'Lỗi lưu học kỳ');
        } finally {
            setSaving(false);
        }
    };

    const current = useMemo(() => years.find((y) => y.is_current) || null, [years]);
    const semCount = selected?.semesters?.length ?? 0;
    const span = daysBetween(selected?.start_date, selected?.end_date);

    return (
        <div className="sy2">
            {/* Top bar */}
            <div className="sy2-top">
                <div>
                    <h1>Năm học & Học kỳ</h1>
                    <p>Niên khóa · đặt năm hiện tại · cấu hình HK1 / HK2 · xem chi tiết</p>
                </div>
                <div className="sy2-top-acts">
                    <button type="button" className="sy2-btn ghost" onClick={load}>
                        Làm mới
                    </button>
                    <button type="button" className="sy2-btn primary" onClick={() => setOpenAdd(true)}>
                        + Thêm năm học
                    </button>
                </div>
            </div>

            {msg && <div className="sy2-toast ok">{msg}</div>}
            {error && (
                <div className="sy2-toast err">
                    {error}
                    <button type="button" onClick={load}>
                        Thử lại
                    </button>
                </div>
            )}

            {/* KPI */}
            <div className="sy2-kpi">
                <div className="sy2-kpi-card c-total">
                    <span>Tổng năm học</span>
                    <b>{stats.total}</b>
                    <small>Trong hệ thống</small>
                </div>
                <div className="sy2-kpi-card c-active">
                    <span>Đang dùng</span>
                    <b>{stats.active}</b>
                    <small>{current ? current.label : '—'}</small>
                </div>
                <div className="sy2-kpi-card c-draft">
                    <span>Nháp</span>
                    <b>{stats.draft}</b>
                    <small>Chưa kích hoạt</small>
                </div>
                <div className="sy2-kpi-card c-closed">
                    <span>Đã khóa</span>
                    <b>{stats.closed}</b>
                    <small>Lưu trữ</small>
                </div>
            </div>

            {loading ? (
                <div className="sy2-loading">Đang tải dữ liệu…</div>
            ) : (
                <div className="sy2-body">
                    {/* Left: year list */}
                    <aside className="sy2-side">
                        <div className="sy2-side-head">Danh sách niên khóa</div>
                        <div className="sy2-year-list">
                            {years.map((y) => (
                                <button
                                    key={y.id}
                                    type="button"
                                    className={`sy2-year-item ${selected?.id === y.id ? 'on' : ''} ${y.is_current ? 'cur' : ''}`}
                                    onClick={() => {
                                        setSelected(y);
                                        setTab('overview');
                                    }}
                                >
                                    <div className="sy2-year-item-top">
                                        <strong>{y.label}</strong>
                                        {y.is_current && <em>Hiện tại</em>}
                                    </div>
                                    <div className="sy2-year-item-meta">
                                        <span className={`sy2-pill ${y.status}`}>{ST[y.status] || y.status}</span>
                                        <span>
                                            {fmt(y.start_date)} – {fmt(y.end_date)}
                                        </span>
                                    </div>
                                    <div className="sy2-year-item-foot">
                                        {(y.semesters?.length || 0) > 0
                                            ? `${y.semesters.length} học kỳ`
                                            : 'Chưa có học kỳ'}
                                    </div>
                                </button>
                            ))}
                            {years.length === 0 && <div className="sy2-empty">Chưa có năm học</div>}
                        </div>
                    </aside>

                    {/* Right: detail */}
                    <main className="sy2-main">
                        {!selected ? (
                            <div className="sy2-empty">Chọn một năm học bên trái</div>
                        ) : (
                            <>
                                <div className="sy2-detail-head">
                                    <div>
                                        <h2>
                                            {selected.label}
                                            {selected.is_current && <em>Năm hiện tại</em>}
                                        </h2>
                                        <p>
                                            {fmt(selected.start_date)} → {fmt(selected.end_date)}
                                            {span != null && ` · ${span} ngày`}
                                        </p>
                                    </div>
                                    <div className="sy2-detail-acts">
                                        {!selected.is_current && (
                                            <button
                                                type="button"
                                                className="sy2-btn primary"
                                                onClick={() => setCurrent(selected.id)}
                                            >
                                                Đặt làm hiện tại
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Quick action chips */}
                                <div className="sy2-chips">
                                    <button
                                        type="button"
                                        className={`sy2-chip ${tab === 'overview' ? 'on' : ''}`}
                                        onClick={() => setTab('overview')}
                                    >
                                        Tổng quan
                                    </button>
                                    <button
                                        type="button"
                                        className={`sy2-chip sky ${tab === 'semesters' ? 'on' : ''}`}
                                        onClick={() => setTab('semesters')}
                                    >
                                        Học kỳ ({semCount})
                                    </button>
                                    <button
                                        type="button"
                                        className={`sy2-chip violet ${tab === 'timeline' ? 'on' : ''}`}
                                        onClick={() => setTab('timeline')}
                                    >
                                        Dòng thời gian
                                    </button>
                                    <button
                                        type="button"
                                        className="sy2-chip emerald"
                                        onClick={() => setTab('semesters')}
                                    >
                                        Sửa HK nhanh
                                    </button>
                                </div>

                                {tab === 'overview' && (
                                    <div className="sy2-panel">
                                        <div className="sy2-mini-grid">
                                            <div className="sy2-mini sky">
                                                <span>Trạng thái</span>
                                                <b>{ST[selected.status] || selected.status}</b>
                                            </div>
                                            <div className="sy2-mini blue">
                                                <span>Số học kỳ</span>
                                                <b>{semCount}</b>
                                            </div>
                                            <div className="sy2-mini green">
                                                <span>HK đang học</span>
                                                <b>
                                                    {selected.semesters?.find((s) => s.is_current)?.name || '—'}
                                                </b>
                                            </div>
                                            <div className="sy2-mini amber">
                                                <span>Ghi chú</span>
                                                <b className="small">{selected.note || 'Không có'}</b>
                                            </div>
                                        </div>
                                        <div className="sy2-hint">
                                            <p>
                                                <strong>Thao tác gợi ý:</strong> mở tab <em>Học kỳ</em> để chỉnh ngày
                                                bắt đầu/kết thúc HK1–HK2; dùng <em>Đặt làm hiện tại</em> khi chuyển
                                                niên khóa toàn trường.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {tab === 'semesters' && (
                                    <div className="sy2-panel">
                                        <div className="sy2-sem-grid">
                                            {(selected.semesters || []).map((s) => (
                                                <div
                                                    key={s.id}
                                                    className={`sy2-sem-card ${s.is_current ? 'on' : ''} st-${s.status}`}
                                                >
                                                    <div className="sy2-sem-card-top">
                                                        <strong>{s.name}</strong>
                                                        <span className={`sy2-pill ${s.status}`}>
                                                            {ST[s.status] || s.status}
                                                        </span>
                                                    </div>
                                                    <ul className="sy2-sem-meta">
                                                        <li>
                                                            <span>Bắt đầu</span>
                                                            <b>{fmt(s.start_date)}</b>
                                                        </li>
                                                        <li>
                                                            <span>Kết thúc</span>
                                                            <b>{fmt(s.end_date)}</b>
                                                        </li>
                                                        <li>
                                                            <span>Thời lượng</span>
                                                            <b>
                                                                {daysBetween(s.start_date, s.end_date) != null
                                                                    ? `${daysBetween(s.start_date, s.end_date)} ngày`
                                                                    : '—'}
                                                            </b>
                                                        </li>
                                                        <li>
                                                            <span>Hiện hành</span>
                                                            <b>{s.is_current ? 'Có' : 'Không'}</b>
                                                        </li>
                                                    </ul>
                                                    <div className="sy2-sem-acts">
                                                        <button
                                                            type="button"
                                                            className="sy2-btn ghost sm"
                                                            onClick={() => setEditSem({ ...s })}
                                                        >
                                                            Chi tiết / Sửa
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {semCount === 0 && (
                                                <div className="sy2-empty">
                                                    Chưa có học kỳ trong DB cho năm này. Chạy seed SQL{' '}
                                                    <code>sm_semesters</code> rồi bấm Làm mới.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {tab === 'timeline' && (
                                    <div className="sy2-panel">
                                        <div className="sy2-timeline">
                                            <div className="sy2-tl-item">
                                                <i />
                                                <div>
                                                    <strong>Bắt đầu năm học</strong>
                                                    <p>{fmt(selected.start_date)}</p>
                                                </div>
                                            </div>
                                            {(selected.semesters || [])
                                                .slice()
                                                .sort((a, b) => a.code - b.code)
                                                .map((s) => (
                                                    <div key={s.id} className="sy2-tl-item">
                                                        <i className={s.is_current ? 'on' : ''} />
                                                        <div>
                                                            <strong>
                                                                {s.name}
                                                                {s.is_current ? ' · đang học' : ''}
                                                            </strong>
                                                            <p>
                                                                {fmt(s.start_date)} → {fmt(s.end_date)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            <div className="sy2-tl-item">
                                                <i />
                                                <div>
                                                    <strong>Kết thúc năm học</strong>
                                                    <p>{fmt(selected.end_date)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </main>
                </div>
            )}

            {/* Modal thêm năm */}
            {openAdd && (
                <div className="sy2-modal">
                    <div className="sy2-modal-box">
                        <h3>Thêm năm học</h3>
                        <label>
                            Nhãn (2026-2027)
                            <input
                                value={form.label}
                                onChange={(e) => setForm({ ...form, label: e.target.value })}
                                placeholder="2026-2027"
                            />
                        </label>
                        <div className="sy2-row2">
                            <label>
                                Bắt đầu
                                <input
                                    type="date"
                                    value={form.start_date}
                                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                                />
                            </label>
                            <label>
                                Kết thúc
                                <input
                                    type="date"
                                    value={form.end_date}
                                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                                />
                            </label>
                        </div>
                        <label>
                            Ghi chú
                            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                        </label>
                        <div className="sy2-modal-acts">
                            <button type="button" className="sy2-btn ghost" onClick={() => setOpenAdd(false)}>
                                Hủy
                            </button>
                            <button type="button" className="sy2-btn primary" disabled={saving} onClick={createYear}>
                                {saving ? 'Đang lưu…' : 'Tạo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal chi tiết HK */}
            {editSem && (
                <div className="sy2-modal">
                    <div className="sy2-modal-box wide">
                        <h3>Chi tiết · {editSem.name}</h3>
                        <div className="sy2-mini-grid modal">
                            <div className="sy2-mini blue">
                                <span>Mã HK</span>
                                <b>HK{editSem.code}</b>
                            </div>
                            <div className="sy2-mini green">
                                <span>Hiện hành</span>
                                <b>{editSem.is_current ? 'Có' : 'Không'}</b>
                            </div>
                        </div>
                        <label>
                            Tên hiển thị
                            <input
                                value={editSem.name}
                                onChange={(e) => setEditSem({ ...editSem, name: e.target.value })}
                            />
                        </label>
                        <div className="sy2-row2">
                            <label>
                                Bắt đầu
                                <input
                                    type="date"
                                    value={(editSem.start_date || '').slice(0, 10)}
                                    onChange={(e) => setEditSem({ ...editSem, start_date: e.target.value })}
                                />
                            </label>
                            <label>
                                Kết thúc
                                <input
                                    type="date"
                                    value={(editSem.end_date || '').slice(0, 10)}
                                    onChange={(e) => setEditSem({ ...editSem, end_date: e.target.value })}
                                />
                            </label>
                        </div>
                        <label>
                            Trạng thái
                            <select
                                value={editSem.status}
                                onChange={(e) => setEditSem({ ...editSem, status: e.target.value })}
                            >
                                <option value="upcoming">Sắp tới</option>
                                <option value="active">Đang dùng</option>
                                <option value="closed">Đã khóa</option>
                            </select>
                        </label>
                        <label className="sy2-check">
                            <input
                                type="checkbox"
                                checked={editSem.is_current}
                                onChange={(e) => setEditSem({ ...editSem, is_current: e.target.checked })}
                            />
                            Đặt làm học kỳ hiện tại của năm này
                        </label>
                        <div className="sy2-modal-acts">
                            <button type="button" className="sy2-btn ghost" onClick={() => setEditSem(null)}>
                                Đóng
                            </button>
                            <button type="button" className="sy2-btn primary" disabled={saving} onClick={saveSemester}>
                                {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}