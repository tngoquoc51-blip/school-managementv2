'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import '@/modules/bgh/discipline/discipline.css';
import { SEMESTERS } from '@/modules/bgh/discipline/constants';
import { disciplineService, errMsg } from '@/modules/bgh/discipline/disciplineService';
import type { AlertItem, Meta, StudentHit, TabProps } from '@/modules/bgh/discipline/types';
import { Icon, Skel, UIProvider, useUI } from '@/modules/bgh/discipline/ui';
import NotificationCenter from '@/modules/bgh/discipline/NotificationCenter';
import OverviewTab from '@/modules/bgh/discipline/OverviewTab';
import RecordsTab from '@/modules/bgh/discipline/RecordsTab';
import CommendationsTab from '@/modules/bgh/discipline/CommendationsTab';
import AppealsTab from '@/modules/bgh/discipline/AppealsTab';
import StudentsTab from '@/modules/bgh/discipline/StudentsTab';
import RulesTab from '@/modules/bgh/discipline/RulesTab';
import ReportsTab from '@/modules/bgh/discipline/ReportsTab';
import RecordForm from '@/modules/bgh/discipline/RecordForm';
import RecordDrawer from '@/modules/bgh/discipline/RecordDrawer';

const TABS = [
    { k: 'overview', l: 'Tổng quan', i: 'home', badge: '' },
    { k: 'records', l: 'Vi phạm', i: 'alert', badge: 'pending_records' },
    { k: 'students', l: 'Hồ sơ học sinh', i: 'user', badge: 'low_score' },
    { k: 'commendations', l: 'Khen thưởng', i: 'star', badge: 'pending_commend' },
    { k: 'appeals', l: 'Khiếu nại', i: 'chat', badge: 'pending_appeals' },
    { k: 'reports', l: 'Báo cáo', i: 'chart', badge: '' },
    { k: 'rules', l: 'Quy chế & danh mục', i: 'scale', badge: '' },
];

export default function DisciplinePage() {
    return <UIProvider><Shell /></UIProvider>;
}

function Shell() {
    const { toast } = useUI();
    const [meta, setMeta] = useState<Meta | null>(null);
    const [tab, setTab] = useState('overview');
    const [yearId, setYearId] = useState(0);
    const [semester, setSemester] = useState(0);
    const [tick, setTick] = useState(0);
    const [alerts, setAlerts] = useState<{ alerts: AlertItem[]; total: number }>({ alerts: [], total: 0 });
    const [recFilter, setRecFilter] = useState<Record<string, string> | undefined>();
    const [recordId, setRecordId] = useState<number | null>(null);
    const [form, setForm] = useState<{ preset: StudentHit | null } | null>(null);
    const [focusStudent, setFocusStudent] = useState<number | null>(null);
    const lastTotal = useRef<number | null>(null);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u || !localStorage.getItem('token')) { window.location.href = '/login'; return; }
        disciplineService.meta().then((m) => { setMeta(m); setYearId(m.year_id); setSemester(0); })
            .catch((e) => toast('error', 'Không kết nối được máy chủ', errMsg(e)));
    }, []);

    const pollAlerts = useCallback(async () => {
        try {
            const a = await disciplineService.alerts();
            setAlerts(a);
            if (lastTotal.current !== null && a.total > lastTotal.current) toast('warn', 'Có việc mới cần xử lý', a.alerts[0]?.title);
            lastTotal.current = a.total;
        } catch { /* bỏ qua lỗi mạng tạm thời */ }
    }, []);
    useEffect(() => { pollAlerts(); const t = setInterval(pollAlerts, 60000); return () => clearInterval(t); }, [pollAlerts]);

    const refresh = useCallback(() => { setTick((t) => t + 1); pollAlerts(); }, [pollAlerts]);
    const goTab = (t: string, f?: Record<string, string>) => { if (t === 'records') setRecFilter({ ...(f ?? {}) }); setTab(t); };
    const openStudent = (id: number) => { setFocusStudent(id); setTab('students'); };

    const badgeOf = (key: string) => alerts.alerts.find((a) => a.key === key)?.count ?? 0;

    if (!meta) return (
        <div className="dc-app" style={{ placeItems: 'center', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}><Skel h={24} /><Skel h={90} /><Skel h={24} w="60%" /></div>
        </div>
    );

    const scope = { yearId, semester };
    const props: TabProps = {
        meta, scope, tick, refresh, goTab, filter: recFilter,
        openRecord: setRecordId, openStudent, newRecord: () => setForm({ preset: null }),
    };

    return (
        <div className="dc-app">
            <div className="dc-bar">
                <nav className="dc-nav" aria-label="Chức năng kỷ luật">
                    {TABS.map((t) => {
                        const n = t.badge ? badgeOf(t.badge) : 0;
                        return (
                            <button key={t.k} className={tab === t.k ? 'on' : ''} onClick={() => goTab(t.k)}>
                                <Icon n={t.i} />{t.l}{n > 0 && <span className="cnt">{n}</span>}
                            </button>
                        );
                    })}
                </nav>
                <div className="dc-tools">
                    <select className="dc-select inline" value={yearId} onChange={(e) => setYearId(Number(e.target.value))} aria-label="Năm học">
                        {meta.years.map((y) => <option key={y.id} value={y.id}>Năm học {y.label}</option>)}
                    </select>
                    <select className="dc-select inline" value={semester} onChange={(e) => setSemester(Number(e.target.value))} aria-label="Học kỳ">
                        {SEMESTERS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                    </select>
                    <NotificationCenter alerts={alerts.alerts} total={alerts.total} onPick={(a) => goTab(a.tab, a.tab === 'records' ? { status: 'pending' } : undefined)} />
                    <button className="dc-btn primary" onClick={() => setForm({ preset: null })}><Icon n="plus" />Ghi nhận vi phạm</button>
                </div>
            </div>

            <main className="dc-content" key={`${yearId}`}>
                {tab === 'overview' && <OverviewTab {...props} />}
                {tab === 'records' && <RecordsTab {...props} />}
                {tab === 'students' && <StudentsTab {...props} focusStudent={focusStudent} clearFocus={() => setFocusStudent(null)} />}
                {tab === 'commendations' && <CommendationsTab {...props} />}
                {tab === 'appeals' && <AppealsTab {...props} />}
                {tab === 'reports' && <ReportsTab {...props} />}
                {tab === 'rules' && <RulesTab {...props} />}
            </main>

            {form && <RecordForm meta={meta} scope={scope} preset={form.preset} onClose={() => setForm(null)} onSaved={refresh} />}
            {recordId && <RecordDrawer id={recordId} meta={meta} onClose={() => setRecordId(null)} onChanged={refresh} openStudent={openStudent} />}
        </div>
    );
}