'use client';

import { useCallback, useEffect, useState } from 'react';
import '../subjects/subjects.css';
import './teachers.css';
import Icon from '../subjects/ui/Icon';
import { ToastProvider, useToast } from '../subjects/ui/Toast';
import { ConfirmProvider } from '../subjects/ui/Confirm';
import { errMsg, teacherApi } from './api';
import type { Meta, TabKey } from './types';
import OverviewTab from './tabs/OverviewTab';
import ListTab from './tabs/ListTab';
import SupplyTab from './tabs/SupplyTab';
import HomeroomTab from './tabs/HomeroomTab';
import WorkloadTab from './tabs/WorkloadTab';
import ScheduleTab from './tabs/ScheduleTab';
import LeaveTab from './tabs/LeaveTab';
import IntegrityTab from './tabs/IntegrityTab';
import AuditTab from './tabs/AuditTab';

export interface Ctx {
    meta: Meta; yearId: number; go: (t: TabKey) => void; refreshMeta: () => Promise<void>;
    openCreate: () => void; openTeacher: (id: number) => void; health: number | null; setHealth: (n: number | null) => void;
    pickTeacher: number | null; setPickTeacher: (id: number | null) => void;
}

const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'overview', label: 'Tổng quan', icon: 'grid' },
    { key: 'list', label: 'Danh sách giáo viên', icon: 'users' },
    { key: 'supply', label: 'Chuyên môn & thiếu hụt', icon: 'layers' },
    { key: 'homeroom', label: 'Chủ nhiệm', icon: 'star' },
    { key: 'workload', label: 'Tải dạy & cân bằng', icon: 'gauge' },
    { key: 'schedule', label: 'Lịch dạy', icon: 'clock' },
    { key: 'leaves', label: 'Nghỉ phép & dạy thay', icon: 'link' },
    { key: 'integrity', label: 'Kiểm tra dữ liệu', icon: 'shield' },
    { key: 'audit', label: 'Nhật ký', icon: 'list' },
];

function Shell() {
    const toast = useToast();
    const [tab, setTab] = useState<TabKey>('overview');
    const [meta, setMeta] = useState<Meta | null>(null);
    const [yearId, setYearId] = useState(0);
    const [err, setErr] = useState('');
    const [dark, setDark] = useState(false);
    const [full, setFull] = useState(false);
    const [health, setHealth] = useState<number | null>(null);
    const [pendingCreate, setPendingCreate] = useState(false);
    const [openId, setOpenId] = useState<number | null>(null);
    const [pickTeacher, setPickTeacher] = useState<number | null>(null);

    const loadMeta = useCallback(async () => {
        try {
            const m = await teacherApi.meta();
            setMeta(m);
            setYearId((y) => y || m.years.find((x) => x.is_current)?.id || m.years[0]?.id || 0);
            setErr('');
        } catch (e) { setErr(errMsg(e)); }
    }, []);

    useEffect(() => {
        loadMeta();
        try {
            setDark(localStorage.getItem('tc-theme') === 'dark');
            const t = localStorage.getItem('tc-tab') as TabKey | null;
            if (t && TABS.some((x) => x.key === t)) setTab(t);
        } catch { /* bỏ qua */ }
    }, [loadMeta]);
    useEffect(() => { try { localStorage.setItem('tc-theme', dark ? 'dark' : 'light'); } catch { /* */ } }, [dark]);
    useEffect(() => { try { localStorage.setItem('tc-tab', tab); } catch { /* */ } }, [tab]);
    useEffect(() => {
        const on = () => { if (!document.fullscreenElement) setFull(false); };
        document.addEventListener('fullscreenchange', on);
        return () => document.removeEventListener('fullscreenchange', on);
    }, []);

    const toggleFull = async () => {
        const next = !full;
        setFull(next);
        try {
            if (next && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
            else if (!next && document.fullscreenElement) await document.exitFullscreen();
        } catch { /* vẫn giữ chế độ phủ kín trang */ }
    };

    const openCreate = () => { setTab('list'); setPendingCreate(true); };
    const consumed = useCallback(() => setPendingCreate(false), []);
    const openTeacher = (id: number) => { setTab('list'); setOpenId(id); };
    const consumedOpen = useCallback(() => setOpenId(null), []);

    if (err && !meta) {
        return (
            <div className="sj" data-theme={dark ? 'dark' : 'light'}>
                <div className="sj-body">
                    <div className="sj-errbox">
                        <Icon name="alert" size={30} />
                        <b>Không tải được module Giáo viên</b>
                        <p className="sj-muted">{err}</p>
                        <p className="sj-muted">Hãy chắc chắn đã chạy file SQL <code>2026_11_12_teachers_module.sql</code> trong HeidiSQL.</p>
                        <button className="sj-btn primary" onClick={() => { loadMeta(); toast.info('Đang thử kết nối lại…'); }}><Icon name="refresh" size={16} /> Thử lại</button>
                    </div>
                </div>
            </div>
        );
    }

    const ctx: Ctx | null = meta ? { meta, yearId, go: setTab, refreshMeta: loadMeta, openCreate, openTeacher, health, setHealth, pickTeacher, setPickTeacher } : null;

    return (
        <div className={`sj tc ${full ? 'is-full' : ''}`} data-theme={dark ? 'dark' : 'light'}>
            <header className="sj-top">
                <div className="sj-top-row">
                    <div className="sj-title">
                        <div className="sj-logo"><Icon name="users" size={24} /></div>
                        <div>
                            <h1>Quản lý Giáo viên</h1>
                            <p>Hồ sơ • Chuyên môn • Chủ nhiệm • Tải dạy • Lịch dạy • Nghỉ phép & dạy thay</p>
                        </div>
                    </div>
                    <div className="sj-top-act">
                        <select aria-label="Năm học" value={yearId} onChange={(e) => setYearId(Number(e.target.value))} disabled={!meta}>
                            {meta?.years.map((y) => <option key={y.id} value={y.id}>Năm học {y.label}{y.is_current ? ' • hiện tại' : ''}</option>)}
                        </select>
                        <button className="sj-ibtn" onClick={() => setDark((d) => !d)} title={dark ? 'Giao diện sáng' : 'Giao diện tối'}><Icon name={dark ? 'sun' : 'moon'} /></button>
                        <button className="sj-ibtn" onClick={toggleFull} title={full ? 'Thoát toàn màn hình' : 'Toàn màn hình'}><Icon name={full ? 'shrink' : 'expand'} /></button>
                        <button className="sj-btn primary" onClick={openCreate} disabled={!meta}><Icon name="plus" size={16} /> Thêm giáo viên</button>
                    </div>
                </div>
                <nav className="sj-tabs" role="tablist">
                    {TABS.map((t) => (
                        <button key={t.key} role="tab" aria-selected={tab === t.key} className={`sj-tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
                            <Icon name={t.icon} size={16} /> {t.label}
                            {t.key === 'integrity' && health !== null && health < 100 && <span className="sj-pill">{health}</span>}
                        </button>
                    ))}
                </nav>
            </header>

            <main className="sj-body" key={tab + yearId}>
                {!ctx ? (
                    <div className="sj-grid sj-g3">{[0, 1, 2].map((i) => <div key={i} className="sj-card"><div className="sj-skel" style={{ height: 90 }} /></div>)}</div>
                ) : (
                    <>
                        {tab === 'overview' && <OverviewTab ctx={ctx} />}
                        {tab === 'list' && <ListTab ctx={ctx} pendingCreate={pendingCreate} onConsumed={consumed} openId={openId} onOpened={consumedOpen} />}
                        {tab === 'supply' && <SupplyTab ctx={ctx} />}
                        {tab === 'homeroom' && <HomeroomTab ctx={ctx} />}
                        {tab === 'workload' && <WorkloadTab ctx={ctx} />}
                        {tab === 'schedule' && <ScheduleTab ctx={ctx} />}
                        {tab === 'leaves' && <LeaveTab ctx={ctx} />}
                        {tab === 'integrity' && <IntegrityTab ctx={ctx} />}
                        {tab === 'audit' && <AuditTab />}
                    </>
                )}
            </main>
        </div>
    );
}

export default function TeachersPage() {
    return (
        <ToastProvider>
            <ConfirmProvider>
                <Shell />
            </ConfirmProvider>
        </ToastProvider>
    );
}