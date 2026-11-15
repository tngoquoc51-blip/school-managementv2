'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import './awards.css';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

type Kpi = { draft: number; submitted: number; approved: number; rejected: number; total: number };
type TypeRow = { id: number; code: string; name: string; group_code: string };
type Period = { id: number; code: string; name: string; status: string };
type Student = { id: number; code: string; name: string };
type Nom = {
    id: number;
    student_id: number;
    student_code?: string;
    student_name?: string;
    type_id: number;
    type_name?: string;
    type_code?: string;
    group_code?: string;
    period_id?: number;
    period_name?: string;
    score?: number | null;
    reason?: string | null;
    evidence?: string | null;
    status: string;
    review_note?: string | null;
    reviewed_at?: string | null;
    created_at?: string;
    updated_at?: string;
};

const STATUS_LABEL: Record<string, string> = {
    draft: 'Nháp',
    submitted: 'Đã gửi',
    approved: 'Đã duyệt',
    rejected: 'Từ chối',
    returned: 'Trả lại',
};

function token() {
    if (typeof window === 'undefined') return '';
    return (
        localStorage.getItem('homeroom_token') ||
        localStorage.getItem('gv_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('admin_token') ||
        ''
    );
}

async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
    const res = await fetch(`${API}/v1/homeroom/awards/${path}`, {
        method: opts.method || 'GET',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token()}`,
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.success === false) throw new Error(j.message || `Lỗi ${res.status}`);
    return j as T;
}

function fmtDate(v?: string | null) {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function HomeroomAwardsPage() {
    const [kpi, setKpi] = useState<Kpi>({ draft: 0, submitted: 0, approved: 0, rejected: 0, total: 0 });
    const [className, setClassName] = useState('—');
    const [period, setPeriod] = useState<Period | null>(null);
    const [periods, setPeriods] = useState<Period[]>([]);
    const [types, setTypes] = useState<TypeRow[]>([]);
    const [rows, setRows] = useState<Nom[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [status, setStatus] = useState('');
    const [typeId, setTypeId] = useState(0);
    const [periodId, setPeriodId] = useState(0);
    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [sel, setSel] = useState<Nom | null>(null);
    const [form, setForm] = useState({
        student_id: 0,
        type_id: 0,
        score: '',
        reason: '',
        evidence: '',
        submit: true,
    });

    const loadMeta = useCallback(async () => {
        const [ov, ty, pe] = await Promise.all([
            api<{ data: any }>('overview'),
            api<{ data: TypeRow[] }>('types'),
            api<{ data: Period[] }>('periods'),
        ]);
        setKpi(ov.data.kpi);
        setClassName(ov.data.class?.name || '—');
        setPeriod(ov.data.period || null);
        setTypes(ty.data || []);
        setPeriods(pe.data || []);
        if (ov.data.period?.id) setPeriodId((cur) => cur || ov.data.period.id);
    }, []);

    const loadList = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const qs = new URLSearchParams();
            if (periodId) qs.set('period_id', String(periodId));
            if (status) qs.set('status', status);
            if (typeId) qs.set('type_id', String(typeId));
            const r = await api<{ data: Nom[] }>(`nominations?${qs}`);
            const list = r.data || [];
            setRows(list);
            setSel((cur) => {
                if (!cur) return list[0] ?? null;
                return list.find((x) => x.id === cur.id) ?? list[0] ?? null;
            });
        } catch (e: any) {
            setErr(e.message || 'Không tải được danh sách');
            setRows([]);
            setSel(null);
        } finally {
            setLoading(false);
        }
    }, [periodId, status, typeId]);

    useEffect(() => {
        loadMeta().catch((e) => setErr(e.message || 'Lỗi tải tổng quan'));
    }, [loadMeta]);

    useEffect(() => {
        loadList();
    }, [loadList]);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return rows;
        return rows.filter(
            (r) =>
                (r.student_name || '').toLowerCase().includes(s) ||
                (r.student_code || '').toLowerCase().includes(s) ||
                (r.type_name || '').toLowerCase().includes(s),
        );
    }, [rows, q]);

    const openCreate = async () => {
        setForm({ student_id: 0, type_id: types[0]?.id || 0, score: '', reason: '', evidence: '', submit: true });
        setOpen(true);
        try {
            const r = await api<{ data: Student[] }>('students');
            setStudents(r.data || []);
        } catch {
            setStudents([]);
        }
    };

    const save = async () => {
        if (!periodId) return alert('Chưa có đợt thi đua đang mở');
        if (!form.student_id || !form.type_id) return alert('Chọn học sinh và loại danh hiệu');
        setSaving(true);
        try {
            await api('nominations', {
                method: 'POST',
                body: {
                    period_id: periodId,
                    type_id: form.type_id,
                    student_id: form.student_id,
                    score: form.score === '' ? null : Number(form.score),
                    reason: form.reason,
                    evidence: form.evidence,
                    submit: form.submit,
                },
            });
            setOpen(false);
            await loadMeta();
            await loadList();
        } catch (e: any) {
            alert(e.message || 'Lưu thất bại');
        } finally {
            setSaving(false);
        }
    };

    const submitOne = async (id: number) => {
        try {
            await api(`nominations/${id}/submit`, { method: 'POST' });
            await loadMeta();
            await loadList();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const removeOne = async (id: number) => {
        if (!confirm('Xóa bản nháp này?')) return;
        try {
            await api(`nominations/${id}`, { method: 'DELETE' });
            await loadMeta();
            await loadList();
        } catch (e: any) {
            alert(e.message);
        }
    };

    return (
        <div className="aw-page">
            <div className="aw-hero">
                <div>
                    <h1>Xét thi đua · Khen thưởng</h1>
                    <p>
                        Lớp <b>{className}</b>
                        {period ? ` · ${period.name}` : ' · Chưa có đợt mở'}. Đề xuất danh hiệu, gửi duyệt và xem chi tiết từng hồ sơ.
                    </p>
                </div>
                <div className="aw-hero-actions">
                    <button type="button" className="aw-btn" onClick={() => { loadMeta(); loadList(); }}>Làm mới</button>
                    <button type="button" className="aw-btn solid" onClick={openCreate}>+ Đề xuất mới</button>
                </div>
            </div>

            <div className="aw-kpis">
                <div className="aw-kpi"><b>{kpi.total}</b><span>Tổng đề xuất</span></div>
                <div className="aw-kpi"><b>{kpi.draft}</b><span>Bản nháp</span></div>
                <div className="aw-kpi"><b>{kpi.submitted}</b><span>Đã gửi chờ duyệt</span></div>
                <div className="aw-kpi"><b>{kpi.approved}</b><span>Đã được duyệt</span></div>
                <div className="aw-kpi"><b>{kpi.rejected}</b><span>Từ chối / trả lại</span></div>
            </div>

            <div className="aw-layout3">
                <aside className="aw-side">
                    <h3>Trạng thái</h3>
                    <div className="aw-filter">
                        {[
                            ['', 'Tất cả'],
                            ['draft', 'Nháp'],
                            ['submitted', 'Đã gửi'],
                            ['approved', 'Đã duyệt'],
                            ['rejected', 'Từ chối'],
                            ['returned', 'Trả lại'],
                        ].map(([k, l]) => (
                            <button key={k || 'all'} type="button" className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>
                                <span>{l}</span>
                            </button>
                        ))}
                    </div>
                    <label className="aw-field">
                        Đợt thi đua
                        <select value={periodId} onChange={(e) => setPeriodId(Number(e.target.value))}>
                            <option value={0}>Tất cả đợt</option>
                            {periods.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="aw-field">
                        Loại danh hiệu
                        <select value={typeId} onChange={(e) => setTypeId(Number(e.target.value))}>
                            <option value={0}>Tất cả loại</option>
                            {types.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </label>
                    <div className="aw-guide">
                        <b>Quy trình GVCN</b>
                        <ol>
                            <li>Chọn đợt đang mở</li>
                            <li>Đề xuất học sinh + lý do</li>
                            <li>Gửi duyệt</li>
                            <li>Xem chi tiết bên phải</li>
                        </ol>
                    </div>
                </aside>

                <section className="aw-main">
                    <div className="aw-toolbar">
                        <label className="aw-search">
                            <span aria-hidden>⌕</span>
                            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên, mã HS, danh hiệu…" />
                        </label>
                        <button type="button" className="aw-btn ghost sm" onClick={openCreate}>+ Đề xuất</button>
                    </div>

                    <div className="aw-table-wrap">
                        {err && (
                            <div className="aw-empty" role="alert">
                                <b>Chưa tải được danh sách</b>
                                <p>{err}</p>
                                <button type="button" className="aw-btn primary sm" onClick={loadList}>Tải lại</button>
                            </div>
                        )}
                        {!err && loading && <div className="aw-empty">Đang tải…</div>}
                        {!err && !loading && filtered.length === 0 && (
                            <div className="aw-empty">
                                <b>Chưa có đề xuất</b>
                                <p>Bấm “Đề xuất mới” hoặc chạy SQL seed dữ liệu mẫu.</p>
                            </div>
                        )}
                        {!err && !loading && filtered.length > 0 && (
                            <table className="aw-table">
                                <thead>
                                <tr>
                                    <th>Học sinh</th>
                                    <th>Danh hiệu</th>
                                    <th>Điểm</th>
                                    <th>Trạng thái</th>
                                </tr>
                                </thead>
                                <tbody>
                                {filtered.map((r) => (
                                    <tr
                                        key={r.id}
                                        className={sel?.id === r.id ? 'on' : ''}
                                        onClick={() => setSel(r)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td>
                                            <div style={{ fontWeight: 700 }}>{r.student_name || '—'}</div>
                                            <div className="aw-muted">{r.student_code}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{r.type_name}</div>
                                            <div className="aw-muted">{r.period_name}</div>
                                        </td>
                                        <td>{r.score != null ? <b>{r.score}</b> : '—'}</td>
                                        <td><span className={`aw-badge ${r.status}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>

                {/* Panel chi tiết bên phải */}
                <aside className="aw-detail">
                    {!sel ? (
                        <div className="aw-empty">
                            <b>Chọn một đề xuất</b>
                            <p>Nội dung, lý do, minh chứng và thao tác sẽ hiện ở đây.</p>
                        </div>
                    ) : (
                        <>
                            <div className="aw-detail-h">
                                <div>
                                    <div className="aw-muted" style={{ fontSize: 12 }}>Chi tiết đề xuất #{sel.id}</div>
                                    <h2>{sel.student_name || 'Học sinh'}</h2>
                                    <div className="aw-muted">{sel.student_code} · {sel.type_name}</div>
                                </div>
                                <span className={`aw-badge ${sel.status}`}>{STATUS_LABEL[sel.status] || sel.status}</span>
                            </div>

                            <div className="aw-detail-b">
                                <div className="aw-kv">
                                    <div><span>Đợt</span><b>{sel.period_name || '—'}</b></div>
                                    <div><span>Danh hiệu</span><b>{sel.type_name || '—'}</b></div>
                                    <div><span>Điểm đánh giá</span><b>{sel.score != null ? sel.score : '—'}</b></div>
                                    <div><span>Cập nhật</span><b>{fmtDate(sel.updated_at)}</b></div>
                                </div>

                                <div className="aw-block">
                                    <h4>Lý do đề xuất</h4>
                                    <p>{sel.reason || 'Chưa ghi lý do.'}</p>
                                </div>
                                <div className="aw-block">
                                    <h4>Minh chứng</h4>
                                    <p>{sel.evidence || '—'}</p>
                                </div>
                                {(sel.review_note || sel.reviewed_at) && (
                                    <div className="aw-block">
                                        <h4>Ý kiến duyệt</h4>
                                        <p>{sel.review_note || '—'}</p>
                                        <div className="aw-muted" style={{ marginTop: 6 }}>{fmtDate(sel.reviewed_at)}</div>
                                    </div>
                                )}

                                <div className="aw-detail-acts">
                                    {(sel.status === 'draft' || sel.status === 'returned') && (
                                        <button type="button" className="aw-btn primary sm" onClick={() => submitOne(sel.id)}>
                                            Gửi duyệt
                                        </button>
                                    )}
                                    {sel.status === 'draft' && (
                                        <button type="button" className="aw-btn ghost sm" onClick={() => removeOne(sel.id)}>
                                            Xóa nháp
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </aside>
            </div>

            {open && (
                <div className="aw-modal-bg" role="dialog" aria-modal="true">
                    <div className="aw-modal">
                        <div className="aw-modal-h">
                            <h2>Đề xuất khen thưởng</h2>
                            <button type="button" className="aw-btn ghost sm" onClick={() => setOpen(false)}>Đóng</button>
                        </div>
                        <div className="aw-modal-b">
                            <label className="aw-field">
                                Học sinh
                                <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: Number(e.target.value) })}>
                                    <option value={0}>— Chọn học sinh —</option>
                                    {students.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                                    ))}
                                </select>
                            </label>
                            <label className="aw-field">
                                Loại danh hiệu
                                <select value={form.type_id} onChange={(e) => setForm({ ...form, type_id: Number(e.target.value) })}>
                                    {types.map((t) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="aw-field">
                                Điểm (0–10, tùy chọn)
                                <input value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} placeholder="9.5" />
                            </label>
                            <label className="aw-field">
                                Lý do đề xuất
                                <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                            </label>
                            <label className="aw-field">
                                Minh chứng
                                <textarea value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })} />
                            </label>
                            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
                                <input type="checkbox" checked={form.submit} onChange={(e) => setForm({ ...form, submit: e.target.checked })} />
                                Gửi duyệt ngay
                            </label>
                        </div>
                        <div className="aw-modal-f">
                            <button type="button" className="aw-btn ghost" onClick={() => setOpen(false)}>Hủy</button>
                            <button type="button" className="aw-btn primary" disabled={saving} onClick={save}>
                                {saving ? 'Đang lưu…' : form.submit ? 'Gửi đề xuất' : 'Lưu nháp'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}