'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import s from './logs.module.css';
import { clearLogsToken, debugInfo, errorMessage, getToken, loginForLogs, logsApi } from './api';
import { Icon } from './components/Icons';
import LogDrawer from './components/LogDrawer';
import { ErrorBox, ToastProvider, useAsync } from './components/ui';
import { initials, roleLabel } from './format';
import type { Filters, Me } from './types';
import ActivityTab from './tabs/ActivityTab';
import AlertsTab from './tabs/AlertsTab';
import FinanceTab from './tabs/FinanceTab';
import OverviewTab from './tabs/OverviewTab';
import SecurityTab from './tabs/SecurityTab';
import SessionsTab from './tabs/SessionsTab';
import SettingsTab from './tabs/SettingsTab';
import type { TabProps } from './tabs/tabProps';

function InlineLogin({ onDone }: { onDone: () => void }) {
    const [email, setEmail] = useState('');
    const [pw, setPw] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true); setErr('');
        try { await loginForLogs(email.trim(), pw); onDone(); }
        catch (x) { setErr(errorMessage(x)); }
        finally { setBusy(false); }
    };
    const inp: React.CSSProperties = { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--panel)', color: 'var(--text)', font: 'inherit', outline: 'none' };
    return (
        <form onSubmit={submit} style={{ marginTop: 16, display: 'grid', gap: 10 }}>
            <div style={{ fontWeight: 700 }}>Đăng nhập tài khoản Ban Giám hiệu để xem Nhật ký</div>
            <input style={inp} placeholder="Email hoặc tên đăng nhập" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
            <input style={inp} type="password" placeholder="Mật khẩu" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required />
            {err && <div style={{ color: '#fb7185', fontSize: 13 }}>{err}</div>}
            <button className={`${s.btn} ${s.primary}`} disabled={busy} type="submit">{busy ? 'Đang đăng nhập…' : 'Đăng nhập & mở Nhật ký'}</button>
        </form>
    );
}

const TABS = [
    { key: 'overview', label: 'Tổng quan', icon: 'pulse', sub: 'Bức tranh toàn trường theo thời gian thực' },
    { key: 'activity', label: 'Nhật ký hoạt động', icon: 'list', sub: 'Tra cứu, lọc và xem chi tiết từng thao tác' },
    { key: 'security', label: 'Bảo mật', icon: 'shield', sub: 'Đăng nhập bất thường, IP đáng ngờ, tài khoản bị khoá' },
    { key: 'sessions', label: 'Phiên đăng nhập', icon: 'users', sub: 'Ai đang đăng nhập — buộc đăng xuất khi cần' },
    { key: 'finance', label: 'Kiểm toán tài chính', icon: 'coin', sub: 'Phiếu thu, đợt thu và các thao tác tiền' },
    { key: 'alerts', label: 'Cảnh báo', icon: 'bell', sub: 'Sự kiện cần xử lý và luật cảnh báo' },
    { key: 'settings', label: 'Cấu hình & toàn vẹn', icon: 'cog', sub: 'Lưu trữ, chuỗi băm chống sửa, nhập log cũ' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const RANGES = [['today', 'Hôm nay'], ['7d', '7 ngày'], ['30d', '30 ngày'], ['90d', '90 ngày']] as const;
const ALLOWED = ['principal', 'vice_principal', 'super_admin'];

export default function LogsApp() {
    return <ToastProvider><Shell /></ToastProvider>;
}

function Shell() {
    const router = useRouter();
    const [theme, setTheme] = useState<'dark' | 'light'>('light');
    const [tab, setTab] = useState<TabKey>('overview');
    const [range, setRange] = useState('7d');
    const [tick, setTick] = useState(0);
    const [live, setLive] = useState(false);
    const [menu, setMenu] = useState(false);
    const [openId, setOpenId] = useState<number | null>(null);
    const [filters, setFilters] = useState<Filters>({});
    const [alerts, setAlerts] = useState(0);
    const [stamp, setStamp] = useState('');
    const meState = useAsync<Me>();
    const [user, setUser] = useState<{ name?: string } | null>(null);
    const [noToken, setNoToken] = useState(false);

    // khởi tạo: theme, tab từ URL, kiểm tra đăng nhập
    useEffect(() => {
        try { const t = localStorage.getItem('logs_theme_v2'); if (t === 'light' || t === 'dark') setTheme(t); } catch {}
        const h = window.location.hash.replace('#', '') as TabKey;
        if (TABS.some((x) => x.key === h)) setTab(h);
        if (!getToken()) { setNoToken(true); return; }
        try { setUser(JSON.parse(localStorage.getItem('user') || 'null')); } catch {}
        meState.run(() => logsApi.me());
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { document.title = 'Nhật ký hệ thống — Ban Giám hiệu'; }, []);
    useEffect(() => { try { localStorage.setItem('logs_theme_v2', theme); } catch {} }, [theme]);

    const refresh = useCallback(() => { setTick((t) => t + 1); setStamp(new Date().toLocaleTimeString('vi-VN')); }, []);
    useEffect(() => {
        if (!live) return;
        const id = setInterval(refresh, 30000);
        return () => clearInterval(id);
    }, [live, refresh]);

    const goTab = useCallback((t: string) => { setTab(t as TabKey); window.location.hash = t; setMenu(false); }, []);
    const goActivity = useCallback((f: Filters) => { setFilters(f); goTab('activity'); }, [goTab]);

    const me = meState.data;
    const cur = TABS.find((t) => t.key === tab)!;

    if (!me) {
        const dbg = typeof window !== 'undefined' ? debugInfo() : null;
        const failed = noToken || !!meState.error;
        return (
            <div className={s.root} data-theme={theme} style={{ gridTemplateColumns: '1fr', placeItems: 'center' }}>
                <div style={{ width: 'min(620px, 92vw)' }}>
                    {failed ? (
                        <>
                            <ErrorBox
                                message={noToken ? 'Không tìm thấy token đăng nhập trong trình duyệt. Hãy đăng nhập lại bằng tài khoản Ban Giám hiệu.' : meState.error}
                                onRetry={noToken ? undefined : () => meState.run(() => logsApi.me())} />
                            {dbg && (
                                <pre className={`${s.code} ${s.mono}`} style={{ marginTop: 14, whiteSpace: 'pre-wrap' }}>
{`API đang gọi : ${dbg.api}/logs/me
Khoá localStorage  : ${dbg.local.join(', ') || '(trống)'}
Khoá sessionStorage: ${dbg.session.join(', ') || '(trống)'}`}
                                </pre>
                            )}
                            <InlineLogin onDone={() => { setNoToken(false); meState.run(() => logsApi.me()); }} />
                            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                                <button className={`${s.btn} ${s.primary}`} onClick={() => router.push('/login/bgh')}>Đến trang đăng nhập BGH</button>
                                <button className={`${s.btn} ${s.ghost}`} onClick={() => router.push('/bgh/dashboard')}><Icon name="back" size={16} /> Về bảng điều khiển</button>
                            </div>
                        </>
                    ) : <div className={`${s.skeleton}`} style={{ height: 90 }} />}
                </div>
            </div>
        );
    }
    if (!ALLOWED.includes(me.role)) return null;

    const props: TabProps = { me, range, tick, openLog: setOpenId, goActivity, goTab, onBadges: (b) => b.alerts !== undefined && setAlerts(b.alerts) };

    return (
        <div className={s.root} data-theme={theme}>
            <div className={s.main}>
                <header className={s.topbar}>
                    <nav className={s.tabbar} aria-label="Phân hệ nhật ký">
                        {TABS.map((t) => (
                            <button key={t.key} className={`${s.tabBtn} ${tab === t.key ? s.active : ''}`} onClick={() => goTab(t.key)} aria-current={tab === t.key ? 'page' : undefined}>
                                <Icon name={t.icon} size={16} /><span>{t.label}</span>
                                {t.key === 'alerts' && alerts > 0 && <span className={s.badge}>{alerts}</span>}
                            </button>
                        ))}
                    </nav>
                    <div className={s.spacer} />
                    {tab === 'overview' && (
                        <div className={s.seg} role="group" aria-label="Khoảng thời gian">
                            {RANGES.map(([k, l]) => <button key={k} className={range === k ? s.on : ''} onClick={() => setRange(k)}>{l}</button>)}
                        </div>
                    )}
                    <button className={s.live} onClick={() => setLive((v) => !v)} title="Tự động làm mới mỗi 30 giây" aria-pressed={live}>
                        <span className={`${s.dot} ${live ? s.on : ''}`} />{live ? 'Trực tiếp' : 'Tạm dừng'}{stamp && <span className={s.faint}> · {stamp}</span>}
                    </button>
                    <button className={s.iconBtn} onClick={refresh} aria-label="Làm mới" title="Làm mới"><Icon name="refresh" /></button>
                    <button className={s.iconBtn} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Đổi giao diện sáng/tối" title="Sáng / tối"><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
                </header>

                <main className={s.content}>
                    {tab === 'overview' && <OverviewTab {...props} />}
                    {tab === 'activity' && <ActivityTab {...props} filters={filters} setFilters={setFilters} />}
                    {tab === 'security' && <SecurityTab {...props} />}
                    {tab === 'sessions' && <SessionsTab {...props} />}
                    {tab === 'finance' && <FinanceTab {...props} />}
                    {tab === 'alerts' && <AlertsTab {...props} />}
                    {tab === 'settings' && <SettingsTab {...props} />}
                </main>
            </div>

            {openId !== null && <LogDrawer id={openId} onClose={() => setOpenId(null)} onOpen={setOpenId} onFilter={goActivity} />}
        </div>
    );
}