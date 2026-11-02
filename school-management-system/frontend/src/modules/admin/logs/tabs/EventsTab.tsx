'use client';

import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../Icon';
import { logsApi } from '../logsApi';
import { useToast } from '../ToastProvider';
import { Chip, ConfirmDialog, Empty, ErrorState, LevelBadge, Modal, Pager, Skeleton } from '../ui';
import type { EventFilters, LogEvent, Meta, Paged, SavedView } from '../types';
import { ACTOR_TYPE, CATEGORY_LABEL, DEFAULT_FILTERS, LEVELS, RANGES, actionLabel, activeFilterCount, actorLabel, describeFilters, fmtDate, fmtMs, fmtTime, timeAgo } from '../utils';

interface Props {
    meta: Meta;
    filters: EventFilters;
    setFilters: Dispatch<SetStateAction<EventFilters>>;
    refreshKey: number;
    onOpenEvent: (id: number) => void;
    onIds: (ids: number[]) => void;
    pinPatch: { id: number; pinned: boolean } | null;
}

export default function EventsTab({ meta, filters, setFilters, refreshKey, onOpenEvent, onIds, pinPatch }: Props) {
    const toast = useToast();
    const [data, setData] = useState<Paged<LogEvent> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState(filters.q);
    const [advanced, setAdvanced] = useState(false);
    const [live, setLive] = useState(false);
    const [fresh, setFresh] = useState<Set<number>>(new Set());
    const [sel, setSel] = useState(-1);
    const [views, setViews] = useState<SavedView[]>([]);
    const [viewsOpen, setViewsOpen] = useState(false);
    const [saveOpen, setSaveOpen] = useState(false);
    const [viewName, setViewName] = useState('');
    const [viewShared, setViewShared] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [delView, setDelView] = useState<SavedView | null>(null);
    const lastId = useRef(0);
    const searchRef = useRef<HTMLInputElement>(null);
    const abort = useRef<AbortController | null>(null);

    const patch = useCallback((p: Partial<EventFilters>) => setFilters((f) => ({ ...f, page: 1, ...p })), [setFilters]);

    /* đồng bộ ô tìm kiếm khi bộ lọc bị thay đổi từ nơi khác (nhảy từ tab khác sang) */
    useEffect(() => { setSearch(filters.q); }, [filters.q]);
    useEffect(() => {
        const t = window.setTimeout(() => { if (search !== filters.q) patch({ q: search }); }, 350);
        return () => window.clearTimeout(t);
    }, [search, filters.q, patch]);

    /* tải danh sách */
    const load = useCallback(async (silent = false) => {
        abort.current?.abort();
        const ac = new AbortController();
        abort.current = ac;
        if (!silent) setLoading(true);
        setError('');
        try {
            const res = await logsApi.events(filters, ac.signal);
            setData(res);
            if (res.items.length) lastId.current = Math.max(lastId.current, ...res.items.map((i) => i.id));
        } catch (e) {
            if ((e as Error).name === 'AbortError') return;
            setError((e as Error).message);
        } finally {
            if (abort.current === ac) setLoading(false);
        }
    }, [filters]);

    useEffect(() => { load(); }, [load, refreshKey]);

    useEffect(() => { onIds(data?.items.map((i) => i.id) ?? []); }, [data, onIds]);
    useEffect(() => { setSel(-1); }, [data?.meta.current_page, filters]);

    useEffect(() => {
        if (!pinPatch) return;
        setData((d) => d && { ...d, items: d.items.map((i) => (i.id === pinPatch.id ? { ...i, pinned: pinPatch.pinned } : i)) });
    }, [pinPatch]);

    /* bộ lọc đã lưu */
    const loadViews = useCallback(async () => { try { setViews(await logsApi.views()); } catch { /* không chặn trang */ } }, []);
    useEffect(() => { loadViews(); }, [loadViews]);

    /* luồng trực tiếp */
    const canLive = filters.page === 1 && filters.sort === 'occurred_at' && filters.dir === 'desc';
    useEffect(() => {
        if (!live) return;
        let stop = false;
        let timer = 0;
        const tick = async () => {
            try {
                const r = await logsApi.stream(lastId.current, filters);
                if (stop) return;
                lastId.current = Math.max(lastId.current, r.last_id);
                if (r.items.length) {
                    const incoming = [...r.items].reverse();
                    setData((d) => {
                        if (!d) return d;
                        const have = new Set(d.items.map((i) => i.id));
                        const add = incoming.filter((i) => !have.has(i.id));
                        return { ...d, items: [...add, ...d.items].slice(0, d.meta.per_page), meta: { ...d.meta, total: d.meta.total + add.length } };
                    });
                    setFresh(new Set(incoming.map((i) => i.id)));
                    window.setTimeout(() => setFresh(new Set()), 5000);
                    const severe = incoming.find((i) => i.level_no >= 50);
                    if (severe) toast.error(severe.level === 'critical' ? 'Sự kiện nghiêm trọng mới' : 'Có lỗi mới', severe.summary, { action: { label: 'Xem chi tiết', run: () => onOpenEvent(severe.id) } });
                }
            } catch { /* mạng chập chờn: thử lại lần sau */ }
            if (!stop) timer = window.setTimeout(tick, 4000);
        };
        // khởi tạo mốc = id lớn nhất hiện tại để chỉ nhận sự kiện MỚI
        logsApi.stream(2147483647, filters).then((r) => { lastId.current = Math.max(lastId.current, r.last_id); timer = window.setTimeout(tick, 2500); }).catch(() => { timer = window.setTimeout(tick, 4000); });
        return () => { stop = true; window.clearTimeout(timer); };
    }, [live, filters, toast, onOpenEvent]);

    const toggleLive = () => {
        if (!live && !canLive) { toast.info('Luồng trực tiếp', 'Đang chuyển về trang 1, sắp xếp mới nhất lên đầu.'); patch({ sort: 'occurred_at', dir: 'desc' }); }
        setLive((v) => !v);
    };

    /* phím tắt */
    useEffect(() => {
        const on = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement;
            if (el?.closest('input,textarea,select,[role="dialog"]')) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const n = data?.items.length ?? 0;
            if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
            else if (e.key === 'j') setSel((s) => Math.min(n - 1, s + 1));
            else if (e.key === 'k') setSel((s) => Math.max(0, s - 1));
            else if (e.key === 'Enter' && sel >= 0 && data?.items[sel]) onOpenEvent(data.items[sel].id);
            else if (e.key.toLowerCase() === 'l') toggleLive();
        };
        window.addEventListener('keydown', on);
        return () => window.removeEventListener('keydown', on);
    });

    const count = activeFilterCount(filters);
    const customRange = !!(filters.from || filters.to);

    const toggleIn = <K extends 'level' | 'category'>(key: K, val: EventFilters[K][number]) => {
        const arr = filters[key] as string[];
        patch({ [key]: arr.includes(val as string) ? arr.filter((x) => x !== val) : [...arr, val as string] } as Partial<EventFilters>);
    };

    const setSort = (col: EventFilters['sort']) => setFilters((f) => ({ ...f, page: 1, sort: col, dir: f.sort === col && f.dir === 'desc' ? 'asc' : 'desc' }));
    const sortIcon = (col: EventFilters['sort']) => (filters.sort === col ? <Icon name={filters.dir === 'desc' ? 'chevD' : 'chevU'} size={13} /> : null);

    const doExport = async (fmt: 'csv' | 'json') => {
        setExportOpen(false);
        setExporting(true);
        try {
            await logsApi.exportEvents(fmt, filters);
            toast.success('Đã xuất tệp', `Tối đa 5.000 dòng mới nhất theo bộ lọc hiện tại (${fmt.toUpperCase()}).`);
        } catch (e) {
            toast.error('Không xuất được tệp', (e as Error).message);
        } finally { setExporting(false); }
    };

    const saveView = async () => {
        try {
            setViews(await logsApi.saveView(viewName.trim(), { ...filters, page: 1 }, viewShared));
            toast.success('Đã lưu bộ lọc', viewName.trim());
            setSaveOpen(false); setViewName(''); setViewShared(false);
        } catch (e) { toast.error('Chưa lưu được', (e as Error).message); }
    };

    const removeView = async () => {
        if (!delView) return;
        try { await logsApi.deleteView(delView.id); setViews((v) => v.filter((x) => x.id !== delView.id)); toast.success('Đã xóa bộ lọc'); }
        catch (e) { toast.error('Chưa xóa được', (e as Error).message); }
        setDelView(null);
    };

    const applyView = (v: SavedView) => { setFilters({ ...DEFAULT_FILTERS, ...v.filters, page: 1 }); setViewsOpen(false); toast.info('Đã áp dụng bộ lọc', v.name); };

    const catOptions = useMemo(() => meta.categories, [meta.categories]);

    return (
        <div className="lg-stack">
            {/* ------------ thanh công cụ ------------ */}
            <div className="lg-filterbar">
                <div className="lg-search">
                    <Icon name="search" size={16} />
                    <input ref={searchRef} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo mô tả, hành động, người dùng, IP…" aria-label="Tìm trong nhật ký" />
                    <kbd>/</kbd>
                </div>

                <select className="lg-select" value={customRange ? 'custom' : filters.range} onChange={(e) => { if (e.target.value !== 'custom') patch({ range: e.target.value as EventFilters['range'], from: '', to: '' }); }} aria-label="Khoảng thời gian">
                    {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                    {customRange && <option value="custom">Tùy chọn…</option>}
                </select>

                <button type="button" className={`lg-btn lg-btn--ghost${advanced ? ' is-active' : ''}`} onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced}>
                    <Icon name="filter" size={16} /> Bộ lọc{count > 0 && <b className="lg-count">{count}</b>}
                </button>

                <div className="lg-menu">
                    <button type="button" className="lg-btn lg-btn--ghost" onClick={() => setViewsOpen((o) => !o)} aria-expanded={viewsOpen}><Icon name="star" size={16} /> Đã lưu{views.length > 0 && <b className="lg-count">{views.length}</b>}</button>
                    {viewsOpen && (
                        <div className="lg-menu__pop" role="menu">
                            {views.length === 0 && <p className="lg-hint">Chưa có bộ lọc nào được lưu.</p>}
                            {views.map((v) => (
                                <div key={v.id} className="lg-menu__item" role="menuitem">
                                    <button type="button" onClick={() => applyView(v)}><strong>{v.name}{v.shared && <Chip tone="teal">Chung</Chip>}</strong><small>{describeFilters(v.filters)}</small></button>
                                    {v.mine && <button type="button" className="lg-iconbtn" onClick={() => { setDelView(v); setViewsOpen(false); }} aria-label={`Xóa ${v.name}`}><Icon name="trash" size={15} /></button>}
                                </div>
                            ))}
                            <button type="button" className="lg-menu__save" onClick={() => { setSaveOpen(true); setViewsOpen(false); }}><Icon name="plus" size={15} /> Lưu bộ lọc hiện tại</button>
                        </div>
                    )}
                </div>

                <div className="lg-menu">
                    <button type="button" className="lg-btn lg-btn--ghost" onClick={() => setExportOpen((o) => !o)} disabled={exporting} aria-expanded={exportOpen}>{exporting ? <span className="lg-spinner" /> : <Icon name="download" size={16} />} Xuất</button>
                    {exportOpen && (
                        <div className="lg-menu__pop lg-menu__pop--sm" role="menu">
                            <button type="button" role="menuitem" onClick={() => doExport('csv')}>CSV (Excel)</button>
                            <button type="button" role="menuitem" onClick={() => doExport('json')}>JSON</button>
                            <p className="lg-hint">Tối đa 5.000 dòng theo bộ lọc.</p>
                        </div>
                    )}
                </div>

                <button type="button" className={`lg-live${live ? ' is-on' : ''}`} onClick={toggleLive} aria-pressed={live} title="Luồng trực tiếp (phím L)">
                    <i /> {live ? 'Đang trực tiếp' : 'Trực tiếp'} <Icon name={live ? 'pause' : 'play'} size={13} />
                </button>
            </div>

            {/* mức độ */}
            <div className="lg-levels" role="group" aria-label="Lọc theo mức độ">
                {LEVELS.map((l) => (
                    <button key={l.key} type="button" aria-pressed={filters.level.includes(l.key)} className={`lg-levelchip lg-levelchip--${l.key}${filters.level.includes(l.key) ? ' is-on' : ''}`} onClick={() => toggleIn('level', l.key)}><i />{l.label}</button>
                ))}
                {count > 0 && <button type="button" className="lg-link" onClick={() => setFilters({ ...DEFAULT_FILTERS, range: filters.range })}>Xóa {count} bộ lọc</button>}
            </div>

            {advanced && (
                <div className="lg-advanced">
                    <div className="lg-field lg-field--wide"><label>Nhóm sự kiện</label>
                        <div className="lg-chips">{catOptions.map((c) => <button key={c.key} type="button" aria-pressed={filters.category.includes(c.key)} className={`lg-pill${filters.category.includes(c.key) ? ' is-on' : ''}`} onClick={() => toggleIn('category', c.key)}>{c.label}</button>)}</div>
                    </div>
                    <div className="lg-field"><label htmlFor="lg-f-action">Hành động</label><input id="lg-f-action" list="lg-actions" value={filters.action} onChange={(e) => patch({ action: e.target.value })} placeholder="vd auth.login_failed hoặc payment.*" /><datalist id="lg-actions">{meta.actions.map((a) => <option key={a.action} value={a.action}>{actionLabel(a.action)}</option>)}</datalist></div>
                    <div className="lg-field"><label htmlFor="lg-f-actor">Người thực hiện</label><input id="lg-f-actor" value={filters.actor} onChange={(e) => patch({ actor: e.target.value })} placeholder="Tên hoặc ID" /></div>
                    <div className="lg-field"><label htmlFor="lg-f-ip">Địa chỉ IP</label><input id="lg-f-ip" value={filters.ip} onChange={(e) => patch({ ip: e.target.value })} placeholder="vd 10.0.0." /></div>
                    <div className="lg-field"><label htmlFor="lg-f-status">Mã HTTP</label><select id="lg-f-status" value={filters.status} onChange={(e) => patch({ status: e.target.value })}><option value="">Tất cả</option><option value="2xx">2xx Thành công</option><option value="3xx">3xx Chuyển hướng</option><option value="4xx">4xx Lỗi yêu cầu</option><option value="5xx">5xx Lỗi máy chủ</option></select></div>
                    <div className="lg-field"><label htmlFor="lg-f-source">Nguồn</label><select id="lg-f-source" value={filters.source} onChange={(e) => patch({ source: e.target.value })}><option value="">Tất cả</option>{meta.sources.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
                    <div className="lg-field"><label htmlFor="lg-f-from">Từ ngày</label><input id="lg-f-from" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => patch({ from: e.target.value })} /></div>
                    <div className="lg-field"><label htmlFor="lg-f-to">Đến ngày</label><input id="lg-f-to" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => patch({ to: e.target.value })} /></div>
                    <label className="lg-check"><input type="checkbox" checked={filters.pinned} onChange={(e) => patch({ pinned: e.target.checked })} /> Chỉ sự kiện đã ghim</label>
                    {(filters.request_id || filters.subject_type) && (
                        <div className="lg-field lg-field--wide"><label>Đang lọc theo</label><div className="lg-chips">
                            {filters.request_id && <button type="button" className="lg-pill is-on" onClick={() => patch({ request_id: '' })}>Mã yêu cầu {filters.request_id} ✕</button>}
                            {filters.subject_type && <button type="button" className="lg-pill is-on" onClick={() => patch({ subject_type: '', subject_id: '' })}>Đối tượng {filters.subject_type} {filters.subject_id && `#${filters.subject_id}`} ✕</button>}
                        </div></div>
                    )}
                </div>
            )}

            {/* ------------ bảng ------------ */}
            {error && !data ? <ErrorState message={error} onRetry={() => load()} /> : (
                <div className={`lg-tablecard${loading ? ' is-loading' : ''}`}>
                    {loading && !data ? (
                        <div className="lg-stack lg-pad">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} h={38} />)}</div>
                    ) : data && data.items.length === 0 ? (
                        <Empty icon="search" title={count > 0 || filters.q ? 'Không có sự kiện phù hợp' : 'Chưa có sự kiện nào'} text={count > 0 || filters.q ? 'Thử nới lỏng bộ lọc hoặc chọn khoảng thời gian dài hơn.' : 'Sự kiện sẽ xuất hiện khi người dùng thao tác trong hệ thống.'}
                               action={count > 0 ? <button type="button" className="lg-btn lg-btn--soft" onClick={() => setFilters({ ...DEFAULT_FILTERS, range: 'all' })}>Xóa bộ lọc, xem tất cả</button> : undefined} />
                    ) : (
                        <div className="lg-tablewrap">
                            <table className="lg-table">
                                <thead>
                                <tr>
                                    <th><button type="button" onClick={() => setSort('level_no')}>Mức độ {sortIcon('level_no')}</button></th>
                                    <th><button type="button" onClick={() => setSort('occurred_at')}>Thời gian {sortIcon('occurred_at')}</button></th>
                                    <th>Nhóm</th><th>Hành động</th><th>Mô tả</th><th>Người thực hiện</th><th>IP</th>
                                    <th><button type="button" onClick={() => setSort('duration_ms')}>HTTP {sortIcon('duration_ms')}</button></th>
                                </tr>
                                </thead>
                                <tbody>
                                {data?.items.map((e, i) => (
                                    <tr key={e.id} className={`lg-lvbar lg-lvbar--${e.level}${sel === i ? ' is-sel' : ''}${fresh.has(e.id) ? ' is-fresh' : ''}`} onClick={() => onOpenEvent(e.id)} tabIndex={0} onKeyDown={(ev) => ev.key === 'Enter' && onOpenEvent(e.id)}>
                                        <td><LevelBadge level={e.level} compact /></td>
                                        <td className="lg-nowrap" title={`${fmtDate(e.occurred_at)} ${fmtTime(e.occurred_at)} · ${timeAgo(e.occurred_at)}`}><span className="lg-mono">{fmtTime(e.occurred_at)}</span><small>{fmtDate(e.occurred_at)}</small></td>
                                        <td><Chip tone="neutral">{CATEGORY_LABEL[e.category] ?? e.category}</Chip></td>
                                        <td className="lg-cell-action"><strong>{actionLabel(e.action)}</strong>{actionLabel(e.action) !== e.action && <code>{e.action}</code>}</td>
                                        <td className="lg-cell-sum">{e.pinned && <Icon name="star" size={13} fill />} {e.has_diff && <Chip tone="violet">Diff</Chip>} {e.summary}</td>
                                        <td className="lg-nowrap">{actorLabel(e.actor)}{e.actor.type && <small>{ACTOR_TYPE[e.actor.type] ?? e.actor.type}</small>}</td>
                                        <td className="lg-mono lg-nowrap">{e.ip_address ?? '—'}</td>
                                        <td className="lg-nowrap">{e.status_code !== null ? <b className={`lg-http lg-http--${Math.floor(e.status_code / 100)}`}>{e.status_code}</b> : '—'}{e.duration_ms !== null && <small>{fmtMs(e.duration_ms)}</small>}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {data && <Pager meta={data.meta} busy={loading} onPage={(p) => setFilters((f) => ({ ...f, page: p }))} onPerPage={(n) => setFilters((f) => ({ ...f, page: 1, per_page: n }))} />}
                </div>
            )}
            <p className="lg-hint lg-keys"><Icon name="keyboard" size={14} /> <kbd>/</kbd> tìm kiếm · <kbd>j</kbd> <kbd>k</kbd> di chuyển · <kbd>Enter</kbd> mở · <kbd>L</kbd> trực tiếp · trong khung chi tiết <kbd>↑</kbd> <kbd>↓</kbd> chuyển sự kiện, <kbd>Esc</kbd> đóng</p>

            <Modal open={saveOpen} title="Lưu bộ lọc hiện tại" onClose={() => setSaveOpen(false)} footer={<><button type="button" className="lg-btn lg-btn--ghost" onClick={() => setSaveOpen(false)}>Hủy</button><button type="button" className="lg-btn lg-btn--primary" onClick={saveView} disabled={!viewName.trim()}>Lưu</button></>}>
                <div className="lg-field"><label htmlFor="lg-vname">Tên bộ lọc</label><input id="lg-vname" value={viewName} maxLength={80} onChange={(e) => setViewName(e.target.value)} placeholder="vd Lỗi API tuần này" autoFocus /></div>
                <p className="lg-hint">{describeFilters(filters)}</p>
                <label className="lg-check"><input type="checkbox" checked={viewShared} onChange={(e) => setViewShared(e.target.checked)} /> Chia sẻ cho các quản trị viên khác</label>
            </Modal>
            <ConfirmDialog open={!!delView} title="Xóa bộ lọc đã lưu?" message={`Bộ lọc “${delView?.name}” sẽ bị xóa. Các sự kiện không bị ảnh hưởng.`} confirmLabel="Xóa" onConfirm={removeView} onCancel={() => setDelView(null)} />
        </div>
    );
}