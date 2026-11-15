'use client';

import { useCallback, useEffect, useState } from 'react';
import s from './categories.module.css';
import Icon from './components/Icon';
import { FeedbackProvider } from './components/Feedback';
import { TABS } from './constants';
import AuditTab from './tabs/AuditTab';
import DepartmentsTab from './tabs/DepartmentsTab';
import LookupsTab from './tabs/LookupsTab';
import OverviewTab from './tabs/OverviewTab';
import RoomsTab from './tabs/RoomsTab';
import SubjectsTab from './tabs/SubjectsTab';
import UsersTab from './tabs/UsersTab';
import RolesTab from './tabs/RolesTab';
import type { TabId } from './types';

const STORAGE_KEY = 'admin.categories.tab';

function Content() {
    const [tab, setTab] = useState<TabId>('overview');
    // Mỗi lần dữ liệu thay đổi ở một tab, tăng token để các tab khác (tổng quan, nhật ký, danh sách tổ…) tải lại khi mở.
    const [version, setVersion] = useState(0);

    useEffect(() => {
        try {
            const saved = window.localStorage.getItem(STORAGE_KEY) as TabId | null;
            if (saved && TABS.some((t) => t.id === saved)) setTab(saved);
        } catch { /* trình duyệt chặn localStorage — bỏ qua */ }
    }, []);

    const go = useCallback((id: TabId) => {
        setTab(id);
        try { window.localStorage.setItem(STORAGE_KEY, id); } catch { /* bỏ qua */ }
    }, []);

    const mutated = useCallback(() => setVersion((v) => v + 1), []);
    const current = TABS.find((t) => t.id === tab)!;

    return (
        <div className={s.root}>
            <header className={s.hero}>
                <div className={s.heroText}>
                    <span className={s.eyebrow}><Icon name="sparkle" size={14} /> Quản trị hệ thống</span>
                    <h1>Danh mục hệ thống</h1>
                    <p>Nguồn dữ liệu gốc dùng chung cho toàn bộ phân hệ: môn học, tổ chuyên môn, phòng học và các danh mục tra cứu. Mọi thay đổi đều được ghi nhật ký và có thể khôi phục.</p>
                </div>
            </header>

            <nav className={s.tabs} role="tablist" aria-label="Nhóm danh mục">
                {TABS.map((t) => (
                    <button key={t.id} role="tab" aria-selected={tab === t.id} className={`${s.tab} ${tab === t.id ? s.tabOn : ''}`} onClick={() => go(t.id)}>
                        <Icon name={t.icon} size={17} />
                        <span>{t.label}</span>
                    </button>
                ))}
            </nav>
            <p className={s.tabHint}>{current.hint}</p>

            <div role="tabpanel" className={s.tabPanel} key={tab}>
                {tab === 'overview' && <OverviewTab onNavigate={go} refreshToken={version} />}
                {tab === 'users' && <UsersTab onMutated={mutated} refreshToken={version} />}
                {tab === 'roles' && <RolesTab onMutated={mutated} />}
                {tab === 'subjects' && <SubjectsTab onMutated={mutated} refreshToken={0} />}
                {tab === 'departments' && <DepartmentsTab onMutated={mutated} refreshToken={0} />}
                {tab === 'rooms' && <RoomsTab onMutated={mutated} refreshToken={0} />}
                {tab === 'lookups' && <LookupsTab onMutated={mutated} refreshToken={0} />}
                {tab === 'audit' && <AuditTab onMutated={mutated} refreshToken={version} />}
            </div>
        </div>
    );
}

export default function CategoriesPage() {
    return (
        <FeedbackProvider>
            <Content />
        </FeedbackProvider>
    );
}