'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import './profile.css';
import { getStudentToken } from '@/hooks/useCurrentStudent';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

/* ===================== kiểu dữ liệu GET /hs/profile ===================== */
interface Year {
    year: string; is_current: boolean; class: string; grade: number; homeroom: string | null;
    hk1: number | null; hk2: number | null; avg: number | null; rank: string | null;
    conduct_hk1: string | null; conduct_hk2: string | null; conduct_year: string | null;
}
interface Req {
    id: number; field: string; field_label: string; old_value: string | null; new_value: string; reason: string;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled'; review_note: string | null; created_at: string; reviewed_at: string | null;
}
interface Person { name: string | null; job: string | null; phone: string | null; birth_year: number | null }
interface Profile {
    ready: boolean;
    student: { id: number; code: string; full_name: string; gender: string; birth_date: string; birth_date_iso: string; age: number | null; admission_year: number };
    class: { name: string; grade: number; homeroom: string | null; year: string } | null;
    account: { username: string | null; email: string | null; email_linked: boolean };
    personal: { ethnicity: string | null; religion: string | null; birth_place: string | null; hometown: string | null; permanent_address: string | null; youth_union: boolean; youth_union_date: string | null };
    contact: { phone: string | null; current_address: string | null; emergency_name: string | null; emergency_relation: string | null; emergency_phone: string | null };
    family: { father: Person; mother: Person; guardian: { name: string | null; relation: string | null; phone: string | null } };
    health: { blood_type: string | null; height_cm: number | null; weight_kg: number | null; bmi: number | null; note: string | null };
    academic: { current: Year | null; history: Year[] };
    requests: Req[];
    completeness: { percent: number; missing: { key: string; label: string; tab: string }[] };
    fields: { direct: Record<string, string>; request: Record<string, string> };
    updated_at: string | null;
}

type TabKey = 'overview' | 'personal' | 'contact' | 'family' | 'academic' | 'requests';

/* ===================== tiện ích ===================== */
const initials = (name: string) => {
    const w = name.trim().split(/\s+/);
    return ((w[w.length - 2]?.[0] ?? '') + (w[w.length - 1]?.[0] ?? '')).toUpperCase() || 'HS';
};
const dt = (s?: string | null) => {
    if (!s) return '—';
    const d = new Date(s.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return '—';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const score = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toFixed(2));
const bmiLabel = (b: number | null) => (b === null ? '' : b < 18.5 ? 'Gầy' : b < 23 ? 'Bình thường' : b < 25 ? 'Thừa cân' : 'Béo phì');
const rankClass = (r: string | null) => (r === 'Giỏi' || r === 'Tốt' ? 'good' : r === 'Khá' ? 'fair' : r === 'Trung bình' || r === 'Đạt' ? 'mid' : r ? 'low' : '');

const STATUS: Record<string, { text: string; cls: string }> = {
    pending: { text: 'Chờ duyệt', cls: 'pending' },
    approved: { text: 'Đã duyệt', cls: 'approved' },
    rejected: { text: 'Từ chối', cls: 'rejected' },
    cancelled: { text: 'Đã hủy', cls: 'cancelled' },
};

/* ===================== icon ===================== */
const P = {
    user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />,
    id: <path d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm5 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-3 5a3 3 0 0 1 6 0M14 9h4m-4 3h4m-4 3h3" />,
    phone: <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
    family: <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 1a2.5 2.5 0 1 0 0-5M3 19a6 6 0 0 1 12 0m1-5a5 5 0 0 1 5 5" />,
    book: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5v-15ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5v-15Z" />,
    doc: <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 0v5h5M9 13h6m-6 4h4" />,
    home: <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8Z" />,
    pin: <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
    heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />,
    mail: <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Zm2 .6 7 5 7-5" />,
    edit: <path d="M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4" />,
    check: <path d="m5 12.5 4.2 4.2L19 7" />,
    x: <path d="M6 6l12 12M18 6 6 18" />,
    alert: <path d="M12 8v5m0 3.5h.01M10.3 4.2 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />,
    cal: <path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />,
    star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />,
    lock: <path d="M7 10V7a5 5 0 0 1 10 0v3M6 10h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Zm6 4v3" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    clock: <path d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
    send: <path d="m21 3-9 18-2.5-7.5L3 11l18-8Zm-11.5 10.5L21 3" />,
};
type IconName = keyof typeof P;
const Icon = ({ d, size = 18 }: { d: IconName; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[d]}</svg>
);

/* ===================== thành phần nhỏ ===================== */
function Info({ label, value, field, onRequest, wide }: { label: string; value?: string | number | null; field?: string; onRequest?: (f: string) => void; wide?: boolean }) {
    const empty = value === null || value === undefined || value === '';
    return (
        <div className={`pf-info ${wide ? 'wide' : ''}`}>
            <small>{label}</small>
            <div>
                <b className={empty ? 'empty' : ''}>{empty ? 'Chưa cập nhật' : value}</b>
                {field && onRequest && (
                    <button type="button" className="pf-req" onClick={() => onRequest(field)} title="Gửi yêu cầu chỉnh sửa" aria-label={`Yêu cầu chỉnh sửa ${label}`}>
                        <Icon d="edit" size={14} />
                    </button>
                )}
            </div>
        </div>
    );
}

function Card({ icon, title, sub, children, action }: { icon: IconName; title: string; sub?: string; children: React.ReactNode; action?: React.ReactNode }) {
    return (
        <section className="pf-card">
            <div className="pf-card-head">
                <span className="pf-badge"><Icon d={icon} size={20} /></span>
                <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
                {action}
            </div>
            {children}
        </section>
    );
}

function TextField({ id, label, value, onChange, error, placeholder, type = 'text', maxLength, inputMode }: {
    id: string; label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; type?: string; maxLength?: number; inputMode?: 'text' | 'numeric' | 'tel';
}) {
    return (
        <div className="pf-field-wrap">
            <label htmlFor={id}>{label}</label>
            <input id={id} type={type} value={value} placeholder={placeholder} maxLength={maxLength} inputMode={inputMode}
                   className={error ? 'bad' : ''} onChange={(e) => onChange(e.target.value)} />
            {error && <p className="pf-err">{error}</p>}
        </div>
    );
}

/* ===================== modal yêu cầu chỉnh sửa ===================== */
function RequestModal({ fields, preset, current, onClose, onSubmit }: {
    fields: Record<string, string>; preset: string | null; current: (f: string) => string;
    onClose: () => void; onSubmit: (field: string, value: string, reason: string) => Promise<string | null>;
}) {
    const [field, setField] = useState(preset || Object.keys(fields)[0]);
    const [value, setValue] = useState('');
    const [reason, setReason] = useState('');
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const cur = current(field);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setErr('');
        setBusy(true);
        const m = await onSubmit(field, value, reason);
        setBusy(false);
        if (m) setErr(m);
    }

    return (
        <div className="pf-modal-bg" role="dialog" aria-modal="true" aria-label="Gửi yêu cầu chỉnh sửa" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <form className="pf-modal" onSubmit={submit}>
                <div className="pf-modal-head">
                    <h3>Yêu cầu chỉnh sửa thông tin</h3>
                    <button type="button" onClick={onClose} aria-label="Đóng"><Icon d="x" /></button>
                </div>
                <p className="pf-modal-sub">Thông tin này do nhà trường quản lý. Yêu cầu của bạn sẽ được xem xét và phản hồi.</p>
                {err && <div className="pf-alert err" role="alert"><Icon d="alert" size={16} /> {err}</div>}
                <div className="pf-field-wrap">
                    <label htmlFor="rq-field">Thông tin cần sửa</label>
                    <select id="rq-field" value={field} onChange={(e) => { setField(e.target.value); setValue(''); }}>
                        {Object.entries(fields).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                </div>
                <div className="pf-cur"><small>Hiện tại</small><b>{cur || 'Chưa cập nhật'}</b></div>
                <div className="pf-field-wrap">
                    <label htmlFor="rq-val">Giá trị mới</label>
                    {field === 'gender' ? (
                        <select id="rq-val" value={value} onChange={(e) => setValue(e.target.value)}>
                            <option value="">Chọn…</option><option>Nam</option><option>Nữ</option>
                        </select>
                    ) : (
                        <input id="rq-val" value={value} onChange={(e) => setValue(e.target.value)} maxLength={200} autoFocus
                               placeholder={field === 'birth_date' ? 'dd/mm/yyyy' : 'Nhập giá trị đúng'} />
                    )}
                </div>
                <div className="pf-field-wrap">
                    <label htmlFor="rq-reason">Lý do</label>
                    <textarea id="rq-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255}
                              placeholder="Ví dụ: Thông tin trong giấy khai sinh khác với hồ sơ." />
                    <small className="pf-count">{reason.length}/255</small>
                </div>
                <div className="pf-modal-foot">
                    <button type="button" className="pf-btn ghost" onClick={onClose}>Hủy</button>
                    <button className="pf-btn" disabled={busy || !value.trim() || reason.trim().length < 5}>
                        {busy ? <span className="pf-spin" /> : <><Icon d="send" size={16} /> Gửi yêu cầu</>}
                    </button>
                </div>
            </form>
        </div>
    );
}

/* ===================== trang chính ===================== */
const TABS: { key: TabKey; label: string; icon: IconName }[] = [
    { key: 'overview', label: 'Tổng quan', icon: 'home' },
    { key: 'personal', label: 'Thông tin cá nhân', icon: 'id' },
    { key: 'contact', label: 'Liên hệ & sức khỏe', icon: 'phone' },
    { key: 'family', label: 'Gia đình', icon: 'family' },
    { key: 'academic', label: 'Học tập', icon: 'book' },
    { key: 'requests', label: 'Yêu cầu chỉnh sửa', icon: 'doc' },
];

type Form = { phone: string; current_address: string; emergency_name: string; emergency_relation: string; emergency_phone: string; blood_type: string; height_cm: string; weight_kg: string; health_note: string };

export default function StudentProfilePage() {
    const [pf, setPf] = useState<Profile | null>(null);
    const [loadErr, setLoadErr] = useState('');
    const [tab, setTab] = useState<TabKey>('overview');
    const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    const [modal, setModal] = useState<{ preset: string | null } | null>(null);
    const [form, setForm] = useState<Form | null>(null);
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [cancelId, setCancelId] = useState<number | null>(null);

    const call = useCallback(async (path: string, method = 'GET', body?: object) => {
        const token = getStudentToken();
        if (!token) throw Object.assign(new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'), { status: 401 });
        const res = await fetch(`${API}${path}`, {
            method,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
            body: body ? JSON.stringify(body) : undefined,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(json?.message || 'Có lỗi xảy ra, vui lòng thử lại.'), { status: res.status, errors: json?.errors });
        return json;
    }, []);

    const toForm = (p: Profile): Form => ({
        phone: p.contact.phone ?? '', current_address: p.contact.current_address ?? '',
        emergency_name: p.contact.emergency_name ?? '', emergency_relation: p.contact.emergency_relation ?? '', emergency_phone: p.contact.emergency_phone ?? '',
        blood_type: p.health.blood_type ?? '', height_cm: p.health.height_cm?.toString() ?? '', weight_kg: p.health.weight_kg?.toString() ?? '', health_note: p.health.note ?? '',
    });

    const load = useCallback(async (resetForm = true) => {
        try {
            const j = await call('/hs/profile');
            setPf(j.data);
            if (resetForm) setForm(toForm(j.data));
            setLoadErr('');
        } catch (e: any) {
            setLoadErr(e.message);
        }
    }, [call]);

    useEffect(() => {
        load();
        const h = window.location.hash.replace('#', '') as TabKey;
        if (TABS.some((t) => t.key === h)) setTab(h);
    }, [load]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 4500);
        return () => clearTimeout(t);
    }, [toast]);

    const go = (k: TabKey) => {
        setTab(k);
        try { window.history.replaceState(null, '', `#${k}`); } catch { /* bỏ qua */ }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const dirty = useMemo(() => {
        if (!pf || !form) return false;
        const base = toForm(pf);
        return (Object.keys(base) as (keyof Form)[]).some((k) => base[k] !== form[k]);
    }, [pf, form]);

    async function save(e: React.FormEvent) {
        e.preventDefault();
        if (!form) return;
        setSaving(true);
        setErrs({});
        try {
            await call('/hs/profile/contact', 'PUT', form);
            setToast({ type: 'ok', text: 'Đã lưu thông tin liên hệ và sức khỏe.' });
            await load(true);
        } catch (err: any) {
            setErrs(err.errors || {});
            setToast({ type: 'err', text: err.message });
        } finally {
            setSaving(false);
        }
    }

    const currentValue = (f: string): string => {
        if (!pf) return '';
        const s = pf.student, p = pf.personal, fam = pf.family;
        const map: Record<string, string | null | undefined> = {
            full_name: s.full_name, birth_date: s.birth_date, gender: s.gender, ethnicity: p.ethnicity, religion: p.religion,
            birth_place: p.birth_place, hometown: p.hometown, permanent_address: p.permanent_address,
            father_name: fam.father.name, father_job: fam.father.job, father_phone: fam.father.phone,
            mother_name: fam.mother.name, mother_job: fam.mother.job, mother_phone: fam.mother.phone,
            guardian_name: fam.guardian.name, guardian_relation: fam.guardian.relation, guardian_phone: fam.guardian.phone,
        };
        return map[f] ?? '';
    };

    async function submitRequest(field: string, value: string, reason: string): Promise<string | null> {
        try {
            const j = await call('/hs/profile/requests', 'POST', { field, new_value: value, reason });
            setModal(null);
            setToast({ type: 'ok', text: j.message || 'Đã gửi yêu cầu.' });
            await load(false);
            go('requests');
            return null;
        } catch (err: any) {
            return err.message;
        }
    }

    async function cancelReq(id: number) {
        try {
            const j = await call(`/hs/profile/requests/${id}/cancel`, 'POST');
            setToast({ type: 'ok', text: j.message || 'Đã hủy yêu cầu.' });
            setCancelId(null);
            await load(false);
        } catch (err: any) {
            setToast({ type: 'err', text: err.message });
        }
    }

    if (!pf) {
        return (
            <div className="pf-page">
                <div className="pf-skel">{loadErr ? (
                    <div className="pf-alert err"><Icon d="alert" size={18} /> {loadErr}</div>
                ) : (<><span className="pf-spin dark" /> Đang tải hồ sơ…</>)}</div>
            </div>
        );
    }

    const s = pf.student;
    const cur = pf.academic.current;
    const pending = pf.requests.filter((r) => r.status === 'pending').length;
    const askEdit = (f: string) => setModal({ preset: f });
    const fam = pf.family;

    return (
        <div className="pf-page">
            {toast && (
                <div className={`pf-toast ${toast.type}`} role="status">
                    <Icon d={toast.type === 'ok' ? 'check' : 'alert'} size={18} /><span>{toast.text}</span>
                    <button type="button" onClick={() => setToast(null)} aria-label="Đóng"><Icon d="x" size={16} /></button>
                </div>
            )}

            {/* ===== Hero ===== */}
            <header className="pf-hero">
                <div className="pf-id">
                    <div className="pf-avatar" aria-hidden="true"><span>{initials(s.full_name)}</span></div>
                    <div className="pf-id-text">
                        <p className="pf-eyebrow">Hồ sơ học sinh</p>
                        <h1>{s.full_name}</h1>
                        <div className="pf-chips">
                            <span>Mã HS: <b>{s.code}</b></span>
                            {pf.class && <span>Lớp <b>{pf.class.name}</b></span>}
                            {pf.class && <span>Năm học <b>{pf.class.year}</b></span>}
                            {pf.personal.youth_union && <span className="accent">Đoàn viên</span>}
                        </div>
                        <p className="pf-meta">{s.gender} · Sinh ngày {s.birth_date}{s.age ? ` (${s.age} tuổi)` : ''}</p>
                    </div>
                </div>
                <div className="pf-complete">
                    <div className="pf-complete-top">
                        <span>Mức độ hoàn thiện hồ sơ</span>
                        <b>{pf.completeness.percent}%</b>
                    </div>
                    <div className="pf-bar" role="progressbar" aria-valuenow={pf.completeness.percent} aria-valuemin={0} aria-valuemax={100}>
                        <span style={{ width: `${pf.completeness.percent}%` }} />
                    </div>
                    {pf.completeness.missing.length > 0 ? (
                        <button type="button" onClick={() => go(pf.completeness.missing[0].tab as TabKey)}>
                            Còn thiếu: {pf.completeness.missing[0].label}{pf.completeness.missing.length > 1 ? ` và ${pf.completeness.missing.length - 1} mục khác` : ''} <Icon d="arrow" size={14} />
                        </button>
                    ) : (<small>Hồ sơ của bạn đã đầy đủ.</small>)}
                </div>
            </header>

            {!pf.ready && (
                <div className="pf-alert warn"><Icon d="alert" size={18} /> Hồ sơ chi tiết của bạn chưa có dữ liệu. Bạn vẫn xem được thông tin cơ bản; hãy liên hệ nhà trường để bổ sung.</div>
            )}

            {/* ===== Tab ===== */}
            <nav className="pf-tabs" role="tablist" aria-label="Các mục hồ sơ">
                {TABS.map((t) => (
                    <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'active' : ''} onClick={() => go(t.key)}>
                        <Icon d={t.icon} size={17} /><span>{t.label}</span>
                        {t.key === 'requests' && pending > 0 && <em>{pending}</em>}
                    </button>
                ))}
            </nav>

            {/* ===== TỔNG QUAN ===== */}
            {tab === 'overview' && (
                <div className="pf-grid">
                    <div className="pf-col">
                        <section className="pf-stats">
                            <div className="pf-stat"><span><Icon d="book" size={20} /></span><div><small>Lớp hiện tại</small><b>{pf.class?.name ?? '—'}</b></div></div>
                            <div className="pf-stat"><span><Icon d="user" size={20} /></span><div><small>Giáo viên chủ nhiệm</small><b>{pf.class?.homeroom ?? '—'}</b></div></div>
                            <div className="pf-stat"><span><Icon d="star" size={20} /></span><div><small>ĐTB năm học</small><b>{score(cur?.avg)}</b></div></div>
                            <div className="pf-stat"><span><Icon d="heart" size={20} /></span><div><small>Hạnh kiểm</small><b>{cur?.conduct_year ?? '—'}</b></div></div>
                        </section>

                        <Card icon="id" title="Thông tin chính" sub="Dữ liệu hồ sơ do nhà trường quản lý.">
                            <div className="pf-infogrid">
                                <Info label="Họ và tên" value={s.full_name} />
                                <Info label="Mã học sinh" value={s.code} />
                                <Info label="Ngày sinh" value={s.birth_date} />
                                <Info label="Giới tính" value={s.gender} />
                                <Info label="Dân tộc" value={pf.personal.ethnicity} />
                                <Info label="Năm nhập học" value={s.admission_year} />
                                <Info label="Tên đăng nhập" value={pf.account.username} />
                                <Info label="Gmail khôi phục" value={pf.account.email ?? undefined} />
                            </div>
                        </Card>

                        <Card icon="doc" title="Yêu cầu gần đây" sub="Theo dõi các yêu cầu chỉnh sửa thông tin."
                              action={<button type="button" className="pf-link" onClick={() => go('requests')}>Xem tất cả</button>}>
                            {pf.requests.length === 0 ? <p className="pf-empty">Bạn chưa gửi yêu cầu nào.</p> : (
                                <ul className="pf-reqmini">
                                    {pf.requests.slice(0, 3).map((r) => (
                                        <li key={r.id}><div><b>{r.field_label}</b><small>{dt(r.created_at)}</small></div><span className={`pf-pill ${STATUS[r.status].cls}`}>{STATUS[r.status].text}</span></li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                    </div>

                    <aside className="pf-col">
                        <Card icon="check" title="Hoàn thiện hồ sơ" sub={`${pf.completeness.percent}% đã hoàn thành`}>
                            {pf.completeness.missing.length === 0 ? <p className="pf-empty">Tuyệt vời, hồ sơ đã đầy đủ!</p> : (
                                <ul className="pf-todo">
                                    {pf.completeness.missing.map((m) => (
                                        <li key={m.key}><span><Icon d="alert" size={14} /></span><b>{m.label}</b>
                                            {m.key === 'email' ? <Link href="/student/change-password">Xem</Link> : <button type="button" onClick={() => go(m.tab as TabKey)}>Bổ sung</button>}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                        <section className="pf-card pf-quick">
                            <h3>Lối tắt</h3>
                            <button type="button" onClick={() => go('contact')}><Icon d="phone" size={17} /> Cập nhật liên hệ <Icon d="arrow" size={15} /></button>
                            <button type="button" onClick={() => setModal({ preset: null })}><Icon d="edit" size={17} /> Gửi yêu cầu chỉnh sửa <Icon d="arrow" size={15} /></button>
                            <Link href="/student/grades"><Icon d="star" size={17} /> Xem bảng điểm <Icon d="arrow" size={15} /></Link>
                            <Link href="/student/change-password"><Icon d="lock" size={17} /> Đổi mật khẩu & bảo mật <Icon d="arrow" size={15} /></Link>
                        </section>
                    </aside>
                </div>
            )}

            {/* ===== THÔNG TIN CÁ NHÂN ===== */}
            {tab === 'personal' && (
                <div className="pf-col">
                    <div className="pf-note"><Icon d="lock" size={16} /> Các thông tin dưới đây do nhà trường quản lý. Nếu có sai sót, bấm biểu tượng <Icon d="edit" size={13} /> cạnh thông tin để gửi yêu cầu chỉnh sửa.</div>
                    <Card icon="id" title="Thông tin định danh">
                        <div className="pf-infogrid">
                            <Info label="Họ và tên" value={s.full_name} field="full_name" onRequest={askEdit} />
                            <Info label="Mã học sinh" value={s.code} />
                            <Info label="Ngày sinh" value={s.birth_date} field="birth_date" onRequest={askEdit} />
                            <Info label="Giới tính" value={s.gender} field="gender" onRequest={askEdit} />
                            <Info label="Dân tộc" value={pf.personal.ethnicity} field="ethnicity" onRequest={askEdit} />
                            <Info label="Tôn giáo" value={pf.personal.religion} field="religion" onRequest={askEdit} />
                        </div>
                    </Card>
                    <Card icon="pin" title="Nơi sinh & địa chỉ">
                        <div className="pf-infogrid">
                            <Info label="Nơi sinh" value={pf.personal.birth_place} field="birth_place" onRequest={askEdit} />
                            <Info label="Quê quán" value={pf.personal.hometown} field="hometown" onRequest={askEdit} />
                            <Info label="Địa chỉ thường trú" value={pf.personal.permanent_address} field="permanent_address" onRequest={askEdit} wide />
                        </div>
                    </Card>
                    <Card icon="star" title="Quá trình học tại trường">
                        <div className="pf-infogrid">
                            <Info label="Năm nhập học" value={s.admission_year} />
                            <Info label="Lớp hiện tại" value={pf.class ? `${pf.class.name} (Khối ${pf.class.grade})` : null} />
                            <Info label="Giáo viên chủ nhiệm" value={pf.class?.homeroom} />
                            <Info label="Đoàn viên" value={pf.personal.youth_union ? `Đã kết nạp${pf.personal.youth_union_date ? ` ngày ${pf.personal.youth_union_date}` : ''}` : 'Chưa kết nạp'} />
                        </div>
                    </Card>
                </div>
            )}

            {/* ===== LIÊN HỆ & SỨC KHỎE ===== */}
            {tab === 'contact' && form && (
                <form className="pf-col" onSubmit={save} noValidate>
                    <Card icon="phone" title="Thông tin liên hệ" sub="Bạn có thể tự cập nhật và lưu ngay.">
                        <div className="pf-formgrid">
                            <TextField id="f-phone" label="Số điện thoại của bạn" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} error={errs.phone} placeholder="Ví dụ: 0912345678" inputMode="tel" maxLength={15} />
                            <div className="pf-field-wrap">
                                <label>Gmail khôi phục</label>
                                <div className="pf-readonly">{pf.account.email ?? 'Chưa liên kết'}<Link href="/student/change-password">Bảo mật</Link></div>
                            </div>
                            <div className="pf-field-wrap wide">
                                <label htmlFor="f-addr">Địa chỉ hiện tại</label>
                                <textarea id="f-addr" rows={2} value={form.current_address} className={errs.current_address ? 'bad' : ''} maxLength={200}
                                          onChange={(e) => setForm({ ...form, current_address: e.target.value })} placeholder="Số nhà, đường, phường, thành phố" />
                                {errs.current_address && <p className="pf-err">{errs.current_address}</p>}
                            </div>
                        </div>
                    </Card>
                    <Card icon="alert" title="Liên hệ khẩn cấp" sub="Người nhà trường sẽ gọi khi cần báo tin gấp.">
                        <div className="pf-formgrid three">
                            <TextField id="f-en" label="Họ tên người liên hệ" value={form.emergency_name} onChange={(v) => setForm({ ...form, emergency_name: v })} error={errs.emergency_name} maxLength={80} />
                            <TextField id="f-er" label="Quan hệ với bạn" value={form.emergency_relation} onChange={(v) => setForm({ ...form, emergency_relation: v })} error={errs.emergency_relation} placeholder="Bố, mẹ, ông, bà…" maxLength={30} />
                            <TextField id="f-ep" label="Số điện thoại" value={form.emergency_phone} onChange={(v) => setForm({ ...form, emergency_phone: v })} error={errs.emergency_phone} inputMode="tel" maxLength={15} />
                        </div>
                    </Card>
                    <Card icon="heart" title="Sức khỏe" sub="Thông tin tự khai, giúp nhà trường hỗ trợ khi cần.">
                        <div className="pf-formgrid four">
                            <div className="pf-field-wrap">
                                <label htmlFor="f-bt">Nhóm máu</label>
                                <select id="f-bt" value={form.blood_type} onChange={(e) => setForm({ ...form, blood_type: e.target.value })}>
                                    <option value="">Chưa biết</option><option>A</option><option>B</option><option>AB</option><option>O</option>
                                </select>
                                {errs.blood_type && <p className="pf-err">{errs.blood_type}</p>}
                            </div>
                            <TextField id="f-h" label="Chiều cao (cm)" value={form.height_cm} onChange={(v) => setForm({ ...form, height_cm: v })} error={errs.height_cm} inputMode="numeric" maxLength={3} />
                            <TextField id="f-w" label="Cân nặng (kg)" value={form.weight_kg} onChange={(v) => setForm({ ...form, weight_kg: v })} error={errs.weight_kg} inputMode="numeric" maxLength={3} />
                            <div className="pf-field-wrap">
                                <label>Chỉ số BMI</label>
                                <div className="pf-readonly">{pf.health.bmi ? <>{pf.health.bmi} <em className="pf-bmi">{bmiLabel(pf.health.bmi)}</em></> : '—'}</div>
                            </div>
                            <div className="pf-field-wrap wide4">
                                <label htmlFor="f-hn">Ghi chú sức khỏe (dị ứng, bệnh nền…)</label>
                                <textarea id="f-hn" rows={2} value={form.health_note} maxLength={255} className={errs.health_note ? 'bad' : ''}
                                          onChange={(e) => setForm({ ...form, health_note: e.target.value })} placeholder="Để trống nếu không có" />
                                {errs.health_note && <p className="pf-err">{errs.health_note}</p>}
                            </div>
                        </div>
                    </Card>
                    <div className="pf-savebar">
                        <span>{dirty ? 'Bạn có thay đổi chưa lưu.' : pf.updated_at ? `Cập nhật lần cuối: ${dt(pf.updated_at)}` : 'Chưa có thay đổi.'}</span>
                        <div>
                            <button type="button" className="pf-btn ghost" disabled={!dirty || saving} onClick={() => { setForm(toForm(pf)); setErrs({}); }}>Hoàn tác</button>
                            <button className="pf-btn" disabled={!dirty || saving}>{saving ? <span className="pf-spin" /> : <><Icon d="check" size={16} /> Lưu thay đổi</>}</button>
                        </div>
                    </div>
                </form>
            )}

            {/* ===== GIA ĐÌNH ===== */}
            {tab === 'family' && (
                <div className="pf-col">
                    <div className="pf-note"><Icon d="lock" size={16} /> Thông tin phụ huynh do nhà trường quản lý. Cần thay đổi (ví dụ đổi số điện thoại), hãy bấm <Icon d="edit" size={13} /> để gửi yêu cầu.</div>
                    <div className="pf-people">
                        {([['Bố', 'father', fam.father], ['Mẹ', 'mother', fam.mother]] as const).map(([label, key, p]) => (
                            <section className="pf-card pf-person" key={key}>
                                <div className="pf-person-top">
                                    <span className="pf-person-av">{p.name ? initials(p.name) : '?'}</span>
                                    <div><small>{label}</small><b>{p.name ?? 'Chưa cập nhật'}</b></div>
                                    <button type="button" className="pf-req" onClick={() => askEdit(`${key}_name`)} aria-label={`Yêu cầu sửa họ tên ${label}`}><Icon d="edit" size={14} /></button>
                                </div>
                                <div className="pf-infogrid one">
                                    <Info label="Năm sinh" value={p.birth_year} />
                                    <Info label="Nghề nghiệp" value={p.job} field={`${key}_job`} onRequest={askEdit} />
                                    <Info label="Số điện thoại" value={p.phone} field={`${key}_phone`} onRequest={askEdit} />
                                </div>
                            </section>
                        ))}
                    </div>
                    <Card icon="family" title="Người giám hộ" sub="Chỉ có khi học sinh không sống cùng bố mẹ.">
                        {fam.guardian.name ? (
                            <div className="pf-infogrid">
                                <Info label="Họ và tên" value={fam.guardian.name} field="guardian_name" onRequest={askEdit} />
                                <Info label="Quan hệ" value={fam.guardian.relation} field="guardian_relation" onRequest={askEdit} />
                                <Info label="Số điện thoại" value={fam.guardian.phone} field="guardian_phone" onRequest={askEdit} />
                            </div>
                        ) : (
                            <p className="pf-empty">Chưa có người giám hộ.{' '}
                                <button type="button" className="pf-link" onClick={() => askEdit('guardian_name')}>Gửi yêu cầu thêm</button></p>
                        )}
                    </Card>
                    <Card icon="phone" title="Liên hệ khẩn cấp">
                        <div className="pf-infogrid">
                            <Info label="Người liên hệ" value={pf.contact.emergency_name} />
                            <Info label="Quan hệ" value={pf.contact.emergency_relation} />
                            <Info label="Số điện thoại" value={pf.contact.emergency_phone} />
                        </div>
                        <button type="button" className="pf-link block" onClick={() => go('contact')}>Chỉnh sửa liên hệ khẩn cấp <Icon d="arrow" size={14} /></button>
                    </Card>
                </div>
            )}

            {/* ===== HỌC TẬP ===== */}
            {tab === 'academic' && (
                <div className="pf-col">
                    {cur ? (
                        <section className="pf-stats five">
                            <div className="pf-stat"><span><Icon d="book" size={20} /></span><div><small>ĐTB học kỳ 1</small><b>{score(cur.hk1)}</b></div></div>
                            <div className="pf-stat"><span><Icon d="book" size={20} /></span><div><small>ĐTB học kỳ 2</small><b>{score(cur.hk2)}</b></div></div>
                            <div className="pf-stat"><span><Icon d="star" size={20} /></span><div><small>ĐTB cả năm</small><b>{score(cur.avg)}</b></div></div>
                            <div className="pf-stat"><span><Icon d="check" size={20} /></span><div><small>Học lực</small><b><i className={`pf-rank ${rankClass(cur.rank)}`}>{cur.rank ?? '—'}</i></b></div></div>
                            <div className="pf-stat"><span><Icon d="heart" size={20} /></span><div><small>Hạnh kiểm</small><b><i className={`pf-rank ${rankClass(cur.conduct_year)}`}>{cur.conduct_year ?? '—'}</i></b></div></div>
                        </section>
                    ) : <div className="pf-alert warn"><Icon d="alert" size={18} /> Chưa có dữ liệu học tập của năm học hiện tại.</div>}

                    <Card icon="cal" title="Quá trình học tập qua các năm" sub="ĐTB tính từ điểm trung bình các môn tính điểm."
                          action={<Link href="/student/grades" className="pf-link">Xem bảng điểm chi tiết</Link>}>
                        <div className="pf-tablewrap">
                            <table className="pf-table">
                                <thead><tr><th>Năm học</th><th>Lớp</th><th>GVCN</th><th>ĐTB HK1</th><th>ĐTB HK2</th><th>ĐTB năm</th><th>Học lực</th><th>Hạnh kiểm</th></tr></thead>
                                <tbody>
                                {pf.academic.history.map((y) => (
                                    <tr key={y.year} className={y.is_current ? 'cur' : ''}>
                                        <td data-l="Năm học"><b>{y.year}</b>{y.is_current && <span className="pf-pill approved">Hiện tại</span>}</td>
                                        <td data-l="Lớp">{y.class}</td>
                                        <td data-l="GVCN">{y.homeroom ?? '—'}</td>
                                        <td data-l="ĐTB HK1">{score(y.hk1)}</td>
                                        <td data-l="ĐTB HK2">{score(y.hk2)}</td>
                                        <td data-l="ĐTB năm"><b>{score(y.avg)}</b></td>
                                        <td data-l="Học lực"><i className={`pf-rank ${rankClass(y.rank)}`}>{y.rank ?? '—'}</i></td>
                                        <td data-l="Hạnh kiểm"><i className={`pf-rank ${rankClass(y.conduct_year)}`}>{y.conduct_year ?? '—'}</i></td>
                                    </tr>
                                ))}
                                {pf.academic.history.length === 0 && <tr><td colSpan={8} className="pf-empty">Chưa có dữ liệu.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {/* ===== YÊU CẦU CHỈNH SỬA ===== */}
            {tab === 'requests' && (
                <div className="pf-col">
                    <Card icon="doc" title="Yêu cầu chỉnh sửa thông tin" sub="Gửi yêu cầu để nhà trường xem xét và cập nhật hồ sơ chính thức."
                          action={<button type="button" className="pf-btn sm" onClick={() => setModal({ preset: null })}><Icon d="send" size={15} /> Tạo yêu cầu</button>}>
                        {pf.requests.length === 0 ? (
                            <div className="pf-emptybox"><Icon d="doc" size={34} /><b>Chưa có yêu cầu nào</b><p>Khi thông tin hồ sơ có sai sót, hãy tạo yêu cầu chỉnh sửa tại đây.</p></div>
                        ) : (
                            <ul className="pf-reqlist">
                                {pf.requests.map((r) => (
                                    <li key={r.id} className={`s-${r.status}`}>
                                        <div className="pf-req-top">
                                            <b>{r.field_label}</b>
                                            <span className={`pf-pill ${STATUS[r.status].cls}`}>{STATUS[r.status].text}</span>
                                        </div>
                                        <div className="pf-diff">
                                            <div><small>Trước</small><span>{r.old_value || 'Chưa cập nhật'}</span></div>
                                            <Icon d="arrow" size={16} />
                                            <div><small>Đề nghị</small><b>{r.new_value}</b></div>
                                        </div>
                                        <p className="pf-reason"><small>Lý do:</small> {r.reason}</p>
                                        {r.review_note && <p className="pf-review"><small>Phản hồi của nhà trường:</small> {r.review_note}</p>}
                                        <div className="pf-req-foot">
                                            <span><Icon d="clock" size={13} /> Gửi {dt(r.created_at)}{r.reviewed_at ? ` · Xử lý ${dt(r.reviewed_at)}` : ''}</span>
                                            {r.status === 'pending' && (cancelId === r.id ? (
                                                <span className="pf-confirm">Hủy yêu cầu này?
                                                    <button type="button" className="pf-btn sm ghost" onClick={() => setCancelId(null)}>Không</button>
                                                    <button type="button" className="pf-btn sm danger" onClick={() => cancelReq(r.id)}>Hủy yêu cầu</button>
                                                </span>
                                            ) : <button type="button" className="pf-btn sm ghost danger" onClick={() => setCancelId(r.id)}>Hủy yêu cầu</button>)}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            )}

            {modal && <RequestModal fields={pf.fields.request} preset={modal.preset} current={currentValue} onClose={() => setModal(null)} onSubmit={submitRequest} />}
        </div>
    );
}