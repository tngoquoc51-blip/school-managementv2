'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import './logs.css';
import EventDrawer from './EventDrawer';
import Icon from './Icon';
import { ApiError, logsApi } from './logsApi';
import { ToastProvider, useToast } from './ToastProvider';
import { Empty, ErrorState, Skeleton } from './ui';
import AlertsTab from './tabs/AlertsTab';
import AuditTab from './tabs/AuditTab';
import EventsTab from './tabs/EventsTab';
import OverviewTab from './tabs/OverviewTab';
import SecurityTab from './tabs/SecurityTab';
import StorageTab from './tabs/StorageTab';
import type { EventFilters, Meta, Overview, TabKey } from './types';
import { DEFAULT_FILTERS } from './utils';

const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'overview', label: 'Tổng quan', icon: 'dashboard' },
    { key: 'events', label: 'Sự kiện', icon: 'list' },
    { key: 'security', label: 'Bảo mật', icon: 'shield' },
    { key: 'audit', label: 'Kiểm toán dữ liệu', icon: 'diff' },
    { key: 'alerts', label: 'Cảnh báo', icon: 'bell' },
    { key: 'storage', label: 'Lưu trữ', icon: 'archive' },
];

export default function LogsPage() {
    return (
        <ToastProvider>
            <Shell />
        </ToastProvider>
    );
}

function Shell() {
    const toast = useToast();
    const [meta, setMeta] = useState<Meta | null>(null);
    const [metaErr, setMetaErr] = useState<ApiError | null>(null);
    const [tab, setTab] = useState<TabKey>('overview');
    const [filters, setFilters] = useState<EventFilters>(DEFAULT_FILTERS);
    const [openId, setOpenId] = useState<number | null>(null);
    const [ids, setIds] = useState<number[]>([]);
    const [pinPatch, setPinPatch] = useState<{ id: number; pinned: boolean } | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [openIncidents, setOpenIncidents] = useState(0);
    const [health, setHealth] = useState<Overview['health'] | null>(null);
    const lastOpen = useRef<number | null>(null);

    /* chủ đề giao diện */
    useEffect(() => {
        try {
            // Mặc định luôn là nền trắng; chỉ dùng nền tối khi người dùng tự bấm nút mặt trăng.
            setTheme(window.localStorage.getItem('lg-theme-v2') === 'dark' ? 'dark' : 'light');
        } catch { /* bỏ qua */ }
    }, []);
    const toggleTheme = () => setTheme((t) => { const n = t === 'dark' ? 'light' : 'dark'; try { window.localStorage.setItem('lg-theme-v2', n); } catch { /* bỏ qua */ } return n; });

    /* tab theo URL hash */
    useEffect(() => {
        const read = () => { const h = window.location.hash.replace('#', '') as TabKey; if (TABS.some((t) => t.key === h)) setTab(h); };
        read();
        window.addEventListener('hashchange', read);
        return () => window.removeEventListener('hashchange', read);
    }, []);
    const goTab = useCallback((t: TabKey) => { setTab(t); window.history.replaceState(null, '', `#${t}`); window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);
    const goEvents = useCallback((p: Partial<EventFilters>) => { setFilters({ ...DEFAULT_FILTERS, ...p, page: 1 }); goTab('events'); }, [goTab]);

    /* siêu dữ liệu + quyền */
    const loadMeta = useCallback(async () => {
        setMetaErr(null);
        try { setMeta(await logsApi.meta()); } catch (e) { setMetaErr(e instanceof ApiError ? e : new ApiError((e as Error).message, 0)); }
    }, []);
    useEffect(() => { loadMeta(); }, [loadMeta]);

    /* thông báo sự cố mới (hỏi máy chủ mỗi 30 giây) */
    const pollIncidents = useCallback(async () => {
        try {
            const r = await logsApi.incidents({ status: 'open', per_page: 5 });
            const open = r.counts.open;
            if (lastOpen.current !== null && open > lastOpen.current) {
                const newest = r.items[0];
                const sev = newest?.severity ?? 'warning';
                const fn = sev === 'critical' || sev === 'error' ? toast.error : toast.warning;
                fn('Có sự cố mới cần xử lý', newest?.title ?? `${open - lastOpen.current} sự cố mới`, { action: { label: 'Xem sự cố', run: () => goTab('alerts') } });
            }
            lastOpen.current = open;
            setOpenIncidents(open);
        } catch { /* im lặng */ }
    }, [toast, goTab]);
    useEffect(() => {
        if (!meta) return;
        pollIncidents();
        const t = window.setInterval(pollIncidents, 30000);
        return () => window.clearInterval(t);
    }, [meta, pollIncidents]);

    /* phím số 1–6 chuyển tab */
    useEffect(() => {
        const on = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement)?.closest('input,textarea,select,[role="dialog"]') || e.metaKey || e.ctrlKey || e.altKey || openId !== null) return;
            const i = Number(e.key);
            if (i >= 1 && i <= TABS.length) goTab(TABS[i - 1].key);
        };
        window.addEventListener('keydown', on);
        return () => window.removeEventListener('keydown', on);
    }, [goTab, openId]);

    const idx = openId !== null ? ids.indexOf(openId) : -1;
    const neighbors = { prev: idx > 0 ? ids[idx - 1] : null, next: idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null };
    const canManage = !!meta?.can_manage;
    const refresh = () => { setRefreshKey((k) => k + 1); pollIncidents(); };

    return (
        <div className="lg" data-theme={theme}>
            <header className="lg-head">
                <div>
                    <h1>Nhật ký hệ thống</h1>
                    <p>Giám sát hoạt động, bảo mật và an toàn dữ liệu của toàn bộ hệ thống nhà trường.</p>
                </div>
                <div className="lg-head__tools">
                    {health && <button type="button" className={`lg-healthpill lg-healthpill--${health.score >= 90 ? 'good' : health.score >= 75 ? 'ok' : health.score >= 60 ? 'warn' : 'bad'}`} onClick={() => goTab('overview')} title="Điểm sức khỏe hệ thống"><i />Sức khỏe <b>{health.score}</b> · {health.grade}</button>}
                    {meta && <span className={`lg-role${canManage ? '' : ' is-ro'}`}>{canManage ? 'Quản trị đầy đủ' : 'Chỉ xem'}</span>}
                    <button type="button" className="lg-btn lg-btn--ghost lg-btn--icon" onClick={refresh} aria-label="Làm mới dữ liệu" title="Làm mới"><Icon name="refresh" size={17} /></button>
                    <button type="button" className="lg-btn lg-btn--ghost lg-btn--icon" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'} title="Đổi giao diện sáng/tối"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} /></button>
                </div>
            </header>

            {metaErr ? (
                metaErr.status === 403 ? <Empty icon="lock" title="Bạn không có quyền xem Nhật ký hệ thống" text="Trang này dành cho Quản trị hệ thống, Hiệu trưởng và Phó hiệu trưởng. Hãy liên hệ quản trị viên để được cấp quyền." />
                    : metaErr.status === 401 ? <Empty icon="lock" title="Phiên đăng nhập đã hết hạn" text="Vui lòng đăng nhập lại bằng tài khoản quản trị." action={<a className="lg-btn lg-btn--primary" href="/login/admin">Đăng nhập lại</a>} />
                        : <ErrorState message={metaErr.message} onRetry={loadMeta} />
            ) : !meta ? (
                <div className="lg-stack"><Skeleton h={44} r={12} /><Skeleton h={220} r={14} /></div>
            ) : (
                <>
                    <nav className="lg-tabs" aria-label="Các mục nhật ký">
                        {TABS.map((t, i) => (
                            <button key={t.key} type="button" className={`lg-tab${tab === t.key ? ' is-active' : ''}`} aria-current={tab === t.key ? 'page' : undefined} onClick={() => goTab(t.key)} title={`Phím tắt: ${i + 1}`}>
                                <Icon name={t.icon} size={17} /><span>{t.label}</span>
                                {t.key === 'alerts' && openIncidents > 0 && <b className="lg-tab__badge" aria-label={`${openIncidents} sự cố đang mở`}>{openIncidents}</b>}
                            </button>
                        ))}
                    </nav>

                    <main>
                        {tab === 'overview' && <OverviewTab refreshKey={refreshKey} onOpenEvent={setOpenId} onGoEvents={goEvents} onGoTab={goTab} onLoaded={(o) => setHealth(o.health)} />}
                        {tab === 'events' && <EventsTab meta={meta} filters={filters} setFilters={setFilters} refreshKey={refreshKey} onOpenEvent={setOpenId} onIds={setIds} pinPatch={pinPatch} />}
                        {tab === 'security' && <SecurityTab canManage={canManage} refreshKey={refreshKey} onOpenEvent={setOpenId} onGoEvents={goEvents} />}
                        {tab === 'audit' && <AuditTab refreshKey={refreshKey} onOpenEvent={setOpenId} />}
                        {tab === 'alerts' && <AlertsTab canManage={canManage} refreshKey={refreshKey} onOpenEvent={setOpenId} onChanged={pollIncidents} />}
                        {tab === 'storage' && <StorageTab canManage={canManage} refreshKey={refreshKey} onGoEvents={goEvents} onChanged={() => setRefreshKey((k) => k + 1)} />}
                    </main>

                    {!canManage && <p className="lg-hint lg-ro-note"><Icon name="lock" size={14} /> Bạn đang ở chế độ chỉ xem. Quy tắc cảnh báo, dọn dẹp và mở khóa tài khoản cần quyền Quản trị hệ thống.</p>}
                </>
            )}

            {openId !== null && (
                <EventDrawer key={openId} id={openId} neighbors={neighbors} onClose={() => setOpenId(null)} onNavigate={setOpenId} onFilter={goEvents}
                             onPinChange={(id, pinned) => setPinPatch({ id, pinned })} />
            )}
        </div>
    );
}