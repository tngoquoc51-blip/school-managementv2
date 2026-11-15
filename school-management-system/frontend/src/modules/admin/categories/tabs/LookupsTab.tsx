'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import s from '../categories.module.css';
import { catalogService, getErrorMessage, getFieldErrors, groupApi, makeItemApi } from '../catalogApi';
import { useFeedback } from '../components/Feedback';
import FormDrawer from '../components/FormDrawer';
import Icon from '../components/Icon';
import ImportDialog from '../components/ImportDialog';
import ResourceManager from '../components/ResourceManager';
import { Badge, ColorDot, EmptyState, ErrorState } from '../components/ui';
import { GROUP_ICON_KEYS, GROUP_ICON_LABELS } from '../constants';
import type { CatalogGroup, CatalogItem, FieldDef, ResourceConfig } from '../types';

const GROUP_FIELDS: FieldDef[] = [
    { name: 'code', label: 'Mã nhóm', type: 'text', required: true, lockOnEdit: true, placeholder: 'vd: loai_hoc_bong', hint: 'Chữ thường, số, gạch dưới. Không đổi được sau khi tạo.' },
    { name: 'name', label: 'Tên nhóm', type: 'text', required: true, placeholder: 'VD: Loại học bổng' },
    { name: 'icon', label: 'Biểu tượng', type: 'select', options: GROUP_ICON_KEYS.map((k) => ({ value: k, label: GROUP_ICON_LABELS[k] ?? k })) },
    { name: 'sort_order', label: 'Thứ tự hiển thị', type: 'number', min: 0, max: 9999 },
    { name: 'description', label: 'Mô tả', type: 'textarea', span: 2 },
    { name: 'color', label: 'Màu nhóm', type: 'color', span: 2 },
    { name: 'is_active', label: 'Trạng thái', type: 'switch' },
];

const GROUP_DEFAULTS = { code: '', name: '', icon: 'layers', sort_order: 0, description: '', color: '#0b6aa2', is_active: true };

export default function LookupsTab({ onMutated, refreshToken }: { onMutated: () => void; refreshToken: number }) {
    const fb = useFeedback();
    const [groups, setGroups] = useState<CatalogGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<number | null>(null);
    const [q, setQ] = useState('');
    const [itemsRefresh, setItemsRefresh] = useState(0);
    const [importOpen, setImportOpen] = useState(false);

    const [drawer, setDrawer] = useState<{ open: boolean; row: CatalogGroup | null }>({ open: false, row: null });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string[]>>({});

    const loadGroups = useCallback(async () => {
        try {
            const page = await groupApi.list({ per_page: 200, sort: 'sort_order' });
            setGroups(page.items);
            setError(null);
            setActiveId((cur) => (cur && page.items.some((g) => g.id === cur) ? cur : page.items[0]?.id ?? null));
        } catch (e) {
            setError(getErrorMessage(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadGroups(); }, [loadGroups, refreshToken]);

    const active = groups.find((g) => g.id === activeId) ?? null;
    const visible = useMemo(() => {
        const t = q.trim().toLowerCase();
        return t ? groups.filter((g) => g.name.toLowerCase().includes(t) || g.code.toLowerCase().includes(t)) : groups;
    }, [groups, q]);

    // Chỉ tạo lại cấu hình khi đổi nhóm / đổi tên nhóm — tránh tải lại bảng mỗi lần cập nhật số đếm.
    const activeKey = active ? active.id : null;
    const activeName = active ? active.name : '';
    const itemConfig = useMemo<ResourceConfig<CatalogItem> | null>(() => {
        if (activeKey === null) return null;
        return {
            singular: 'mục',
            api: makeItemApi(activeKey),
            searchPlaceholder: `Tìm trong “${activeName}”…`,
            rowTitle: (r) => r.name,
            defaultSort: { key: 'sort_order', dir: 'asc' },
            defaults: { code: '', name: '', short_name: '', value: '', description: '', color: null, sort_order: 0, is_active: true },
            columns: [
                { key: 'code', title: 'Mã', sortKey: 'code', width: '150px', render: (r) => <code className={s.code}>{r.code}</code> },
                { key: 'name', title: 'Tên', sortKey: 'name', render: (r) => (
                        <div className={s.cellMain}><ColorDot color={r.color} size={10} /><div><strong>{r.name}</strong>{r.description && <small>{r.description}</small>}</div></div>
                    ) },
                { key: 'short', title: 'Viết tắt', render: (r) => r.short_name || '—' },
                { key: 'value', title: 'Giá trị', sortKey: 'value', render: (r) => r.value ? <Badge tone="info">{r.value}</Badge> : '—' },
                { key: 'sort', title: 'Thứ tự', sortKey: 'sort_order', align: 'center', width: '90px', render: (r) => r.sort_order },
            ],
            fields: [
                { name: 'code', label: 'Mã', type: 'text', required: true, uppercase: true, lockOnEdit: true, placeholder: 'VD: DANG_HOC', hint: 'Chữ HOA, số, _ - . — duy nhất trong nhóm.' },
                { name: 'name', label: 'Tên hiển thị', type: 'text', required: true },
                { name: 'short_name', label: 'Tên viết tắt', type: 'text' },
                { name: 'value', label: 'Giá trị đi kèm', type: 'text', hint: 'Tùy chọn: hệ số, số khối, ngưỡng…' },
                { name: 'description', label: 'Mô tả', type: 'textarea', span: 2 },
                { name: 'color', label: 'Màu', type: 'color', span: 2 },
                { name: 'sort_order', label: 'Thứ tự hiển thị', type: 'number', min: 0, max: 9999 },
                { name: 'is_active', label: 'Trạng thái', type: 'switch' },
            ],
        };
    }, [activeKey, activeName]);

    const mutated = useCallback(() => { void loadGroups(); onMutated(); }, [loadGroups, onMutated]);

    // ---- nhóm: thêm / sửa / xóa ----
    const initial = useMemo(() => {
        const r = drawer.row;
        if (!r) return { ...GROUP_DEFAULTS, sort_order: groups.length + 1 };
        return { code: r.code, name: r.name, icon: r.icon ?? 'layers', sort_order: r.sort_order, description: r.description ?? '', color: r.color, is_active: r.is_active };
    }, [drawer.row, groups.length]);

    const saveGroup = async (body: Record<string, unknown>) => {
        setSaving(true);
        setErrors({});
        try {
            if (drawer.row) {
                await groupApi.update(drawer.row.id, body);
                fb.success('Đã lưu nhóm danh mục', String(body.name));
            } else {
                const created = await groupApi.create(body);
                setActiveId(created.id);
                fb.success('Đã tạo nhóm danh mục', `Bây giờ bạn có thể thêm các mục vào “${String(body.name)}”.`);
            }
            setDrawer({ open: false, row: null });
            mutated();
        } catch (e) {
            const fe = getFieldErrors(e);
            if (Object.keys(fe).length) { setErrors(fe); fb.warning('Dữ liệu chưa hợp lệ', 'Vui lòng sửa các trường được đánh dấu đỏ.'); }
            else fb.error('Không lưu được nhóm', getErrorMessage(e));
        } finally {
            setSaving(false);
        }
    };

    const deleteGroup = async (g: CatalogGroup) => {
        const count = g.items_count ?? 0;
        const ok = await fb.confirm({
            title: 'Xóa nhóm danh mục?',
            message: `Nhóm “${g.name}” sẽ bị xóa${count ? ` cùng ${count} mục bên trong` : ''}.`,
            details: ['Có thể khôi phục toàn bộ nhóm (kèm các mục) từ tab Nhật ký thay đổi.'],
            confirmLabel: 'Xóa nhóm',
            tone: 'danger',
        });
        if (!ok) return;
        try {
            const { audit_id } = await groupApi.remove(g.id, count > 0);
            fb.success('Đã xóa nhóm danh mục', g.name, {
                label: 'Hoàn tác',
                onClick: async () => {
                    try { await catalogService.restore(audit_id); fb.success('Đã khôi phục nhóm', g.name); mutated(); }
                    catch (e) { fb.error('Không khôi phục được', getErrorMessage(e)); }
                },
            });
            mutated();
        } catch (e) {
            fb.error('Không xóa được nhóm', getErrorMessage(e));
        }
    };

    if (loading) return <div className={s.panel}><div className={s.centerPad}><span className={s.spinner} /> Đang tải danh mục…</div></div>;
    if (error) return <div className={s.panel}><ErrorState message={error} onRetry={() => { setLoading(true); void loadGroups(); }} /></div>;

    return (
        <div className={s.lookups}>
            <aside className={s.groupPane}>
                <div className={s.groupPaneHead}>
                    <label className={s.search}>
                        <Icon name="search" size={15} />
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm nhóm…" aria-label="Tìm nhóm danh mục" />
                    </label>
                    <button className={s.btnPrimary} onClick={() => { setErrors({}); setDrawer({ open: true, row: null }); }} title="Thêm nhóm danh mục">
                        <Icon name="plus" size={16} /> Nhóm
                    </button>
                </div>

                <ul className={s.groupList}>
                    {visible.map((g) => (
                        <li key={g.id}>
                            <button className={`${s.groupItem} ${g.id === activeId ? s.groupItemOn : ''} ${!g.is_active ? s.rowMuted : ''}`} onClick={() => setActiveId(g.id)}>
                <span className={s.groupIcon} style={{ background: `${g.color ?? '#1b9fde'}1a`, color: g.color ?? '#1b9fde' }}>
                  <Icon name={g.icon ?? 'layers'} size={17} />
                </span>
                                <span className={s.groupText}>
                  <strong>{g.name}</strong>
                  <small>{g.items_count ?? 0} mục{g.is_system ? ' · hệ thống' : ''}</small>
                </span>
                                {g.is_system && <Icon name="lock" size={13} className={s.muted} />}
                            </button>
                        </li>
                    ))}
                    {visible.length === 0 && <li className={s.muted} style={{ padding: 16 }}>Không có nhóm phù hợp.</li>}
                </ul>
            </aside>

            <div className={s.itemsPane}>
                {active && itemConfig ? (
                    <>
                        <div className={s.groupHeader}>
              <span className={s.groupIconLg} style={{ background: `${active.color ?? '#1b9fde'}1a`, color: active.color ?? '#1b9fde' }}>
                <Icon name={active.icon ?? 'layers'} size={22} />
              </span>
                            <div className={s.groupHeaderText}>
                                <h3>{active.name} {active.is_system && <Badge tone="violet">Hệ thống</Badge>} {!active.is_active && <Badge tone="neutral">Ngừng dùng</Badge>}</h3>
                                <p>{active.description || 'Chưa có mô tả.'} <span className={s.muted}>· mã <code className={s.code}>{active.code}</code></span></p>
                            </div>
                            <button className={s.btnSoft} onClick={() => { setErrors({}); setDrawer({ open: true, row: active }); }}><Icon name="edit" size={15} /> Sửa nhóm</button>
                            <button className={s.btnDangerSoft} onClick={() => deleteGroup(active)} disabled={active.is_system} title={active.is_system ? 'Nhóm hệ thống không thể xóa' : 'Xóa nhóm'}>
                                <Icon name={active.is_system ? 'lock' : 'trash'} size={15} /> Xóa nhóm
                            </button>
                        </div>

                        <ResourceManager<CatalogItem>
                            key={active.id}
                            config={itemConfig}
                            refreshToken={itemsRefresh}
                            onMutated={mutated}
                            toolbarExtra={<button className={s.btnSoft} onClick={() => setImportOpen(true)}><Icon name="upload" size={16} /> Nhập CSV</button>}
                        />

                        <ImportDialog
                            open={importOpen}
                            groupId={active.id}
                            groupName={active.name}
                            onClose={() => setImportOpen(false)}
                            onDone={() => { setItemsRefresh((n) => n + 1); mutated(); }}
                        />
                    </>
                ) : (
                    <div className={s.panel}><EmptyState icon="layers" title="Chưa có nhóm danh mục nào" hint="Tạo nhóm đầu tiên (vd. Loại học bổng) rồi thêm các mục vào." action={<button className={s.btnPrimary} onClick={() => setDrawer({ open: true, row: null })}><Icon name="plus" size={16} /> Tạo nhóm</button>} /></div>
                )}
            </div>

            <FormDrawer<CatalogGroup>
                open={drawer.open}
                singular="nhóm danh mục"
                fields={GROUP_FIELDS}
                row={drawer.row}
                initial={initial}
                saving={saving}
                errors={errors}
                onClose={() => setDrawer((d) => ({ ...d, open: false }))}
                onSubmit={saveGroup}
            />
        </div>
    );
}