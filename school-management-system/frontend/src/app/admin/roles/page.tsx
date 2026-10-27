'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adm, AdmError } from '@/lib/adminApi';
import './roles.css';

type RoleRow = {
    id: number;
    name: string;
    label: string;
    users_count: number;
    permissions_count: number;
    permissions: string[];
    created_at?: string;
};

type PermItem = { id: number; name: string; label: string };
type PermGroup = { group: string; items: PermItem[] };

export default function AdminRolesPage() {
    const [roles, setRoles] = useState<RoleRow[]>([]);
    const [tree, setTree] = useState<PermGroup[]>([]);
    const [stats, setStats] = useState({ roles: 0, permissions: 0, assigned: 0 });
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [selected, setSelected] = useState<RoleRow | null>(null);
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [tab, setTab] = useState<'perms' | 'users'>('perms');
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [toast, setToast] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await adm<{
                roles: RoleRow[];
                permission_tree: PermGroup[];
                stats: { roles: number; permissions: number; assigned: number };
            }>('roles');
            const d = res.data;
            setRoles(d.roles || []);
            setTree(d.permission_tree || []);
            setStats(d.stats || { roles: 0, permissions: 0, assigned: 0 });
            if (!selected && d.roles?.length) {
                selectRole(d.roles[0]);
            } else if (selected) {
                const fresh = d.roles.find((r) => r.id === selected.id);
                if (fresh) selectRole(fresh);
            }
        } catch (e: any) {
            setErr(e instanceof AdmError ? e.message : 'Không tải được danh sách vai trò');
        } finally {
            setLoading(false);
        }
    }, [selected?.id]);

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectRole = async (r: RoleRow) => {
        setSelected(r);
        setChecked(new Set(r.permissions || []));
        setTab('perms');
        try {
            const res = await adm<{ users: any[] }>(`roles/${r.id}`);
            setUsers(res.data?.users || []);
        } catch {
            setUsers([]);
        }
    };

    const toggle = (name: string) => {
        if (selected?.name === 'super_admin') return;
        setChecked((prev) => {
            const n = new Set(prev);
            if (n.has(name)) n.delete(name);
            else n.add(name);
            return n;
        });
    };

    const toggleGroup = (items: PermItem[], on: boolean) => {
        if (selected?.name === 'super_admin') return;
        setChecked((prev) => {
            const n = new Set(prev);
            items.forEach((i) => (on ? n.add(i.name) : n.delete(i.name)));
            return n;
        });
    };

    const savePerms = async () => {
        if (!selected || selected.name === 'super_admin') return;
        setSaving(true);
        try {
            await adm(`roles/${selected.id}/permissions`, {
                method: 'PUT',
                body: { permissions: Array.from(checked) },
            });
            setToast('Đã lưu phân quyền');
            await load();
        } catch (e: any) {
            setErr(e?.message || 'Lưu thất bại');
        } finally {
            setSaving(false);
            setTimeout(() => setToast(''), 2500);
        }
    };

    const createRole = async () => {
        const name = newName.trim().toLowerCase().replace(/\s+/g, '_');
        if (!/^[a-z0-9_]+$/.test(name)) {
            setErr('Mã vai trò chỉ gồm a-z, 0-9, gạch dưới');
            return;
        }
        setSaving(true);
        try {
            await adm('roles', { method: 'POST', body: { name, permissions: [] } });
            setShowCreate(false);
            setNewName('');
            setToast('Đã tạo vai trò');
            await load();
        } catch (e: any) {
            setErr(e?.message || 'Tạo thất bại');
        } finally {
            setSaving(false);
            setTimeout(() => setToast(''), 2500);
        }
    };

    const deleteRole = async () => {
        if (!selected) return;
        if (!confirm(`Xóa vai trò «${selected.label}»?`)) return;
        try {
            await adm(`roles/${selected.id}`, { method: 'DELETE' });
            setSelected(null);
            setToast('Đã xóa');
            await load();
        } catch (e: any) {
            setErr(e?.message || 'Không xóa được');
        }
    };

    const dirty = useMemo(() => {
        if (!selected) return false;
        const a = new Set(selected.permissions || []);
        if (a.size !== checked.size) return true;
        for (const x of checked) if (!a.has(x)) return true;
        return false;
    }, [selected, checked]);

    return (
        <div className="arl-page">
            <header className="arl-head">
                <div>
                    <h1>Vai trò &amp; Phân quyền</h1>
                    <p>Gán quyền theo module cho từng vai trò trong hệ thống THPT</p>
                </div>
                <div className="arl-head-actions">
                    <button type="button" className="arl-btn ghost" onClick={() => load()}>
                        Làm mới
                    </button>
                    <button type="button" className="arl-btn primary" onClick={() => setShowCreate(true)}>
                        + Tạo vai trò
                    </button>
                </div>
            </header>

            <div className="arl-stats">
                <div className="arl-stat">
                    <span>Vai trò</span>
                    <b>{stats.roles}</b>
                </div>
                <div className="arl-stat">
                    <span>Quyền hệ thống</span>
                    <b>{stats.permissions}</b>
                </div>
                <div className="arl-stat">
                    <span>Lượt gán vai trò</span>
                    <b>{stats.assigned}</b>
                </div>
            </div>

            {err && (
                <div className="arl-alert">
                    {err}
                    <button type="button" onClick={() => setErr('')}>
                        Đóng
                    </button>
                </div>
            )}
            {toast && <div className="arl-toast">{toast}</div>}

            <div className="arl-body">
                <aside className="arl-list">
                    <div className="arl-list-title">Danh sách vai trò</div>
                    {loading && <p className="arl-muted">Đang tải…</p>}
                    {!loading &&
                        roles.map((r) => (
                            <button
                                key={r.id}
                                type="button"
                                className={`arl-role ${selected?.id === r.id ? 'on' : ''}`}
                                onClick={() => selectRole(r)}
                            >
                                <div className="arl-role-top">
                                    <strong>{r.label}</strong>
                                    <code>{r.name}</code>
                                </div>
                                <div className="arl-role-meta">
                                    <span>{r.users_count} tài khoản</span>
                                    <span>{r.permissions_count} quyền</span>
                                </div>
                            </button>
                        ))}
                </aside>

                <section className="arl-detail">
                    {!selected ? (
                        <div className="arl-empty">Chọn một vai trò bên trái để xem và chỉnh quyền.</div>
                    ) : (
                        <>
                            <div className="arl-detail-head">
                                <div>
                                    <h2>{selected.label}</h2>
                                    <p>
                                        Mã: <code>{selected.name}</code> · {selected.users_count} người dùng
                                    </p>
                                </div>
                                <div className="arl-detail-actions">
                                    {selected.name !== 'super_admin' && (
                                        <>
                                            <button
                                                type="button"
                                                className="arl-btn primary"
                                                disabled={!dirty || saving}
                                                onClick={savePerms}
                                            >
                                                {saving ? 'Đang lưu…' : 'Lưu phân quyền'}
                                            </button>
                                            <button type="button" className="arl-btn danger ghost" onClick={deleteRole}>
                                                Xóa vai trò
                                            </button>
                                        </>
                                    )}
                                    {selected.name === 'super_admin' && (
                                        <span className="arl-badge">Toàn quyền · không chỉnh từ UI</span>
                                    )}
                                </div>
                            </div>

                            <div className="arl-tabs">
                                <button
                                    type="button"
                                    className={tab === 'perms' ? 'on' : ''}
                                    onClick={() => setTab('perms')}
                                >
                                    Ma trận quyền
                                </button>
                                <button
                                    type="button"
                                    className={tab === 'users' ? 'on' : ''}
                                    onClick={() => setTab('users')}
                                >
                                    Người dùng ({users.length})
                                </button>
                            </div>

                            {tab === 'perms' && (
                                <div className="arl-matrix">
                                    {tree.map((g) => {
                                        const allOn = g.items.every((i) => checked.has(i.name));
                                        return (
                                            <div key={g.group} className="arl-group">
                                                <div className="arl-group-head">
                                                    <h3>{g.group}</h3>
                                                    {selected.name !== 'super_admin' && (
                                                        <button
                                                            type="button"
                                                            className="arl-link"
                                                            onClick={() => toggleGroup(g.items, !allOn)}
                                                        >
                                                            {allOn ? 'Bỏ chọn nhóm' : 'Chọn cả nhóm'}
                                                        </button>
                                                    )}
                                                </div>
                                                <ul>
                                                    {g.items.map((i) => (
                                                        <li key={i.name}>
                                                            <label>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked.has(i.name)}
                                                                    disabled={selected.name === 'super_admin'}
                                                                    onChange={() => toggle(i.name)}
                                                                />
                                                                <span>{i.label}</span>
                                                                <code>{i.name}</code>
                                                            </label>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {tab === 'users' && (
                                <div className="arl-users">
                                    {users.length === 0 ? (
                                        <p className="arl-muted">Chưa có tài khoản nào gắn vai trò này.</p>
                                    ) : (
                                        <table>
                                            <thead>
                                            <tr>
                                                <th>Họ tên</th>
                                                <th>Tên đăng nhập</th>
                                                <th>Email</th>
                                                <th>Trạng thái</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {users.map((u) => (
                                                <tr key={u.id}>
                                                    <td>{u.name}</td>
                                                    <td>
                                                        <code>{u.username || '—'}</code>
                                                    </td>
                                                    <td>{u.email}</td>
                                                    <td>
                                                        <span className={`arl-st ${u.status}`}>{u.status}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </section>
            </div>

            {showCreate && (
                <div className="arl-modal-bg" onClick={() => setShowCreate(false)}>
                    <div className="arl-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Tạo vai trò mới</h3>
                        <p className="arl-muted">Mã viết thường, không dấu, dùng `_` (vd: librarian)</p>
                        <input
                            className="arl-input"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="ten_vai_tro"
                            autoFocus
                        />
                        <div className="arl-modal-foot">
                            <button type="button" className="arl-btn ghost" onClick={() => setShowCreate(false)}>
                                Hủy
                            </button>
                            <button type="button" className="arl-btn primary" disabled={saving} onClick={createRole}>
                                Tạo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}