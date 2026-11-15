'use client';

import { useCallback, useEffect, useState } from 'react';
import './subjects.css';
import Icon from './ui/Icon';
import { ToastProvider, useToast } from './ui/Toast';
import { ConfirmProvider } from './ui/Confirm';
import { errMsg, subjectApi } from './api';
import type { Meta, TabKey } from './types';
import OverviewTab from './tabs/OverviewTab';
import ListTab from './tabs/ListTab';
import GroupsTab from './tabs/GroupsTab';
import AssignmentTab from './tabs/AssignmentTab';
import WorkloadTab from './tabs/WorkloadTab';
import CurriculumTab from './tabs/CurriculumTab';
import AnalyticsTab from './tabs/AnalyticsTab';
import IntegrityTab from './tabs/IntegrityTab';
import AuditTab from './tabs/AuditTab';

export interface Ctx {
    meta: Meta; yearId: number; go: (t: TabKey) => void; refreshMeta: () => Promise<void>;
    openCreate: () => void; health: number | null; setHealth: (n: number | null) => void;
}

const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'overview', label: 'Tổng quan', icon: 'grid' },
    { key: 'list', label: 'Danh sách môn', icon: 'book' },
    { key: 'groups', label: 'Tổ bộ môn', icon: 'layers' },
    { key: 'assign', label: 'Phân công giảng dạy', icon: 'link' },
    { key: 'workload', label: 'Giáo viên & tải dạy', icon: 'users' },
    { key: 'curriculum', label: 'Chương trình & hệ số', icon: 'sliders' },
    { key: 'analytics', label: 'Thống kê điểm', icon: 'chart' },
    { key: 'integrity', label: 'Kiểm tra dữ liệu', icon: 'shield' },
    { key: 'audit', label: 'Nhật ký', icon: 'clock' },
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

    const loadMeta = useCallback(async () => {
        try {
            const m = await subjectApi.meta();
            setMeta(m);
            setYearId((y) => y || m.current_year_id);
            setErr('');
        } catch (e) { setErr(errMsg(e)); }
    }, []);

    useEffect(() => {
        loadMeta();
        try {
            setDark(localStorage.getItem('sj-theme') === 'dark');
            const t = localStorage.getItem('sj-tab') as TabKey | null;
            if (t && TABS.some((x) => x.key === t)) setTab(t);
        } catch { /* bỏ qua */ }
    }, [loadMeta]);

    useEffect(() => { try { localStorage.setItem('sj-theme', dark ? 'dark' : 'light'); } catch { /* */ } }, [dark]);
    useEffect(() => { try { localStorage.setItem('sj-tab', tab); } catch { /* */ } }, [tab]);
    useEffect(() => {
        const on = () => setFull(!!document.fullscreenElement || full);
        document.addEventListener('fullscreenchange', on);
        return () => document.removeEventListener('fullscreenchange', on);
    }, [full]);

    const toggleFull = async () => {
        const next = !full;
        setFull(next);
        try {
            if (next && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
            else if (!next && document.fullscreenElement) await document.exitFullscreen();
        } catch { /* trình duyệt từ chối: vẫn giữ chế độ phủ kín trang */ }
    };

    const go = (t: TabKey) => setTab(t);
    const openCreate = () => { setTab('list'); setPendingCreate(true); };
    const consumed = useCallback(() => setPendingCreate(false), []);
    const year = meta?.school_years.find((y) => y.id === yearId);

    if (err && !meta) {
        return (
            <div className="sj" data-theme={dark ? 'dark' : 'light'}>
                <div className="sj-body">
                    <div className="sj-errbox">
                        <Icon name="alert" size={30} />
                        <b>Không tải được module Môn học</b>
                        <p className="sj-muted">{err}</p>
                        <button className="sj-btn primary" onClick={() => { loadMeta(); toast.info('Đang thử kết nối lại…'); }}><Icon name="refresh" size={16} /> Thử lại</button>
                    </div>
                </div>
            </div>
        );
    }

    const ctx: Ctx | null = meta ? { meta, yearId, go, refreshMeta: loadMeta, openCreate, health, setHealth } : null;

    return (
        <div className={`sj ${full ? 'is-full' : ''}`} data-theme={dark ? 'dark' : 'light'}>
            <header className="sj-top">
                <div className="sj-top-row">
                    <div className="sj-title">
                        <div className="sj-logo"><Icon name="book" size={24} /></div>
                        <div>
                            <h1>Quản lý Môn học</h1>
                            <p>Danh mục môn • Tổ bộ môn • Phân công giảng dạy • Chương trình & hệ số điểm</p>
                        </div>
                    </div>
                    <div className="sj-top-act">
                        <select aria-label="Năm học" value={yearId} onChange={(e) => setYearId(Number(e.target.value))} disabled={!meta}>
                            {meta?.school_years.map((y) => <option key={y.id} value={y.id}>Năm học {y.label}{y.is_current ? ' • hiện tại' : ''}</option>)}
                        </select>
                        <button className="sj-ibtn" onClick={() => setDark((d) => !d)} title={dark ? 'Giao diện sáng' : 'Giao diện tối'}><Icon name={dark ? 'sun' : 'moon'} /></button>
                        <button className="sj-ibtn" onClick={toggleFull} title={full ? 'Thoát toàn màn hình' : 'Toàn màn hình'}><Icon name={full ? 'shrink' : 'expand'} /></button>
                        <button className="sj-btn primary" onClick={openCreate} disabled={!meta}><Icon name="plus" size={16} /> Thêm môn học</button>
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
                        {tab === 'list' && <ListTab ctx={ctx} pendingCreate={pendingCreate} onConsumed={consumed} />}
                        {tab === 'groups' && <GroupsTab ctx={ctx} />}
                        {tab === 'assign' && <AssignmentTab ctx={ctx} />}
                        {tab === 'workload' && <WorkloadTab ctx={ctx} />}
                        {tab === 'curriculum' && <CurriculumTab ctx={ctx} />}
                        {tab === 'analytics' && <AnalyticsTab ctx={ctx} />}
                        {tab === 'integrity' && <IntegrityTab ctx={ctx} />}
                        {tab === 'audit' && <AuditTab />}
                    </>
                )}
            </main>
            {year && <span style={{ display: 'none' }}>{year.label}</span>}
        </div>
    );
}

export default function SubjectsPage() {
    return (
        <ToastProvider>
            <ConfirmProvider>
                <Shell />
            </ConfirmProvider>
        </ToastProvider>
    );
}