'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '../logs/logs.module.css';
import e from './evaluations.module.css';
import { errorMessage, getToken, loginForLogs } from '../logs/api';
import { Icon } from '../logs/components/Icons';
import { ErrorBox, Skeleton, ToastProvider, useAsync } from '../logs/components/ui';
import { evApi } from './api';
import ActionDialog from './components/ActionDialog';
import { Ctx } from './components/ctx';
import ObsCreateDialog from './components/ObsCreateDialog';
import ObservationDrawer from './components/ObservationDrawer';
import PlanDialog from './components/PlanDialog';
import TeacherDrawer from './components/TeacherDrawer';
import ActionsTab from './tabs/ActionsTab';
import ObservationsTab from './tabs/ObservationsTab';
import OverviewTab from './tabs/OverviewTab';
import PeriodicTab from './tabs/PeriodicTab';
import PlansTab from './tabs/PlansTab';
import ReportsTab from './tabs/ReportsTab';
import RubricsTab from './tabs/RubricsTab';
import SettingsTab from './tabs/SettingsTab';
import TeachersTab from './tabs/TeachersTab';
import type { Lookups, Me } from './types';

const TABS = [
    { key: 'overview', label: 'Tổng quan', icon: 'pulse' },
    { key: 'plans', label: 'Lịch dự giờ', icon: 'clock' },
    { key: 'observations', label: 'Phiếu dự giờ', icon: 'list' },
    { key: 'periodic', label: 'Đánh giá định kỳ', icon: 'check' },
    { key: 'teachers', label: 'Hồ sơ giáo viên', icon: 'users' },
    { key: 'actions', label: 'Kế hoạch cải tiến', icon: 'bell' },
    { key: 'rubrics', label: 'Tiêu chí', icon: 'shield' },
    { key: 'reports', label: 'Báo cáo', icon: 'db' },
    { key: 'settings', label: 'Cài đặt', icon: 'cog' },
] as const;
type TabKey = (typeof TABS)[number]['key'];
const ALLOWED = ['principal', 'vice_principal', 'super_admin'];

export default function EvalApp() {
    return <ToastProvider><Shell /></ToastProvider>;
}

function Login({ onDone }: { onDone: () => void }) {
    const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    const submit = async (x: React.FormEvent) => { x.preventDefault(); setBusy(true); setErr(''); try { await loginForLogs(email.trim(), pw); onDone(); } catch (y) { setErr(errorMessage(y)); } finally { setBusy(false); } };
    return (
        <form onSubmit={submit} className={e.form} style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 800 }}>Đăng nhập tài khoản Ban Giám hiệu</div>
            <input className={e.input} placeholder="Email hoặc tên đăng nhập" value={email} onChange={(x) => setEmail(x.target.value)} autoComplete="username" required />
            <input className={e.input} type="password" placeholder="Mật khẩu" value={pw} onChange={(x) => setPw(x.target.value)} autoComplete="current-password" required />
            {err && <div className={e.errLine}>{err}</div>}
            <button className={`${s.btn} ${s.primary}`} disabled={busy} type="submit">{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        </form>
    );
}

function Shell() {
    const router = useRouter();
    const [theme, setTheme] = useState<'dark' | 'light'>('light');
    const [tab, setTab] = useState<TabKey>('overview');
    const [tick, setTick] = useState(0);
    const [semester, setSemester] = useState(0);
    const [noToken, setNoToken] = useState(false);
    const [obsId, setObsId] = useState<number | null>(null);
    const [teacherId, setTeacherId] = useState<number | null>(null);
    const [plan, setPlan] = useState<null | { prefill?: any }>(null);
    const [action, setAction] = useState<null | { prefill?: any }>(null);
    const [newObs, setNewObs] = useState<null | { prefill?: any }>(null);
    const boot = useAsync<{ me: Me; lk: Lookups }>();

    const start = useCallback(() => boot.run(async () => { const [me, lk] = await Promise.all([evApi.me(), evApi.lookups()]); return { me, lk }; }), []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        try { const t = localStorage.getItem('ev_theme'); if (t === 'light' || t === 'dark') setTheme(t); } catch {}
        const h = window.location.hash.replace('#', '') as TabKey;
        if (TABS.some((x) => x.key === h)) setTab(h);
        if (!getToken()) { setNoToken(true); return; }
        start();
    }, [start]);
    useEffect(() => { try { localStorage.setItem('ev_theme', theme); } catch {} }, [theme]);
    useEffect(() => { document.title = 'Dự giờ & Đánh giá giáo viên — Ban Giám hiệu'; }, []);
    useEffect(() => { if (boot.data && !semester) setSemester(Number(boot.data.me.settings.current_semester) || 1); }, [boot.data, semester]);

    const reload = useCallback(() => setTick((t) => t + 1), []);
    const goTab = useCallback((t: string) => { setTab(t as TabKey); window.location.hash = t; }, []);

    const ctx = useMemo(() => boot.data ? {
        me: boot.data.me, settings: boot.data.me.settings, lk: boot.data.lk, year: boot.data.lk.year?.id ?? 0, semester: semester || 1, tick, reload, goTab,
        openObs: (id: number) => setObsId(id), openTeacher: (id: number) => setTeacherId(id),
        newPlan: (prefill?: any) => setPlan({ prefill }), newAction: (prefill?: any) => setAction({ prefill }), newObs: (prefill?: any) => setNewObs({ prefill }),
    } : null, [boot.data, semester, tick, reload, goTab]);

    if (!ctx) {
        const failed = noToken || !!boot.error;
        return (
            <div className={`${s.root} ${e.skin}`} data-theme={theme} style={{ placeItems: 'center' }}>
                <div style={{ width: 'min(560px, 92vw)' }}>
                    {failed ? (
                        <>
                            <ErrorBox message={noToken ? 'Chưa đăng nhập. Hãy đăng nhập bằng tài khoản Ban Giám hiệu.' : boot.error} onRetry={noToken ? undefined : start} />
                            <Login onDone={() => { setNoToken(false); start(); }} />
                            <button className={`${s.btn} ${s.ghost}`} style={{ marginTop: 12 }} onClick={() => router.push('/bgh/dashboard')}><Icon name="back" size={16} /> Về bảng điều khiển</button>
                        </>
                    ) : <Skeleton h={90} />}
                </div>
            </div>
        );
    }
    if (ctx.me.user.role && !ALLOWED.includes(ctx.me.user.role)) return null;

    return (
        <Ctx.Provider value={ctx}>
            <div className={`${s.root} ${e.skin}`} data-theme={theme}>
                <div className={s.main}>
                    <header className={s.topbar}>
                        <button className={s.iconBtn} onClick={() => router.push('/bgh/dashboard')} aria-label="Về bảng điều khiển" title="Về bảng điều khiển"><Icon name="back" /></button>
                        <nav className={s.tabbar} aria-label="Phân hệ dự giờ">
                            {TABS.map((t) => (
                                <button key={t.key} className={`${s.tabBtn} ${tab === t.key ? s.active : ''}`} onClick={() => goTab(t.key)} aria-current={tab === t.key ? 'page' : undefined}>
                                    <Icon name={t.icon} size={16} /><span>{t.label}</span>
                                </button>
                            ))}
                        </nav>
                        <div className={s.spacer} />
                        <select className={s.field} style={{ height: 36 }} value={ctx.year} disabled aria-label="Năm học"><option>{ctx.lk.year?.label}</option></select>
                        <div className={s.seg} role="group" aria-label="Học kỳ">
                            {[[1, 'HK1'], [2, 'HK2'], [3, 'Cả năm']].map(([k, l]) => <button key={k} className={semester === k ? s.on : ''} onClick={() => setSemester(Number(k))}>{l}</button>)}
                        </div>
                        <button className={s.iconBtn} onClick={reload} aria-label="Làm mới" title="Làm mới"><Icon name="refresh" /></button>
                        <button className={s.iconBtn} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Đổi giao diện sáng/tối"><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
                    </header>
                    <main className={s.content}>
                        {tab === 'overview' && <OverviewTab />}
                        {tab === 'plans' && <PlansTab />}
                        {tab === 'observations' && <ObservationsTab />}
                        {tab === 'periodic' && <PeriodicTab />}
                        {tab === 'teachers' && <TeachersTab />}
                        {tab === 'actions' && <ActionsTab />}
                        {tab === 'rubrics' && <RubricsTab />}
                        {tab === 'reports' && <ReportsTab />}
                        {tab === 'settings' && <SettingsTab />}
                    </main>
                </div>

                {obsId !== null && <ObservationDrawer id={obsId} onClose={() => setObsId(null)} onChanged={reload} />}
                {teacherId !== null && <TeacherDrawer id={teacherId} onClose={() => setTeacherId(null)} />}
                {plan && <PlanDialog prefill={plan.prefill} onClose={() => setPlan(null)} onSaved={() => { setPlan(null); reload(); }} />}
                {action && <ActionDialog prefill={action.prefill} onClose={() => setAction(null)} onSaved={() => { setAction(null); reload(); }} />}
                {newObs && <ObsCreateDialog prefill={newObs.prefill} onClose={() => setNewObs(null)} onCreated={(id) => { setNewObs(null); reload(); setObsId(id); }} />}
            </div>
        </Ctx.Provider>
    );
}