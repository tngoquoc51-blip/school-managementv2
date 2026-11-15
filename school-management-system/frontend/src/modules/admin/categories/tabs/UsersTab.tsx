'use client';

import { useCallback, useEffect, useState } from 'react';
import s from '../categories.module.css';
import { catalogService, getErrorMessage } from '../catalogApi';
import { useFeedback } from '../components/Feedback';
import Icon from '../components/Icon';
import { Badge, EmptyState, ErrorState, Modal, Pagination, SkeletonRows, formatDateTime, timeAgo } from '../components/ui';
import { ACCOUNT_STATUSES, ACCOUNT_TYPES, ROLE_LABELS, labelOf } from '../constants';
import { useDebounce } from '../hooks/useDebounce';
import type { AccountStatus, Meta, RoleRow, UserRow, UserSummary } from '../types';

const statusTone: Record<AccountStatus, 'success' | 'warning' | 'danger' | 'neutral'> = { active: 'success', pending: 'warning', locked: 'danger', inactive: 'neutral' };
const typeTone = { web: 'info', staff: 'violet', student: 'success' } as const;

export default function UsersTab({ onMutated, refreshToken }: { onMutated: () => void; refreshToken: number }) {
    const fb = useFeedback();
    const [summary, setSummary] = useState<UserSummary | null>(null);
    const [roles, setRoles] = useState<RoleRow[]>([]);

    const [searchInput, setSearchInput] = useState('');
    const search = useDebounce(searchInput);
    const [type, setType] = useState('');
    const [role, setRole] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(15);

    const [items, setItems] = useState<UserRow[]>([]);
    const [meta, setMeta] = useState<Meta>({ current_page: 1, last_page: 1, per_page: 15, total: 0, from: null, to: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState<string | null>(null);

    const [roleUser, setRoleUser] = useState<UserRow | null>(null);
    const [roleDraft, setRoleDraft] = useState<string[]>([]);
    const [savingRole, setSavingRole] = useState(false);
    const [secret, setSecret] = useState<{ user: UserRow; password: string } | null>(null);

    useEffect(() => setPage(1), [search, type, role, status, perPage]);

    const loadSummary = useCallback(async () => {
        try { setSummary(await catalogService.userSummary()); } catch { /* thẻ thống kê là phụ, bỏ qua */ }
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await catalogService.users({ search, type, role, status, page, per_page: perPage });
            setItems(res.items);
            setMeta(res.meta);
        } catch (e) {
            setError(getErrorMessage(e));
        } finally {
            setLoading(false);
        }
    }, [search, type, role, status, page, perPage]);

    useEffect(() => { void load(); }, [load, refreshToken]);
    useEffect(() => { void loadSummary(); }, [loadSummary, refreshToken]);
    useEffect(() => { catalogService.userRoles().then((r) => setRoles(r.roles)).catch(() => undefined); }, []);
    useEffect(() => setSelected(new Set()), [items]);

    const refreshAll = async () => { onMutated(); await Promise.all([load(), loadSummary()]); };

    const changeStatus = async (u: UserRow, next: 'active' | 'locked' | 'inactive') => {
        if (next !== 'active') {
            const ok = await fb.confirm({
                title: next === 'locked' ? 'Khóa tài khoản?' : 'Ngừng sử dụng tài khoản?',
                message: `“${u.name}” sẽ bị đăng xuất khỏi mọi thiết bị và không thể đăng nhập cho đến khi được mở lại.`,
                confirmLabel: next === 'locked' ? 'Khóa' : 'Ngừng sử dụng',
                tone: 'danger',
            });
            if (!ok) return;
        }
        setBusy(u.key);
        try {
            await catalogService.setUserStatus(u.type, u.id, next);
            fb.success(next === 'active' ? 'Đã mở khóa' : next === 'locked' ? 'Đã khóa tài khoản' : 'Đã ngừng sử dụng', u.name);
            await refreshAll();
        } catch (e) {
            fb.error('Không thực hiện được', getErrorMessage(e));
        } finally {
            setBusy(null);
        }
    };

    const resetPw = async (u: UserRow) => {
        const ok = await fb.confirm({
            title: 'Đặt lại mật khẩu?',
            message: `Hệ thống sẽ tạo mật khẩu tạm thời cho “${u.name}” và đăng xuất họ khỏi mọi thiết bị. Mật khẩu chỉ hiện một lần.`,
            confirmLabel: 'Đặt lại',
        });
        if (!ok) return;
        setBusy(u.key);
        try {
            const res = await catalogService.resetUserPassword(u.type, u.id);
            setSecret({ user: u, password: res.temporary_password });
            onMutated();
        } catch (e) {
            fb.error('Không đặt lại được', getErrorMessage(e));
        } finally {
            setBusy(null);
        }
    };

    const openRoles = (u: UserRow) => { setRoleUser(u); setRoleDraft(u.roles); };
    const toggleRole = (name: string) => {
        if (!roleUser) return;
        setRoleDraft((d) => (roleUser.type === 'staff' ? [name] : d.includes(name) ? d.filter((x) => x !== name) : [...d, name]));
    };
    const saveRoles = async () => {
        if (!roleUser) return;
        setSavingRole(true);
        try {
            await catalogService.setUserRoles(roleUser.type, roleUser.id, roleDraft);
            fb.success('Đã cập nhật chức năng', roleUser.name);
            setRoleUser(null);
            await refreshAll();
        } catch (e) {
            fb.error('Không cập nhật được', getErrorMessage(e));
        } finally {
            setSavingRole(false);
        }
    };

    const runBulk = async (action: 'lock' | 'unlock' | 'deactivate') => {
        const keys = Array.from(selected);
        if (action !== 'unlock') {
            const ok = await fb.confirm({
                title: action === 'lock' ? `Khóa ${keys.length} tài khoản?` : `Ngừng sử dụng ${keys.length} tài khoản?`,
                message: 'Các tài khoản này sẽ bị đăng xuất và không thể đăng nhập.',
                confirmLabel: 'Xác nhận',
                tone: 'danger',
            });
            if (!ok) return;
        }
        try {
            const r = await catalogService.bulkUsers(action, keys);
            if (r.skipped.length) fb.warning(`Đã xử lý ${r.processed}, bỏ qua ${r.skipped.length}`, r.skipped[0].reason);
            else fb.success(`Đã xử lý ${r.processed} tài khoản`);
            await refreshAll();
        } catch (e) {
            fb.error('Không thực hiện được', getErrorMessage(e));
        }
    };

    const exportCsv = async () => {
        try { await catalogService.exportUsers({ search, type, role, status }); fb.success('Đã xuất danh sách người dùng'); }
        catch (e) { fb.error('Không xuất được', getErrorMessage(e)); }
    };

    const copy = async (text: string) => {
        try { await navigator.clipboard.writeText(text); fb.success('Đã sao chép mật khẩu'); } catch { fb.info('Hãy bôi đen và sao chép thủ công'); }
    };

    const hasFilter = Boolean(searchInput || type || role || status);
    const clear = () => { setSearchInput(''); setType(''); setRole(''); setStatus(''); };
    const allOn = items.length > 0 && items.every((u) => selected.has(u.key));
    const toggleAll = () => setSelected(allOn ? new Set() : new Set(items.map((u) => u.key)));
    const toggleOne = (k: string) => setSelected((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });

    const stats = summary ? [
        { icon: 'users', label: 'Tổng tài khoản', value: summary.total, sub: summary.types.map((t) => `${t.count.toLocaleString('vi-VN')} ${t.label.toLowerCase()}`).join(' · '), tone: 'indigo' },
        { icon: 'check', label: 'Đang hoạt động', value: summary.status.active, sub: `${summary.logged_in_7d.toLocaleString('vi-VN')} đăng nhập trong 7 ngày`, tone: 'emerald' },
        { icon: 'lock', label: 'Bị khóa / ngừng', value: summary.status.locked + summary.status.inactive, sub: `${summary.status.pending} tài khoản chờ duyệt`, tone: 'amber' },
        { icon: 'alert', label: 'Chưa đổi mật khẩu', value: summary.must_change_password, sub: 'Học sinh dùng mật khẩu mặc định', tone: 'cyan' },
    ] : [];

    return (
        <>
            <div className={s.statGrid}>
                {summary
                    ? stats.map((st) => (
                        <div key={st.label} className={`${s.statCard} ${s['tone_' + st.tone]}`}>
                            <span className={s.statIcon}><Icon name={st.icon} size={20} /></span>
                            <span className={s.statLabel}>{st.label}</span>
                            <strong className={s.statValue}>{st.value.toLocaleString('vi-VN')}</strong>
                            <span className={s.statSub}>{st.sub}</span>
                        </div>
                    ))
                    : [0, 1, 2, 3].map((i) => <div key={i} className={`${s.statCard} ${s.skelCard}`} />)}
            </div>

            <section className={s.panel}>
                <div className={s.toolbar}>
                    <label className={s.search}>
                        <Icon name="search" size={16} />
                        <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Tìm theo họ tên, tên đăng nhập, email…" aria-label="Tìm người dùng" />
                    </label>
                    <select className={s.select} value={type} onChange={(e) => setType(e.target.value)} aria-label="Loại tài khoản">
                        <option value="">Loại: tất cả</option>
                        {ACCOUNT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <select className={s.select} value={role} onChange={(e) => setRole(e.target.value)} aria-label="Chức năng">
                        <option value="">Chức năng: tất cả</option>
                        {roles.map((r) => <option key={r.id} value={r.name}>{r.label} ({r.users_count})</option>)}
                    </select>
                    <select className={s.select} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Trạng thái">
                        <option value="">Trạng thái: tất cả</option>
                        {ACCOUNT_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {hasFilter && <button className={s.linkBtn} onClick={clear}>Xóa bộ lọc</button>}
                    <div className={s.toolbarSpacer} />
                    <button className={s.btnSoft} onClick={() => void refreshAll()}><Icon name="refresh" size={16} /> Làm mới</button>
                    <button className={s.btnSoft} onClick={exportCsv}><Icon name="download" size={16} /> Xuất CSV</button>
                </div>

                {selected.size > 0 && (
                    <div className={s.bulkBar} role="region" aria-label="Thao tác hàng loạt">
                        <b>{selected.size}</b> tài khoản đã chọn
                        <span className={s.toolbarSpacer} />
                        <button className={s.btnSoft} onClick={() => runBulk('unlock')}><Icon name="power" size={15} /> Mở khóa</button>
                        <button className={s.btnSoft} onClick={() => runBulk('deactivate')}><Icon name="power" size={15} /> Ngừng</button>
                        <button className={s.btnDangerSoft} onClick={() => runBulk('lock')}><Icon name="lock" size={15} /> Khóa</button>
                        <button className={s.linkBtn} onClick={() => setSelected(new Set())}>Bỏ chọn</button>
                    </div>
                )}

                <div className={s.tableWrap}>
                    <table className={s.table}>
                        <thead>
                        <tr>
                            <th className={s.colCheck}><input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="Chọn tất cả" /></th>
                            <th>Người dùng</th><th>Loại</th><th>Chức năng</th><th>Trạng thái</th><th>Đăng nhập gần nhất</th><th style={{ width: 170 }} />
                        </tr>
                        </thead>
                        <tbody>
                        {loading && items.length === 0 && <SkeletonRows cols={7} />}
                        {error && <tr><td colSpan={7}><ErrorState message={error} onRetry={() => void load()} /></td></tr>}
                        {!loading && !error && items.length === 0 && (
                            <tr><td colSpan={7}><EmptyState icon="users" title={hasFilter ? 'Không có người dùng phù hợp' : 'Chưa có tài khoản nào'} hint="Thử đổi bộ lọc hoặc từ khóa tìm kiếm." /></td></tr>
                        )}
                        {!error && items.map((u) => (
                            <tr key={u.key} className={`${selected.has(u.key) ? s.rowSelected : ''} ${loading ? s.rowLoading : ''}`}>
                                <td className={s.colCheck}><input type="checkbox" checked={selected.has(u.key)} onChange={() => toggleOne(u.key)} aria-label={`Chọn ${u.name}`} /></td>
                                <td><div className={s.cellMain}><div><strong>{u.name}{u.is_self && <> <Badge tone="info">Bạn</Badge></>}</strong><small>{u.username || '—'}{u.email ? ` · ${u.email}` : ''}</small></div></div></td>
                                <td><Badge tone={typeTone[u.type]}>{u.type_label}</Badge></td>
                                <td>{u.roles.length === 0 ? <span className={s.muted}>Chưa gán</span> : u.roles.map((r) => <span key={r} style={{ display: 'inline-block', marginRight: 6 }}><Badge tone="neutral">{ROLE_LABELS[r] ?? r}</Badge></span>)}</td>
                                <td>
                                    <Badge tone={statusTone[u.status] ?? 'neutral'} dot>{labelOf(ACCOUNT_STATUSES, u.status)}</Badge>
                                    {u.must_change_password && <small className={s.block}>Chờ đổi mật khẩu</small>}
                                </td>
                                <td>{u.last_login_at ? <div><strong>{timeAgo(u.last_login_at)}</strong><small className={s.block}>{formatDateTime(u.last_login_at)}</small></div> : <span className={s.muted}>Chưa từng</span>}</td>
                                <td className={s.colActions}>
                                    {busy === u.key ? <span className={s.spinner} /> : (
                                        <>
                                            {u.type !== 'student' && <button className={s.iconBtn} title="Đổi chức năng" aria-label="Đổi chức năng" onClick={() => openRoles(u)}><Icon name="shield" size={16} /></button>}
                                            <button className={s.iconBtn} title="Đặt lại mật khẩu" aria-label="Đặt lại mật khẩu" onClick={() => resetPw(u)}><Icon name="restore" size={16} /></button>
                                            {u.status === 'active' || u.status === 'pending'
                                                ? <button className={s.iconBtnDanger} title="Khóa tài khoản" aria-label="Khóa tài khoản" onClick={() => changeStatus(u, 'locked')} disabled={u.is_self}><Icon name="lock" size={16} /></button>
                                                : <button className={s.iconBtn} title="Mở khóa" aria-label="Mở khóa" onClick={() => changeStatus(u, 'active')}><Icon name="power" size={16} /></button>}
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
                {!error && <Pagination meta={meta} onPage={setPage} onPerPage={setPerPage} />}
            </section>

            <Modal open={Boolean(roleUser)} title={roleUser ? `Chức năng của ${roleUser.name}` : ''} onClose={() => setRoleUser(null)}>
                {roleUser && (
                    <div>
                        <p className={s.muted}>{roleUser.type === 'staff' ? 'Tài khoản nhân sự chỉ có một chức năng.' : 'Có thể gán nhiều chức năng cho một tài khoản.'}</p>
                        <div className={s.chips} style={{ margin: '14px 0' }}>
                            {roles.filter((r) => !['student', 'parent'].includes(r.name) || roleUser.type === 'web').map((r) => (
                                <button key={r.id} type="button" className={`${s.chip} ${roleDraft.includes(r.name) ? s.chipOn : ''}`} onClick={() => toggleRole(r.name)} aria-pressed={roleDraft.includes(r.name)}>
                                    {r.label}
                                </button>
                            ))}
                        </div>
                        <div className={s.dialogActions}>
                            <button className={s.btnGhost} onClick={() => setRoleUser(null)}>Hủy</button>
                            <button className={s.btnPrimary} onClick={saveRoles} disabled={savingRole || roleDraft.length === 0}>
                                {savingRole ? <span className={s.spinner} /> : <Icon name="check" size={16} />} Lưu chức năng
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal open={Boolean(secret)} title="Mật khẩu tạm thời" onClose={() => setSecret(null)}>
                {secret && (
                    <div>
                        <p>Tài khoản <b>{secret.user.username || secret.user.name}</b> đã được đặt lại. Hãy gửi mật khẩu này cho người dùng — <b>hệ thống sẽ không hiển thị lại</b>.</p>
                        <p style={{ margin: '14px 0' }}><code className={s.code} style={{ fontSize: 20, fontWeight: 800 }}>{secret.password}</code></p>
                        <div className={s.dialogActions}>
                            <button className={s.btnSoft} onClick={() => copy(secret.password)}><Icon name="clipboard" size={16} /> Sao chép</button>
                            <button className={s.btnPrimary} onClick={() => setSecret(null)}>Đã ghi lại</button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}