'use client';

import { useCallback, useEffect, useState } from 'react';
import { ll } from '../_lib/api';
import { LlError } from '../_lib/http';
import { ToastProvider } from '../_lib/toast';
import type { Meta } from '../_lib/types';
import { Icon, num } from './ui';
import ConnectionPanel from './ConnectionPanel';
import Dashboard from './Dashboard';
import WeekGrid from './WeekGrid';
import EntryList from './EntryList';
import EntryForm from './EntryForm';
import type { FormInit } from './EntryForm';
import EntryDrawer from './EntryDrawer';
import '../lesson-log.css';

type Tab = 'overview' | 'week' | 'mine' | 'all';
const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Tổng quan', icon: 'layers2' },
    { id: 'week', label: 'Sổ tuần', icon: 'calendar' },
    { id: 'mine', label: 'Nhật ký của tôi', icon: 'pen' },
    { id: 'all', label: 'Tất cả bản ghi', icon: 'list' },
];

interface LessonLogHubProps {
    mode?: 'teacher' | 'homeroom';
}

function Inner({ mode }: LessonLogHubProps) {
    const [meta, setMeta] = useState<Meta | null>(null);
    const [error, setError] = useState<{ message: string; status?: number } | null>(null);
    const [tab, setTab] = useState<Tab>(mode === 'homeroom' ? 'week' : 'overview');
    const [classId, setClassId] = useState<number | null>(null);
    const [weekDate, setWeekDate] = useState('');
    const [form, setForm] = useState<FormInit | null>(null);
    const [drawer, setDrawer] = useState<number | null>(null);
    const [tick, setTick] = useState(0);
    const [drafts, setDrafts] = useState(0);
    const [mineStatus, setMineStatus] = useState('');

    const isHr = mode === 'homeroom' || meta?.me?.role === 'homeroom_teacher';

    const load = useCallback(async () => {
        setError(null);
        try {
            const m = await ll.meta();
            setMeta(m);
            setWeekDate((d) => d || m.today);
            setClassId((c) => {
                if (c) return c;
                const saved = Number(localStorage.getItem('ll_class'));
                // Nếu là GVCN hoặc trang homeroom, ưu tiên chọn lớp chủ nhiệm
                const hrClass = m.me.homeroom_class_ids[0];
                if (mode === 'homeroom' && hrClass) return hrClass;
                return hrClass ?? (m.classes.some((x) => x.id === saved) ? saved : m.classes[0]?.id ?? null);
            });
        } catch (e) { setError({ message: e instanceof Error ? e.message : 'Không tải được dữ liệu.', status: e instanceof LlError ? e.status : undefined }); }
    }, [mode]);
    useEffect(() => { load(); }, [load]);

    const countDrafts = useCallback(() => { ll.list({ mine: true, status: 'draft', per_page: 5 }).then((r) => setDrafts(r.meta?.total ?? 0)).catch(() => {}); }, []);
    useEffect(() => { if (meta) countDrafts(); }, [meta, tick, countDrafts]);

    const changed = () => setTick((t) => t + 1);
    const pickClass = (id: number) => { setClassId(id); try { localStorage.setItem('ll_class', String(id)); } catch { /* bỏ qua */ } };
    const goWeek = (cid: number, date: string) => { pickClass(cid); setWeekDate(date); setTab('week'); };

    return (
        <div className="ll">
            <section className="ll-hero">
                <i className="ll-orb o1" /><i className="ll-orb o2" /><i className="ll-orb o3" />
                <div className="ll-hero-content">
                    <div className="ll-hero-badge">
                        <span className="ll-hero-dot" />
                        <span>TRƯỜNG THPT NGÔ SĨ LIÊN</span>
                        <span className="ll-hero-sep">·</span>
                        <span className="ll-hero-subtag">{isHr ? 'CỔNG GIÁO VIÊN CHỦ NHIỆM' : 'CHƯƠNG TRÌNH GDPT 2018'}</span>
                    </div>
                    <h1 className="ll-hero-title">
                        {isHr ? 'Sổ Đầu Bài Lớp Chủ Nhiệm ' : 'Sổ Đầu Bài Điện Tử '}
                        <span className="ll-hero-highlight">{isHr ? 'Theo dõi & Xác nhận tuần' : 'Hệ thống số hóa'}</span>
                    </h1>
                    <p className="ll-hero-desc">
                        {isHr
                            ? 'Theo dõi tiến độ giảng dạy các bộ môn, kiểm tra sĩ số chuyên cần, xem nhận xét xếp loại từng tiết học và xác nhận sổ đầu bài theo tuần của lớp chủ nhiệm.'
                            : 'Ghi nhận tiến độ giảng dạy, chuyên cần, xếp loại tiết học; ký số trực tuyến, GVCN xác nhận theo tuần và Ban Giám hiệu theo dõi toàn trường.'}
                    </p>
                    <div className="ll-hero-meta">
                        <span className="ll-hero-tag"><Icon n="calendar" s={14} /> Năm học 2026 – 2027</span>
                        <span className="ll-hero-tag"><Icon n="clock" s={14} /> Học kỳ I</span>
                        {isHr && <span className="ll-hero-tag ok"><Icon n="layers2" s={14} /> Lớp chủ nhiệm</span>}
                        <span className="ll-hero-tag ok"><Icon n="check" s={14} /> Ký số & Xác nhận tuần trực tuyến</span>
                    </div>
                </div>
                <div className="ll-actions">
                    <button className="ll-btn ll-btn-primary" disabled={!meta} onClick={() => setForm({ class_id: classId, date: meta?.today ?? '', period: null })}>
                        <Icon n="plus" s={16} />
                        <span>Ghi sổ tiết học</span>
                    </button>
                    <button className="ll-btn ll-btn-secondary" onClick={() => { load(); changed(); }}>
                        <Icon n="history" s={16} />
                        <span>Làm mới</span>
                    </button>
                </div>
            </section>

            {error && <ConnectionPanel message={error.message} status={error.status} onRetry={load} />}
            {!meta && !error && <div className="ll-loading"><i className="ll-spin" />Đang tải…</div>}

            {meta && !error && (
                <>
                    {drafts > 0 && (
                        <div className="ll-banner" role="status">
                            <Icon n="alert" s={18} /><span>Bạn còn <b>{num(drafts)}</b> tiết chưa ký sổ. Hãy hoàn thiện trong {meta.edit_days} ngày kể từ ngày dạy.</span>
                            <button className="ll-btn ghost sm" onClick={() => { setMineStatus('draft'); setTab('mine'); }}>Xem ngay</button>
                        </div>
                    )}
                    <nav className="ll-tabs" role="tablist">
                        {TABS.map((t) => (
                            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => { if (t.id === 'mine') setMineStatus(''); setTab(t.id); }}>
                                <Icon n={t.icon} s={16} />
                                <span>{t.label}</span>
                                {t.id === 'mine' && drafts > 0 && <span className="ll-tab-badge">{drafts}</span>}
                            </button>
                        ))}
                    </nav>

                    {tab === 'overview' && <Dashboard meta={meta} tick={tick} onOpen={setDrawer} onWeek={goWeek} />}
                    {tab === 'week' && classId && (
                        <WeekGrid meta={meta} classId={classId} setClassId={pickClass} date={weekDate} setDate={setWeekDate} tick={tick}
                                  onOpen={setDrawer} onCreate={setForm} onChanged={changed} />
                    )}
                    {tab === 'mine' && <EntryList key={`m${tick}${mineStatus}`} meta={meta} mine initStatus={mineStatus} onOpen={setDrawer} />}
                    {tab === 'all' && <EntryList key={`a${tick}`} meta={meta} mine={false} initStatus="" onOpen={setDrawer} />}
                </>
            )}

            {drawer !== null && meta && (
                <EntryDrawer id={drawer} meta={meta} onClose={() => setDrawer(null)} onChanged={changed}
                             onEdit={(init) => { setDrawer(null); setForm(init); }} />
            )}
            {form && meta && <EntryForm meta={meta} init={form} onClose={() => setForm(null)} onSaved={(id) => { setForm(null); changed(); setDrawer(id); }} />}
        </div>
    );
}

export default function LessonLogHub({ mode }: LessonLogHubProps = {}) {
    return (
        <ToastProvider>
            <Inner mode={mode} />
        </ToastProvider>
    );
}