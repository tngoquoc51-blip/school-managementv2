'use client';

import './admin-layout.css';
import './admin-layout.css';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

/* ======================================================
   KIỂU DỮ LIỆU + DỮ LIỆU CŨ (giữ nguyên)
   ====================================================== */
type UserStatus = 'active' | 'locked' | 'pending';

interface SchoolUser {
    id: string;
    name: string;
    username: string;
    email: string;
    phone?: string;
    roles: string[];
    status: UserStatus;
    createdAt: string;
}

const ROLE_LABEL: Record<string, string> = {
    super_admin: 'Quản trị',
    principal: 'Hiệu trưởng',
    vice_principal: 'Phó HT',
    academic: 'Giáo vụ',
    accountant: 'Kế toán',
    teacher: 'GV bộ môn',
    homeroom_teacher: 'GVCN',
    department_head: 'Tổ trưởng',
    student: 'Học sinh',
    parent: 'Phụ huynh',
    librarian: 'Thư viện',
    medical: 'Y tế',
    supervisor: 'Giám thị',
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

/* ======================================================
   NHÓM VAI TRÒ (mỗi nhóm một màu nhận diện)
   ====================================================== */
type Tone = 'violet' | 'teal' | 'sky' | 'amber' | 'rose' | 'slate';

const ROLE_GROUPS: { key: string; label: string; tone: Tone; roles: string[] }[] = [
    { key: 'manage', label: 'Quản lý', tone: 'violet', roles: ['super_admin', 'principal', 'vice_principal'] },
    { key: 'office', label: 'Giáo vụ – Kế toán', tone: 'teal', roles: ['academic', 'accountant'] },
    { key: 'teacher', label: 'Giáo viên', tone: 'sky', roles: ['teacher', 'homeroom_teacher', 'department_head'] },
    { key: 'student', label: 'Học sinh', tone: 'amber', roles: ['student'] },
    { key: 'parent', label: 'Phụ huynh', tone: 'rose', roles: ['parent'] },
    { key: 'staff', label: 'Nhân viên khác', tone: 'slate', roles: ['librarian', 'medical', 'supervisor'] },
];

const groupOfRole = (role: string) => ROLE_GROUPS.find((g) => g.roles.includes(role));
const toneOfRole = (role: string): Tone => groupOfRole(role)?.tone ?? 'slate';
const toneOfUser = (u: SchoolUser): Tone => (u.roles[0] ? toneOfRole(u.roles[0]) : 'slate');

const STATUS_META: Record<UserStatus, { label: string; badge: 'ok' | 'bad' | 'warn' }> = {
    active: { label: 'Hoạt động', badge: 'ok' },
    locked: { label: 'Đã khóa', badge: 'bad' },
    pending: { label: 'Chờ kích hoạt', badge: 'warn' },
};

type Stats = Record<'total' | UserStatus, number>;

/* ======================================================
   TIỆN ÍCH
   ====================================================== */
function toTime(s: string) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
    const t = Date.parse(s);
    return Number.isNaN(t) ? 0 : t;
}

function downloadCsv(list: SchoolUser[]) {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const head = ['Họ tên', 'Tên đăng nhập', 'Email', 'Số điện thoại', 'Vai trò', 'Trạng thái', 'Ngày tạo'];
    const rows = list.map((u) =>
        [u.name, u.username, u.email, u.phone || '', u.roles.map((r) => ROLE_LABEL[r] || r).join('; '), STATUS_META[u.status].label, u.createdAt]
            .map(esc)
            .join(',')
    );
    const blob = new Blob(['\uFEFF' + [head.map(esc).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tai-khoan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

/* ======================================================
   ICON (SVG inline, có width/height để không bị phình)
   ====================================================== */
const PATHS = {
    users: (<><circle cx="9" cy="7" r="3.5" /><path d="M2 21v-1a6 6 0 0 1 12 0v1" /><path d="M16 4a3.5 3.5 0 0 1 0 6.5M18 14.5a6 6 0 0 1 4 5.5V21" /></>),
    check: (<><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" /></>),
    lock: (<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
    unlock: (<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 7.5-2" /></>),
    hourglass: (<path d="M7 2h10M7 22h10M8 2c0 5 4 6 4 10s-4 5-4 10M16 2c0 5-4 6-4 10s4 5 4 10" />),
    search: (<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>),
    plus: (<path d="M12 5v14M5 12h14" />),
    userPlus: (<><circle cx="9" cy="7" r="4" /><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6" /></>),
    refresh: (<><path d="M21 12a9 9 0 0 0-15-6.7L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 15 6.7L21 16" /><path d="M21 21v-5h-5" /></>),
    download: (<path d="M12 3v12M7 10l5 5 5-5M4 21h16" />),
    eye: (<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
    key: (<><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2L20 3M16 7l3 3M14 9l2 2" /></>),
    shield: (<><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></>),
    close: (<path d="M6 6l12 12M18 6L6 18" />),
    left: (<path d="M15 6l-6 6 6 6" />),
    right: (<path d="M9 6l6 6-6 6" />),
    sort: (<path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4" />),
} as const;

type IconName = keyof typeof PATHS;

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {PATHS[name]}
        </svg>
    );
}

/* ======================================================
   THÀNH PHẦN NHỎ
   ====================================================== */
function Avatar({ u, large }: { u: SchoolUser; large?: boolean }) {
    return (
        <span className={`usr-avatar tone-${toneOfUser(u)} ${large ? 'lg' : ''}`}>
            {u.name.charAt(0).toUpperCase()}
            <i className={`usr-dot ${u.status}`} />
        </span>
    );
}

function StatusBadge({ s }: { s: UserStatus }) {
    return <span className={`usr-badge ${STATUS_META[s].badge}`}>{STATUS_META[s].label}</span>;
}

function RolePills({ roles }: { roles: string[] }) {
    if (roles.length === 0) return <span className="usr-role tone-slate muted">Chưa gán</span>;
    return (
        <div className="usr-roles">
            {roles.map((r) => (
                <span key={r} className={`usr-role tone-${toneOfRole(r)}`}>{ROLE_LABEL[r] || r}</span>
            ))}
        </div>
    );
}

/* Chọn vai trò theo nhóm (dùng cho form thêm mới và ngăn chi tiết) */
function RolePicker({ value, onToggle }: { value: string[]; onToggle: (role: string) => void }) {
    return (
        <div className="usr-picker">
            {ROLE_GROUPS.map((g) => (
                <div key={g.key} className="usr-picker-group">
                    <span className="usr-picker-label">{g.label}</span>
                    <div className="usr-picker-chips">
                        {g.roles.map((r) => {
                            const on = value.includes(r);
                            return (
                                <button
                                    key={r}
                                    type="button"
                                    className={`usr-pick tone-${g.tone} ${on ? 'on' : ''}`}
                                    aria-pressed={on}
                                    onClick={() => onToggle(r)}
                                >
                                    {on && <Icon name="check" size={14} />}
                                    {ROLE_LABEL[r]}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ---------- Form thêm tài khoản ---------- */
interface NewUserValues {
    name: string;
    email: string;
    username: string;
    phone: string;
    roles: string[];
    status: UserStatus;
}

function UserFormModal({ users, onClose, onSubmit }: { users: SchoolUser[]; onClose: () => void; onSubmit: (v: NewUserValues) => void }) {
    const [v, setV] = useState<NewUserValues>({ name: '', email: '', username: '', phone: '', roles: [], status: 'pending' });
    const [errors, setErrors] = useState<Partial<Record<'name' | 'email' | 'username', string>>>({});

    const set = <K extends keyof NewUserValues>(k: K, val: NewUserValues[K]) => setV((p) => ({ ...p, [k]: val }));

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const err: typeof errors = {};
        if (!v.name.trim()) err.name = 'Vui lòng nhập họ tên';
        if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) err.email = 'Email chưa đúng định dạng';
        else if (users.some((u) => u.email.toLowerCase() === v.email.trim().toLowerCase())) err.email = 'Email này đã tồn tại';
        if (v.username.trim() && users.some((u) => u.username.toLowerCase() === v.username.trim().toLowerCase()))
            err.username = 'Tên đăng nhập đã tồn tại';
        setErrors(err);
        if (Object.keys(err).length === 0) onSubmit(v);
    };

    return (
        <div className="usr-mask center" onMouseDown={onClose}>
            <form className="usr-modal" role="dialog" aria-modal="true" aria-labelledby="usr-form-title" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
                <div className="usr-modal-head">
                    <span className="usr-modal-icon"><Icon name="userPlus" size={22} /></span>
                    <div>
                        <h3 id="usr-form-title">Thêm tài khoản</h3>
                        <p>Tạo người dùng mới và gán vai trò ban đầu</p>
                    </div>
                    <button type="button" className="usr-close" onClick={onClose} aria-label="Đóng"><Icon name="close" /></button>
                </div>

                <div className="usr-modal-body">
                    <div className="usr-grid2">
                        <div className={`usr-field ${errors.name ? 'has-error' : ''}`}>
                            <label htmlFor="nu-name">Họ và tên *</label>
                            <input id="nu-name" value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="Nguyễn Văn A" autoFocus />
                            {errors.name && <small>{errors.name}</small>}
                        </div>
                        <div className={`usr-field ${errors.email ? 'has-error' : ''}`}>
                            <label htmlFor="nu-email">Email *</label>
                            <input
                                id="nu-email"
                                type="email"
                                value={v.email}
                                onChange={(e) => set('email', e.target.value)}
                                onBlur={() => !v.username && v.email.includes('@') && set('username', v.email.split('@')[0])}
                                placeholder="ten@thpt.edu.vn"
                            />
                            {errors.email && <small>{errors.email}</small>}
                        </div>
                        <div className={`usr-field ${errors.username ? 'has-error' : ''}`}>
                            <label htmlFor="nu-user">Tên đăng nhập</label>
                            <input id="nu-user" value={v.username} onChange={(e) => set('username', e.target.value)} placeholder="Tự lấy từ email" />
                            {errors.username && <small>{errors.username}</small>}
                        </div>
                        <div className="usr-field">
                            <label htmlFor="nu-phone">Số điện thoại</label>
                            <input id="nu-phone" value={v.phone} onChange={(e) => set('phone', e.target.value)} placeholder="09xx xxx xxx" inputMode="tel" />
                        </div>
                    </div>

                    <div className="usr-field">
                        <label>Vai trò</label>
                        <RolePicker value={v.roles} onToggle={(r) => set('roles', v.roles.includes(r) ? v.roles.filter((x) => x !== r) : [...v.roles, r])} />
                    </div>

                    <div className="usr-field">
                        <label>Trạng thái ban đầu</label>
                        <div className="usr-seg">
                            <button type="button" className={v.status === 'pending' ? 'on warn' : ''} onClick={() => set('status', 'pending')}>Chờ kích hoạt</button>
                            <button type="button" className={v.status === 'active' ? 'on ok' : ''} onClick={() => set('status', 'active')}>Hoạt động ngay</button>
                        </div>
                    </div>
                </div>

                <div className="usr-modal-foot">
                    <button type="button" className="usr-btn ghost" onClick={onClose}>Hủy</button>
                    <button type="submit" className="usr-btn primary"><Icon name="plus" size={16} /> Tạo tài khoản</button>
                </div>
            </form>
        </div>
    );
}

/* ---------- Hộp xác nhận ---------- */
interface ConfirmState {
    title: string;
    message: ReactNode;
    confirmLabel: string;
    tone: 'danger' | 'primary' | 'warn';
    onConfirm: () => void | Promise<void>;
}

function ConfirmDialog({ c, onClose }: { c: ConfirmState; onClose: () => void }) {
    return (
        <div className="usr-mask center" onMouseDown={onClose}>
            <div className="usr-confirm" role="alertdialog" aria-modal="true" aria-labelledby="usr-cf-title" onMouseDown={(e) => e.stopPropagation()}>
                <h3 id="usr-cf-title">{c.title}</h3>
                <p>{c.message}</p>
                <div className="usr-confirm-foot">
                    <button type="button" className="usr-btn ghost" onClick={onClose}>Hủy</button>
                    <button
                        type="button"
                        className={`usr-btn ${c.tone}`}
                        autoFocus
                        onClick={async () => {
                            onClose();
                            await c.onConfirm();
                        }}
                    >
                        {c.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ======================================================
   TRANG QUẢN LÝ TÀI KHOẢN
   ====================================================== */
export default function AdminUsersPage() {
    const [users, setUsers] = useState<SchoolUser[]>([]);
    const [stats, setStats] = useState<Stats>({ total: 0, active: 0, locked: 0, pending: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [groupFilter, setGroupFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
    const [sort, setSort] = useState<{ key: 'name' | 'createdAt' | null; dir: 'asc' | 'desc' }>({ key: null, dir: 'asc' });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [busy, setBusy] = useState<Set<string>>(new Set());
    const [toasts, setToasts] = useState<{ id: number; msg: string; tone: 'ok' | 'info' | 'bad' }[]>([]);
    const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
    const [showForm, setShowForm] = useState(false);

    const selected = users.find((u) => u.id === selectedId) ?? null;

    const toast = (msg: string, tone: 'ok' | 'info' | 'bad' = 'ok') => {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t, { id, msg, tone }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
    };

    /* ---------- Tải dữ liệu (giữ nguyên cách gọi API) ---------- */
    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API}/admin/users`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const list: SchoolUser[] = (json.data || []).map((u: any) => ({
                id: String(u.id),
                name: u.name,
                username: u.username || '',
                email: u.email,
                phone: u.phone,
                roles: u.roles || [],
                status: (u.status || 'active') as UserStatus,
                createdAt: u.created_at || '',
            }));
            setUsers(list);
            if (json.stats) setStats(json.stats);
            else
                setStats({
                    total: list.length,
                    active: list.filter((u) => u.status === 'active').length,
                    locked: list.filter((u) => u.status === 'locked').length,
                    pending: list.filter((u) => u.status === 'pending').length,
                });
            setChecked(new Set());
        } catch {
            setError('Không kết nối được API. Kiểm tra Laravel (php artisan serve).');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    /* Esc đóng lớp phủ trên cùng */
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (confirmState) setConfirmState(null);
            else if (showForm) setShowForm(false);
            else if (selectedId) setSelectedId(null);
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [confirmState, showForm, selectedId]);

    /* ---------- Lọc, sắp xếp, phân trang ---------- */
    const groupCounts = useMemo(() => {
        const c: Record<string, number> = { all: users.length, none: users.filter((u) => u.roles.length === 0).length };
        ROLE_GROUPS.forEach((g) => (c[g.key] = users.filter((u) => u.roles.some((r) => g.roles.includes(r))).length));
        return c;
    }, [users]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return users.filter((u) => {
            const matchQ = !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
            const matchRole = roleFilter === 'all' || u.roles.includes(roleFilter);
            const matchStatus = statusFilter === 'all' || u.status === statusFilter;
            const matchGroup =
                groupFilter === 'all' ||
                (groupFilter === 'none' ? u.roles.length === 0 : u.roles.some((r) => ROLE_GROUPS.find((g) => g.key === groupFilter)?.roles.includes(r)));
            return matchQ && matchRole && matchStatus && matchGroup;
        });
    }, [users, query, roleFilter, statusFilter, groupFilter]);

    const sorted = useMemo(() => {
        if (!sort.key) return filtered; // giữ nguyên thứ tự API
        const m = sort.dir === 'asc' ? 1 : -1;
        return [...filtered].sort((a, b) =>
            sort.key === 'name' ? a.name.localeCompare(b.name, 'vi') * m : (toTime(a.createdAt) - toTime(b.createdAt)) * m
        );
    }, [filtered, sort]);

    const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
    const safePage = Math.min(page, pageCount);
    const rows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

    useEffect(() => setPage(1), [query, roleFilter, statusFilter, groupFilter, pageSize]);

    const filtersActive = query !== '' || roleFilter !== 'all' || statusFilter !== 'all' || groupFilter !== 'all';
    const clearFilters = () => {
        setQuery('');
        setRoleFilter('all');
        setStatusFilter('all');
        setGroupFilter('all');
    };

    const toggleSort = (key: 'name' | 'createdAt') =>
        setSort((s) => (s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : { key: null, dir: 'asc' }));

    const pageList = (): (number | '…')[] => {
        const set = new Set([1, pageCount, safePage - 1, safePage, safePage + 1].filter((n) => n >= 1 && n <= pageCount));
        const arr = [...set].sort((a, b) => a - b);
        const out: (number | '…')[] = [];
        arr.forEach((n, i) => {
            if (i > 0 && n - arr[i - 1] > 1) out.push('…');
            out.push(n);
        });
        return out;
    };

    /* ---------- Chọn nhiều ---------- */
    const allOnPage = rows.length > 0 && rows.every((u) => checked.has(u.id));
    const someOnPage = rows.some((u) => checked.has(u.id));
    const toggleAll = () =>
        setChecked((prev) => {
            const n = new Set(prev);
            rows.forEach((u) => (allOnPage ? n.delete(u.id) : n.add(u.id)));
            return n;
        });
    const toggleOne = (id: string) =>
        setChecked((prev) => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    const checkedUsers = users.filter((u) => checked.has(u.id));

    /* ---------- Thao tác (demo cục bộ – TODO: nối API) ---------- */
    const changeStatus = async (list: SchoolUser[], next: UserStatus, msg: string) => {
        const targets = list.filter((u) => u.status !== next);
        if (targets.length === 0) {
            toast('Không có tài khoản nào cần thay đổi', 'info');
            return;
        }
        const ids = new Set(targets.map((u) => u.id));
        setBusy(ids);
        try {
            await new Promise((r) => setTimeout(r, 400)); // TODO: PATCH `${API}/admin/users/{id}/status`
            setStats((s) => {
                const n = { ...s };
                targets.forEach((u) => {
                    n[u.status] = Math.max(0, n[u.status] - 1);
                    n[next] += 1;
                });
                return n;
            });
            setUsers((prev) => prev.map((u) => (ids.has(u.id) ? { ...u, status: next } : u)));
            toast(msg);
        } finally {
            setBusy(new Set());
        }
    };

    const lockOne = (u: SchoolUser) => changeStatus([u], 'locked', `Đã khóa ${u.name}`);
    const unlockOne = (u: SchoolUser) => changeStatus([u], 'active', `Đã mở khóa ${u.name}`);
    const activateOne = (u: SchoolUser) => changeStatus([u], 'active', `Đã kích hoạt ${u.name}`);

    const askResetPassword = (list: SchoolUser[]) =>
        setConfirmState({
            title: 'Đặt lại mật khẩu',
            message:
                list.length === 1 ? (
                    <>Đặt lại mật khẩu cho <b>{list[0].name}</b>? Mật khẩu tạm: <code>password</code></>
                ) : (
                    <>Đặt lại mật khẩu cho <b>{list.length} tài khoản</b>? Mật khẩu tạm: <code>password</code></>
                ),
            confirmLabel: 'Đặt lại',
            tone: 'primary',
            onConfirm: async () => {
                setBusy(new Set(list.map((u) => u.id)));
                try {
                    await new Promise((r) => setTimeout(r, 400)); // TODO: POST `${API}/admin/users/{id}/reset-password`
                    toast(list.length === 1 ? `Đã đặt lại mật khẩu cho ${list[0].username || list[0].email}` : `Đã đặt lại mật khẩu cho ${list.length} tài khoản`);
                } finally {
                    setBusy(new Set());
                }
            },
        });

    const askLockMany = (list: SchoolUser[]) => {
        const n = list.filter((u) => u.status !== 'locked').length;
        setConfirmState({
            title: 'Khóa tài khoản đã chọn',
            message: <>Khóa <b>{n} tài khoản</b>? Họ sẽ không đăng nhập được cho đến khi được mở khóa.</>,
            confirmLabel: 'Khóa',
            tone: 'danger',
            onConfirm: () => changeStatus(list, 'locked', `Đã khóa ${n} tài khoản`),
        });
    };

    const toggleRole = (u: SchoolUser, role: string) => {
        const has = u.roles.includes(role);
        const roles = has ? u.roles.filter((r) => r !== role) : [...u.roles, role];
        setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, roles } : x))); // TODO: PUT `${API}/admin/users/{id}/roles`
        toast(`${has ? 'Đã gỡ' : 'Đã gán'} vai trò ${ROLE_LABEL[role] || role}`, 'info');
    };

    const createUser = (v: NewUserValues) => {
        const u: SchoolUser = {
            id: `local-${Date.now()}`,
            name: v.name.trim(),
            username: v.username.trim(),
            email: v.email.trim(),
            phone: v.phone.trim() || undefined,
            roles: v.roles,
            status: v.status,
            createdAt: new Date().toLocaleDateString('vi-VN'),
        }; // TODO: POST `${API}/admin/users`
        setUsers((p) => [u, ...p]);
        setStats((s) => ({ ...s, total: s.total + 1, [v.status]: s[v.status] + 1 }));
        setShowForm(false);
        toast(`Đã thêm tài khoản ${u.name}`);
    };

    /* ---------- Thẻ thống kê (bấm để lọc) ---------- */
    const STAT_CARDS: { key: 'all' | UserStatus; tone: string; icon: IconName; label: string; value: number }[] = [
        { key: 'all', tone: 'sky', icon: 'users', label: 'Tổng tài khoản', value: stats.total },
        { key: 'active', tone: 'green', icon: 'check', label: 'Đang hoạt động', value: stats.active },
        { key: 'locked', tone: 'red', icon: 'lock', label: 'Đã khóa', value: stats.locked },
        { key: 'pending', tone: 'amber', icon: 'hourglass', label: 'Chờ kích hoạt', value: stats.pending },
    ];

    return (
        <div className="usr-page">
            {/* ---------- Thông báo ---------- */}
            <div className="usr-toasts" aria-live="polite">
                {toasts.map((t) => (
                    <div key={t.id} className={`usr-toast ${t.tone}`}>
                        <Icon name={t.tone === 'bad' ? 'close' : 'check'} size={16} />
                        {t.msg}
                    </div>
                ))}
            </div>

            {/* ---------- Thống kê ---------- */}
            <div className="usr-stats">
                {STAT_CARDS.map((s) => (
                    <button
                        key={s.key}
                        type="button"
                        className={`usr-stat ${s.tone} ${statusFilter === s.key ? 'active' : ''}`}
                        aria-pressed={statusFilter === s.key}
                        onClick={() => setStatusFilter(s.key)}
                    >
                        <span className="usr-stat-icon"><Icon name={s.icon} size={22} /></span>
                        <span>
                            <span className="usr-stat-label">{s.label}</span>
                            <span className="usr-stat-value">{s.value}</span>
                        </span>
                    </button>
                ))}
            </div>

            {/* ---------- Bảng ---------- */}
            <section className="usr-panel">
                <div className="usr-panel-head">
                    <div>
                        <h2>Danh sách tài khoản</h2>
                        <p>Quản lý người dùng toàn trường · dữ liệu thật từ API</p>
                    </div>
                    <div className="usr-head-actions">
                        <button type="button" className="usr-btn ghost" onClick={loadUsers} disabled={loading}>
                            <span className={loading ? 'spin' : ''}><Icon name="refresh" size={16} /></span> Làm mới
                        </button>
                        <button type="button" className="usr-btn ghost" onClick={() => downloadCsv(sorted)} disabled={sorted.length === 0}>
                            <Icon name="download" size={16} /> Xuất CSV
                        </button>
                        <button type="button" className="usr-btn primary" onClick={() => setShowForm(true)}>
                            <Icon name="plus" size={16} /> Thêm tài khoản
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="usr-alert" role="alert">
                        <span>{error}</span>
                        <button type="button" onClick={loadUsers}>Thử lại</button>
                    </div>
                )}

                {/* Lọc nhanh theo nhóm vai trò */}
                <div className="usr-groups" role="group" aria-label="Lọc theo nhóm vai trò">
                    <button type="button" className={`usr-group tone-sky ${groupFilter === 'all' ? 'on' : ''}`} aria-pressed={groupFilter === 'all'} onClick={() => setGroupFilter('all')}>
                        Tất cả <b>{groupCounts.all}</b>
                    </button>
                    {ROLE_GROUPS.map((g) => (
                        <button key={g.key} type="button" className={`usr-group tone-${g.tone} ${groupFilter === g.key ? 'on' : ''}`} aria-pressed={groupFilter === g.key} onClick={() => setGroupFilter(g.key)}>
                            {g.label} <b>{groupCounts[g.key]}</b>
                        </button>
                    ))}
                    <button type="button" className={`usr-group tone-slate ${groupFilter === 'none' ? 'on' : ''}`} aria-pressed={groupFilter === 'none'} onClick={() => setGroupFilter('none')}>
                        Chưa gán vai trò <b>{groupCounts.none}</b>
                    </button>
                </div>

                <div className="usr-toolbar">
                    <div className="usr-search">
                        <Icon name="search" size={18} />
                        <input type="search" placeholder="Tìm tên, mã, email..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Tìm tài khoản" />
                    </div>
                    <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Lọc theo vai trò">
                        <option value="all">Tất cả vai trò</option>
                        {Object.entries(ROLE_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
                    </select>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | UserStatus)} aria-label="Lọc theo trạng thái">
                        <option value="all">Tất cả trạng thái</option>
                        <option value="active">Hoạt động</option>
                        <option value="locked">Đã khóa</option>
                        <option value="pending">Chờ kích hoạt</option>
                    </select>
                    {filtersActive && (
                        <button type="button" className="usr-clear" onClick={clearFilters}>
                            <Icon name="close" size={14} /> Xóa lọc
                        </button>
                    )}
                </div>

                {/* Thanh thao tác hàng loạt */}
                {checked.size > 0 && (
                    <div className="usr-bulk" role="region" aria-label="Thao tác hàng loạt">
                        <span className="usr-bulk-count"><b>{checked.size}</b> tài khoản đã chọn</span>
                        <div className="usr-bulk-actions">
                            <button type="button" className="usr-chipbtn ok" onClick={() => changeStatus(checkedUsers, 'active', `Đã kích hoạt / mở khóa ${checked.size} tài khoản`)}>
                                <Icon name="unlock" size={15} /> Kích hoạt / Mở khóa
                            </button>
                            <button type="button" className="usr-chipbtn warn" onClick={() => askLockMany(checkedUsers)}>
                                <Icon name="lock" size={15} /> Khóa
                            </button>
                            <button type="button" className="usr-chipbtn violet" onClick={() => askResetPassword(checkedUsers)}>
                                <Icon name="key" size={15} /> Đặt lại MK
                            </button>
                            <button type="button" className="usr-chipbtn sky" onClick={() => downloadCsv(checkedUsers)}>
                                <Icon name="download" size={15} /> Xuất CSV
                            </button>
                        </div>
                        <button type="button" className="usr-bulk-clear" onClick={() => setChecked(new Set())}>Bỏ chọn</button>
                    </div>
                )}

                {loading ? (
                    <div className="usr-skeleton" aria-busy="true" aria-label="Đang tải dữ liệu">
                        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="usr-skel-row" />)}
                    </div>
                ) : (
                    <>
                        <div className="usr-table-wrap">
                            <table className="usr-table">
                                <thead>
                                <tr>
                                    <th className="c-check">
                                        <input
                                            type="checkbox"
                                            checked={allOnPage}
                                            ref={(el) => { if (el) el.indeterminate = someOnPage && !allOnPage; }}
                                            onChange={toggleAll}
                                            aria-label="Chọn tất cả trên trang"
                                        />
                                    </th>
                                    <th>
                                        <button type="button" className={`usr-sort ${sort.key === 'name' ? 'on' : ''}`} onClick={() => toggleSort('name')}>
                                            Họ tên <Icon name="sort" size={13} />
                                        </button>
                                    </th>
                                    <th>Tên đăng nhập</th>
                                    <th>Vai trò</th>
                                    <th>Trạng thái</th>
                                    <th>
                                        <button type="button" className={`usr-sort ${sort.key === 'createdAt' ? 'on' : ''}`} onClick={() => toggleSort('createdAt')}>
                                            Ngày tạo <Icon name="sort" size={13} />
                                        </button>
                                    </th>
                                    <th className="c-actions">Thao tác</th>
                                </tr>
                                </thead>
                                <tbody>
                                {rows.map((u) => (
                                    <tr key={u.id} className={`${checked.has(u.id) ? 'is-checked' : ''} ${selectedId === u.id ? 'is-selected' : ''}`}>
                                        <td className="c-check">
                                            <input type="checkbox" checked={checked.has(u.id)} onChange={() => toggleOne(u.id)} aria-label={`Chọn ${u.name}`} />
                                        </td>
                                        <td>
                                            <button type="button" className="usr-user" onClick={() => setSelectedId(u.id)}>
                                                <Avatar u={u} />
                                                <span className="usr-user-meta">
                                                        <strong>{u.name}</strong>
                                                        <small>{u.email}</small>
                                                    </span>
                                            </button>
                                        </td>
                                        <td><code className="usr-code">{u.username || '—'}</code></td>
                                        <td><RolePills roles={u.roles} /></td>
                                        <td><StatusBadge s={u.status} /></td>
                                        <td className="usr-date">{u.createdAt || '—'}</td>
                                        <td className="c-actions">
                                            <div className="usr-actions">
                                                <button type="button" className="usr-ib sky" title="Xem chi tiết" aria-label={`Xem chi tiết ${u.name}`} onClick={() => setSelectedId(u.id)}>
                                                    <Icon name="eye" size={16} />
                                                </button>
                                                <button type="button" className="usr-ib teal" title="Gán vai trò" aria-label={`Gán vai trò cho ${u.name}`} onClick={() => setSelectedId(u.id)}>
                                                    <Icon name="shield" size={16} />
                                                </button>
                                                {u.status === 'pending' && (
                                                    <button type="button" className="usr-ib ok" title="Kích hoạt" aria-label={`Kích hoạt ${u.name}`} disabled={busy.has(u.id)} onClick={() => activateOne(u)}>
                                                        <Icon name="check" size={16} />
                                                    </button>
                                                )}
                                                {u.status === 'locked' && (
                                                    <button type="button" className="usr-ib ok" title="Mở khóa" aria-label={`Mở khóa ${u.name}`} disabled={busy.has(u.id)} onClick={() => unlockOne(u)}>
                                                        <Icon name="unlock" size={16} />
                                                    </button>
                                                )}
                                                {u.status === 'active' && (
                                                    <button type="button" className="usr-ib warn" title="Khóa tài khoản" aria-label={`Khóa ${u.name}`} disabled={busy.has(u.id)} onClick={() => lockOne(u)}>
                                                        <Icon name="lock" size={16} />
                                                    </button>
                                                )}
                                                <button type="button" className="usr-ib violet" title="Đặt lại mật khẩu" aria-label={`Đặt lại mật khẩu ${u.name}`} disabled={busy.has(u.id)} onClick={() => askResetPassword([u])}>
                                                    <Icon name="key" size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="usr-empty">
                                            <Icon name="search" size={28} />
                                            <p>Không tìm thấy tài khoản phù hợp.</p>
                                            {filtersActive && <button type="button" className="usr-btn ghost sm" onClick={clearFilters}>Xóa bộ lọc</button>}
                                        </td>
                                    </tr>
                                )}
                                </tbody>
                            </table>
                        </div>

                        {/* Phân trang */}
                        {sorted.length > 0 && (
                            <div className="usr-pager">
                                <span className="usr-pager-info">
                                    Hiển thị {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} / {sorted.length} tài khoản
                                </span>
                                <div className="usr-pager-ctl">
                                    <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} aria-label="Số dòng mỗi trang">
                                        {[10, 20, 50].map((n) => <option key={n} value={n}>{n} dòng / trang</option>)}
                                    </select>
                                    <button type="button" className="usr-pg" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label="Trang trước"><Icon name="left" size={16} /></button>
                                    {pageList().map((n, i) =>
                                        n === '…' ? <span key={`e${i}`} className="usr-pg-gap">…</span> : (
                                            <button key={n} type="button" className={`usr-pg ${n === safePage ? 'on' : ''}`} aria-current={n === safePage ? 'page' : undefined} onClick={() => setPage(n)}>{n}</button>
                                        )
                                    )}
                                    <button type="button" className="usr-pg" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)} aria-label="Trang sau"><Icon name="right" size={16} /></button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </section>

            {/* ---------- Ngăn chi tiết ---------- */}
            {selected && (
                <div className="usr-mask" onMouseDown={() => setSelectedId(null)}>
                    <aside className="usr-drawer" role="dialog" aria-modal="true" aria-label={`Chi tiết ${selected.name}`} onMouseDown={(e) => e.stopPropagation()}>
                        <div className="usr-drawer-head">
                            <div className="usr-drawer-user">
                                <Avatar u={selected} large />
                                <div>
                                    <h3>{selected.name}</h3>
                                    <p>{selected.email}</p>
                                    <StatusBadge s={selected.status} />
                                </div>
                            </div>
                            <button type="button" className="usr-close" onClick={() => setSelectedId(null)} aria-label="Đóng"><Icon name="close" /></button>
                        </div>

                        <div className="usr-drawer-body">
                            <section className="usr-sec">
                                <h4>Thông tin</h4>
                                <dl className="usr-dl">
                                    <div><dt>Tên đăng nhập</dt><dd><code className="usr-code">{selected.username || '—'}</code></dd></div>
                                    <div><dt>Số điện thoại</dt><dd>{selected.phone || '—'}</dd></div>
                                    <div><dt>Ngày tạo</dt><dd>{selected.createdAt || '—'}</dd></div>
                                </dl>
                            </section>

                            <section className="usr-sec">
                                <h4>Vai trò <small>bấm để gán / gỡ</small></h4>
                                <RolePicker value={selected.roles} onToggle={(r) => toggleRole(selected, r)} />
                            </section>
                        </div>

                        <div className="usr-drawer-foot">
                            {selected.status === 'pending' && (
                                <button type="button" className="usr-btn ok" disabled={busy.has(selected.id)} onClick={() => activateOne(selected)}>
                                    <Icon name="check" size={16} /> Kích hoạt tài khoản
                                </button>
                            )}
                            {selected.status === 'locked' && (
                                <button type="button" className="usr-btn ok" disabled={busy.has(selected.id)} onClick={() => unlockOne(selected)}>
                                    <Icon name="unlock" size={16} /> Mở khóa tài khoản
                                </button>
                            )}
                            {selected.status === 'active' && (
                                <button type="button" className="usr-btn danger" disabled={busy.has(selected.id)} onClick={() => lockOne(selected)}>
                                    <Icon name="lock" size={16} /> Khóa tài khoản
                                </button>
                            )}
                            <button type="button" className="usr-btn violet" disabled={busy.has(selected.id)} onClick={() => askResetPassword([selected])}>
                                <Icon name="key" size={16} /> Đặt lại mật khẩu
                            </button>
                        </div>
                    </aside>
                </div>
            )}

            {showForm && <UserFormModal users={users} onClose={() => setShowForm(false)} onSubmit={createUser} />}
            {confirmState && <ConfirmDialog c={confirmState} onClose={() => setConfirmState(null)} />}
        </div>
    );
}