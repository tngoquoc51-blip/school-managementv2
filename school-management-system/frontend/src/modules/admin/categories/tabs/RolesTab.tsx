'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import s from '../categories.module.css';
import { catalogService, getErrorMessage } from '../catalogApi';
import { useFeedback } from '../components/Feedback';
import Icon from '../components/Icon';
import { Badge, EmptyState, ErrorState } from '../components/ui';
import type { RoleRow } from '../types';

/** Nhóm quyền theo tiền tố trước dấu chấm / gạch: "student.view" → "student". */
const groupOf = (p: string) => p.split(/[.:_-]/)[0] || 'khac';

export default function RolesTab({ onMutated }: { onMutated: () => void }) {
    const fb = useFeedback();
    const [roles, setRoles] = useState<RoleRow[]>([]);
    const [allPerms, setAllPerms] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<number | null>(null);
    const [draft, setDraft] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const r = await catalogService.userRoles();
            setRoles(r.roles);
            setAllPerms(r.permissions);
            setActiveId((cur) => cur ?? r.roles[0]?.id ?? null);
        } catch (e) {
            setError(getErrorMessage(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const active = roles.find((r) => r.id === activeId) ?? null;
    useEffect(() => { setDraft(active?.permissions ?? []); }, [active]);

    const grouped = useMemo(() => {
        const m = new Map<string, string[]>();
        allPerms.forEach((p) => m.set(groupOf(p), [...(m.get(groupOf(p)) ?? []), p]));
        return Array.from(m.entries());
    }, [allPerms]);

    const dirty = active ? [...draft].sort().join('|') !== [...active.permissions].sort().join('|') : false;
    const toggle = (p: string) => setDraft((d) => (d.includes(p) ? d.filter((x) => x !== p) : [...d, p]));
    const toggleGroup = (list: string[]) => setDraft((d) => (list.every((p) => d.includes(p)) ? d.filter((p) => !list.includes(p)) : Array.from(new Set([...d, ...list]))));

    const save = async () => {
        if (!active) return;
        setSaving(true);
        try {
            await catalogService.setRolePermissions(active.id, draft);
            fb.success('Đã lưu quyền', active.label);
            onMutated();
            await load();
        } catch (e) {
            fb.error('Không lưu được', getErrorMessage(e));
        } finally {
            setSaving(false);
        }
    };

    if (error) return <section className={s.panel}><ErrorState message={error} onRetry={() => void load()} /></section>;

    return (
        <section className={s.lookups}>
            <aside className={s.groupPane}>
                <div className={s.groupPaneHead}><strong>Chức năng ({roles.length})</strong></div>
                <ul className={s.groupList}>
                    {loading && roles.length === 0 && [0, 1, 2, 3, 4].map((i) => <li key={i} className={s.skelRow} />)}
                    {roles.map((r) => (
                        <li key={r.id}>
                            <button className={`${s.groupItem} ${r.id === activeId ? s.groupItemOn : ''}`} onClick={() => setActiveId(r.id)}>
                                <span className={s.groupIcon}><Icon name={r.locked ? 'shield' : 'users'} size={16} /></span>
                                <span className={s.groupText}><strong>{r.label}</strong><small>{r.users_count.toLocaleString('vi-VN')} người · {r.permissions.length} quyền</small></span>
                            </button>
                        </li>
                    ))}
                </ul>
            </aside>

            <div className={s.itemsPane}>
                {!active ? <EmptyState icon="shield" title="Chọn một chức năng" hint="Danh sách quyền sẽ hiện ở đây." /> : (
                    <>
                        <div className={s.groupHeader}>
                            <div className={s.groupHeaderText}>
                                <h3>{active.label} <Badge tone="neutral">{active.name}</Badge></h3>
                                <p className={s.muted}>{active.users_count.toLocaleString('vi-VN')} người dùng đang giữ chức năng này.</p>
                            </div>
                            {!active.locked && (
                                <button className={s.btnPrimary} onClick={save} disabled={!dirty || saving}>
                                    {saving ? <span className={s.spinner} /> : <Icon name="check" size={16} />} Lưu quyền
                                </button>
                            )}
                        </div>

                        {active.locked && <p className={s.inlineWarn}>Quản trị tối cao luôn có toàn quyền nên không thể chỉnh sửa.</p>}
                        {!active.locked && allPerms.length === 0 && <EmptyState icon="shield" title="Chưa có quyền chi tiết nào" hint="Bảng permissions đang trống." />}

                        {grouped.map(([g, list]) => {
                            const on = list.filter((p) => draft.includes(p)).length;
                            return (
                                <div key={g} style={{ marginTop: 18 }}>
                                    <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800, textTransform: 'capitalize' }}>
                                        <input type="checkbox" disabled={active.locked} checked={on === list.length} ref={(el) => { if (el) el.indeterminate = on > 0 && on < list.length; }} onChange={() => toggleGroup(list)} />
                                        {g} <span className={s.muted}>({on}/{list.length})</span>
                                    </label>
                                    <div className={s.chips} style={{ marginTop: 8 }}>
                                        {list.map((p) => (
                                            <button key={p} type="button" disabled={active.locked} className={`${s.chip} ${(active.locked || draft.includes(p)) ? s.chipOn : ''}`} onClick={() => toggle(p)} aria-pressed={draft.includes(p)}>{p}</button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </>
                )}
            </div>
        </section>
    );
}