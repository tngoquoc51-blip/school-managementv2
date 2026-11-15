'use client';

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import s from '../categories.module.css';
import { catalogService, getErrorMessage, getFieldErrors } from '../catalogApi';
import { STATUS_FILTER } from '../constants';
import { useDebounce } from '../hooks/useDebounce';
import { useResourceList } from '../hooks/useResourceList';
import type { BaseRow, BulkResult, ListParams, ResourceConfig } from '../types';
import { useFeedback } from './Feedback';
import FormDrawer from './FormDrawer';
import Icon from './Icon';
import { EmptyState, ErrorState, Pagination, SkeletonRows, Switch } from './ui';

interface Props<T extends BaseRow> {
    config: ResourceConfig<T>;
    /** Nút phụ trên thanh công cụ (vd. Nhập file). */
    toolbarExtra?: ReactNode;
    /** Tăng giá trị này để buộc tải lại từ bên ngoài. */
    refreshToken?: number;
    /** Gọi sau mỗi thay đổi dữ liệu (thêm/sửa/xóa) để tab cha cập nhật số liệu. */
    onMutated?: () => void;
    /** Tiêu đề phụ bên trái thanh công cụ. */
    heading?: ReactNode;
}

/**
 * Bảng quản trị dùng chung: tìm kiếm, lọc, sắp xếp, phân trang, chọn nhiều + thao tác hàng loạt,
 * bật/tắt nhanh, thêm/sửa bằng ngăn kéo, xóa có xác nhận và hoàn tác, xuất CSV.
 */
export default function ResourceManager<T extends BaseRow>({ config, toolbarExtra, refreshToken = 0, onMutated, heading }: Props<T>) {
    const fb = useFeedback();
    const { api, columns, fields, filters = [], defaults } = config;

    const [searchInput, setSearchInput] = useState('');
    const search = useDebounce(searchInput, 350);
    const [status, setStatus] = useState('');
    const [filterValues, setFilterValues] = useState<Record<string, string>>({});
    const [sort, setSort] = useState(config.defaultSort ?? { key: 'sort_order', dir: 'asc' as const });
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(15);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [localRefresh, setLocalRefresh] = useState(0);
    const [exporting, setExporting] = useState(false);

    const [drawer, setDrawer] = useState<{ open: boolean; row: T | null }>({ open: false, row: null });
    const [saving, setSaving] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

    const searchRef = useRef<HTMLInputElement>(null);

    const params: ListParams = useMemo(
        () => ({ page, per_page: perPage, search, status, sort: sort.key, dir: sort.dir, ...filterValues }),
        [page, perPage, search, status, sort, filterValues]
    );

    const { items, meta, loading, error, reload, setItems } = useResourceList<T>(api, params, refreshToken + localRefresh);

    // Đổi bộ lọc → về trang 1, bỏ chọn
    useEffect(() => {
        setPage(1);
        setSelected(new Set());
    }, [search, status, filterValues, perPage]);

    // Phím tắt: "/" để tìm kiếm
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
                e.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const refresh = useCallback(() => {
        setLocalRefresh((n) => n + 1);
        onMutated?.();
    }, [onMutated]);

    // ---------- sắp xếp / chọn ----------
    const toggleSort = (key: string) =>
        setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

    const allOnPage = items.length > 0 && items.every((r) => selected.has(r.id));
    const toggleAll = () =>
        setSelected((cur) => {
            const next = new Set(cur);
            if (allOnPage) items.forEach((r) => next.delete(r.id));
            else items.forEach((r) => next.add(r.id));
            return next;
        });
    const toggleOne = (id: number) =>
        setSelected((cur) => {
            const next = new Set(cur);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    // ---------- thêm / sửa ----------
    const initialValues = useMemo(() => {
        const row = drawer.row;
        if (!row) return { ...defaults };
        const out: Record<string, unknown> = {};
        for (const f of fields) out[f.name] = (row as unknown as Record<string, unknown>)[f.name] ?? (f.type === 'multicheck' ? [] : '');
        return out;
    }, [drawer.row, defaults, fields]);

    const openCreate = () => {
        setFieldErrors({});
        setDrawer({ open: true, row: null });
    };
    const openEdit = (row: T) => {
        setFieldErrors({});
        setDrawer({ open: true, row });
    };
    const closeDrawer = useCallback(() => setDrawer((d) => ({ ...d, open: false })), []);

    const save = async (body: Record<string, unknown>) => {
        setSaving(true);
        setFieldErrors({});
        try {
            if (drawer.row) {
                await api.update(drawer.row.id, body);
                fb.success('Đã lưu thay đổi', `Cập nhật ${config.singular} “${String(body.name ?? drawer.row.name)}” thành công.`);
            } else {
                await api.create(body);
                fb.success(`Đã thêm ${config.singular}`, `“${String(body.name)}” đã được tạo.`);
            }
            closeDrawer();
            refresh();
        } catch (e) {
            const fe = getFieldErrors(e);
            if (Object.keys(fe).length) {
                setFieldErrors(fe);
                fb.warning('Dữ liệu chưa hợp lệ', 'Vui lòng sửa các trường được đánh dấu đỏ.');
            } else {
                fb.error('Không lưu được', getErrorMessage(e));
            }
        } finally {
            setSaving(false);
        }
    };

    // ---------- bật / tắt ----------
    const toggleActive = async (row: T) => {
        const next = !row.is_active;
        setItems((list) => list.map((r) => (r.id === row.id ? { ...r, is_active: next } : r))); // cập nhật ngay
        try {
            await api.toggle(row.id);
            fb.info(next ? 'Đã bật hoạt động' : 'Đã ngừng hoạt động', config.rowTitle(row));
            onMutated?.();
        } catch (e) {
            setItems((list) => list.map((r) => (r.id === row.id ? { ...r, is_active: !next } : r)));
            fb.error('Không đổi được trạng thái', getErrorMessage(e));
        }
    };

    // ---------- xóa ----------
    const removeOne = async (row: T) => {
        const note = config.deleteNote?.(row);
        const ok = await fb.confirm({
            title: `Xóa ${config.singular}?`,
            message: `“${config.rowTitle(row)}” sẽ bị xóa khỏi danh mục.`,
            details: note ? [note, 'Bạn có thể hoàn tác ngay sau khi xóa hoặc khôi phục từ tab Nhật ký thay đổi.'] : ['Bạn có thể hoàn tác ngay sau khi xóa hoặc khôi phục từ tab Nhật ký thay đổi.'],
            confirmLabel: 'Xóa',
            tone: 'danger',
        });
        if (!ok) return;

        try {
            const { audit_id } = await api.remove(row.id);
            setSelected((cur) => { const n = new Set(cur); n.delete(row.id); return n; });
            fb.success(`Đã xóa ${config.singular}`, config.rowTitle(row), {
                label: 'Hoàn tác',
                onClick: async () => {
                    try {
                        await catalogService.restore(audit_id);
                        fb.success('Đã khôi phục', config.rowTitle(row));
                        refresh();
                    } catch (e) {
                        fb.error('Không khôi phục được', getErrorMessage(e));
                    }
                },
            });
            refresh();
        } catch (e) {
            fb.error('Không xóa được', getErrorMessage(e));
        }
    };

    // ---------- hàng loạt ----------
    const runBulk = async (action: BulkResult['action']) => {
        const ids = Array.from(selected);
        if (action === 'delete') {
            const ok = await fb.confirm({
                title: `Xóa ${ids.length} ${config.singular}?`,
                message: 'Các mục hệ thống hoặc đang được dùng sẽ tự động bị bỏ qua.',
                details: ['Từng mục đã xóa có thể khôi phục từ tab Nhật ký thay đổi.'],
                confirmLabel: `Xóa ${ids.length} mục`,
                tone: 'danger',
            });
            if (!ok) return;
        }
        try {
            const res = await api.bulk(action, ids);
            const verb = { activate: 'bật hoạt động', deactivate: 'ngừng hoạt động', delete: 'xóa' }[action];
            if (res.skipped.length) {
                fb.warning(`Đã ${verb} ${res.processed}/${ids.length} mục`, res.skipped.slice(0, 2).map((x) => x.reason).join(' • ') + (res.skipped.length > 2 ? ` … (+${res.skipped.length - 2})` : ''));
            } else {
                fb.success(`Đã ${verb} ${res.processed} mục`);
            }
            setSelected(new Set());
            refresh();
        } catch (e) {
            fb.error('Thao tác hàng loạt thất bại', getErrorMessage(e));
        }
    };

    const doExport = async () => {
        setExporting(true);
        try {
            await api.exportCsv(params);
            fb.success('Đã xuất file CSV', 'Mở bằng Excel — tiếng Việt hiển thị đúng.');
        } catch (e) {
            fb.error('Không xuất được file', getErrorMessage(e));
        } finally {
            setExporting(false);
        }
    };

    const hasFilter = Boolean(searchInput || status || Object.values(filterValues).some(Boolean));
    const clearFilters = () => {
        setSearchInput('');
        setStatus('');
        setFilterValues({});
    };

    return (
        <section className={s.panel}>
            <div className={s.toolbar}>
                {heading && <div className={s.toolbarHeading}>{heading}</div>}

                <label className={s.search}>
                    <Icon name="search" size={16} />
                    <input ref={searchRef} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder={config.searchPlaceholder} aria-label="Tìm kiếm" />
                    {searchInput ? <button type="button" onClick={() => setSearchInput('')} aria-label="Xóa tìm kiếm"><Icon name="x" size={14} /></button> : <kbd>/</kbd>}
                </label>

                {filters.map((f) => (
                    <select key={f.key} className={s.select} value={filterValues[f.key] ?? ''} aria-label={f.label}
                            onChange={(e) => setFilterValues((cur) => ({ ...cur, [f.key]: e.target.value }))}>
                        <option value="">{f.label}: tất cả</option>
                        {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                ))}
                <select className={s.select} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Trạng thái">
                    <option value="">Trạng thái: tất cả</option>
                    {STATUS_FILTER.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {hasFilter && <button className={s.linkBtn} onClick={clearFilters}>Xóa bộ lọc</button>}

                <div className={s.toolbarSpacer} />

                {toolbarExtra}
                <button className={s.btnSoft} onClick={doExport} disabled={exporting}>
                    {exporting ? <span className={s.spinner} /> : <Icon name="download" size={16} />} Xuất CSV
                </button>
                <button className={s.btnPrimary} onClick={openCreate}><Icon name="plus" size={16} /> Thêm {config.singular}</button>
            </div>

            {selected.size > 0 && (
                <div className={s.bulkBar} role="region" aria-label="Thao tác hàng loạt">
                    <b>{selected.size}</b> mục đã chọn
                    <span className={s.toolbarSpacer} />
                    <button className={s.btnSoft} onClick={() => runBulk('activate')}><Icon name="power" size={15} /> Bật</button>
                    <button className={s.btnSoft} onClick={() => runBulk('deactivate')}><Icon name="power" size={15} /> Ngừng</button>
                    <button className={s.btnDangerSoft} onClick={() => runBulk('delete')}><Icon name="trash" size={15} /> Xóa</button>
                    <button className={s.linkBtn} onClick={() => setSelected(new Set())}>Bỏ chọn</button>
                </div>
            )}

            <div className={s.tableWrap}>
                <table className={s.table}>
                    <thead>
                    <tr>
                        <th className={s.colCheck}>
                            <input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Chọn tất cả trên trang" disabled={loading || items.length === 0} />
                        </th>
                        {columns.map((c) => {
                            const active = c.sortKey && sort.key === c.sortKey;
                            return (
                                <th key={c.key} style={{ width: c.width, textAlign: c.align }} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                                    {c.sortKey ? (
                                        <button className={`${s.thSort} ${active ? s.thSortOn : ''}`} onClick={() => toggleSort(c.sortKey!)}>
                                            {c.title}
                                            <Icon name={active ? (sort.dir === 'asc' ? 'chevronUp' : 'chevronDown') : 'sort'} size={13} />
                                        </button>
                                    ) : c.title}
                                </th>
                            );
                        })}
                        <th className={s.colStatus}>Hoạt động</th>
                        <th className={s.colActions} />
                    </tr>
                    </thead>
                    <tbody>
                    {loading && items.length === 0 && <SkeletonRows cols={columns.length + 3} />}
                    {!loading && !error && items.length === 0 && (
                        <tr><td colSpan={columns.length + 3}>
                            <EmptyState
                                icon={hasFilter ? 'filter' : 'layers'}
                                title={hasFilter ? 'Không có kết quả phù hợp' : `Chưa có ${config.singular} nào`}
                                hint={hasFilter ? 'Thử đổi từ khóa hoặc bỏ bớt bộ lọc.' : `Bấm “Thêm ${config.singular}” để bắt đầu.`}
                                action={hasFilter ? <button className={s.btnSoft} onClick={clearFilters}>Xóa bộ lọc</button> : <button className={s.btnPrimary} onClick={openCreate}><Icon name="plus" size={16} /> Thêm {config.singular}</button>}
                            />
                        </td></tr>
                    )}
                    {error && (
                        <tr><td colSpan={columns.length + 3}><ErrorState message={error} onRetry={reload} /></td></tr>
                    )}
                    {!error && items.map((row) => (
                        <tr key={row.id} className={`${selected.has(row.id) ? s.rowSelected : ''} ${!row.is_active ? s.rowMuted : ''} ${loading ? s.rowLoading : ''}`}>
                            <td className={s.colCheck}>
                                <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} aria-label={`Chọn ${config.rowTitle(row)}`} />
                            </td>
                            {columns.map((c) => <td key={c.key} style={{ textAlign: c.align }}>{c.render(row)}</td>)}
                            <td className={s.colStatus}><Switch checked={row.is_active} onChange={() => toggleActive(row)} label={`Bật/tắt ${config.rowTitle(row)}`} /></td>
                            <td className={s.colActions}>
                                <button className={s.iconBtn} onClick={() => openEdit(row)} title="Sửa" aria-label="Sửa"><Icon name="edit" size={16} /></button>
                                <button className={`${s.iconBtn} ${s.iconBtnDanger}`} onClick={() => removeOne(row)} disabled={row.is_system}
                                        title={row.is_system ? 'Mục hệ thống — không thể xóa' : 'Xóa'} aria-label="Xóa">
                                    <Icon name={row.is_system ? 'lock' : 'trash'} size={16} />
                                </button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {!error && <Pagination meta={meta} onPage={setPage} onPerPage={setPerPage} />}

            <FormDrawer<T>
                open={drawer.open}
                singular={config.singular}
                fields={fields}
                row={drawer.row}
                initial={initialValues}
                saving={saving}
                errors={fieldErrors}
                onClose={closeDrawer}
                onSubmit={save}
            />
        </section>
    );
}