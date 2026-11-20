'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import '@/modules/homeroom/awards/awards.css';
import '@/modules/teacher/exams/exams.css';
import { ConfirmProvider } from '@/modules/homeroom/awards/components/Overlay';
import { ToastProvider } from '@/modules/homeroom/awards/components/Toast';
import { Empty, PageSkeleton } from '@/modules/homeroom/awards/components/ui';
import { cx } from '@/modules/homeroom/awards/utils';
import AnalyticsView from '@/modules/teacher/exams/components/AnalyticsView';
import BankView from '@/modules/teacher/exams/components/BankView';
import CalendarView from '@/modules/teacher/exams/components/CalendarView';
import OverviewView from '@/modules/teacher/exams/components/OverviewView';
import PapersView from '@/modules/teacher/exams/components/PapersView';
import ScoreSheet from '@/modules/teacher/exams/components/ScoreSheet';
import TestForm, { emptyTest } from '@/modules/teacher/exams/components/TestForm';
import TestsView from '@/modules/teacher/exams/components/TestsView';
import X, { XName } from '@/modules/teacher/exams/components/xicons';
import { errMsg, examApi } from '@/modules/teacher/exams/examsService';
import type { Ctx, Meta, TestRow, TestFormState, ViewKey } from '@/modules/teacher/exams/types';

const EXAM_NAV: { key: ViewKey; label: string; icon: XName; sub: string }[] = [
    { key: 'overview', label: 'Tổng quan', icon: 'grid', sub: 'Việc cần làm và kết quả các lớp bạn dạy' },
    { key: 'calendar', label: 'Lịch kiểm tra', icon: 'calendar', sub: 'Lịch của nhà trường và các bài bạn tự tạo' },
    { key: 'tests', label: 'Bài kiểm tra & Nhập điểm', icon: 'clipboard', sub: 'Tạo bài, nhập điểm, đồng bộ vào sổ điểm' },
    { key: 'analytics', label: 'Phân tích kết quả', icon: 'chart', sub: 'Phân bố điểm, xu hướng và ma trận điểm cả lớp' },
    { key: 'bank', label: 'Ngân hàng câu hỏi', icon: 'database', sub: 'Soạn và quản lý câu hỏi theo môn, khối, độ khó' },
    { key: 'papers', label: 'Tạo đề & In đề', icon: 'file', sub: 'Tự động chọn câu theo ma trận độ khó' },
];

export default function TeacherExamsPage() {
    return (
        <div className="emu" data-theme="light">
            <ToastProvider><ConfirmProvider><ExamsApp /></ConfirmProvider></ToastProvider>
        </div>
    );
}

function ExamsApp() {
    const router = useRouter();
    const [meta, setMeta] = useState<Meta | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [view, setView] = useState<ViewKey>('overview');
    const [semester, setSemester] = useState<number | null>(null);
    const [tick, setTick] = useState(0);
    const [form, setForm] = useState<TestFormState | null>(null);
    const [sheetId, setSheetId] = useState<number | null>(null);
    const [focus, setFocus] = useState<{ class_id: number; subject_id: number; test_id: number } | null>(null);

    const loadMeta = useCallback(async () => {
        try { const m = await examApi.meta(); setMeta(m); setErr(null); setSemester((s) => (s === null ? m.current_semester : s)); }
        catch (e) { setErr(errMsg(e)); }
    }, []);
    useEffect(() => { loadMeta(); }, [loadMeta]);

    const refresh = useCallback(() => setTick((t) => t + 1), []);
    const go = useCallback((v: ViewKey) => setView(v), []);

    const ctx: Ctx | null = useMemo(() => (meta && semester !== null ? {
        meta, semester, tick, refresh, goto: go, openSheet: setSheetId,
        newTest: (preset) => setForm(emptyTest(meta, preset)),
        editTest: (t: TestRow) => setForm({
            id: t.id, class_id: t.class_id, subject_id: t.subject_id, title: t.title, kind: t.kind, grade_column: t.grade_column, test_date: t.test_date,
            start_time: t.start_time ?? '', duration_minutes: t.duration_minutes, max_score: t.max_score, paper_id: t.paper_id, note: t.note ?? '',
            status: t.status === 'draft' ? 'draft' : 'scheduled',
        }),
        analyzeTest: (t) => { setFocus({ class_id: t.class_id, subject_id: t.subject_id, test_id: t.id }); setSheetId(null); go('analytics'); },
    } : null), [meta, semester, tick, refresh, go]);

    if (err && !meta) {
        return (
            <div className="emu-card" style={{ maxWidth: 520, padding: 24, margin: '24px auto' }}>
                <div className="emu-banner"><X name="alert" /><div><b>Không mở được module Kiểm tra</b><div style={{ marginTop: 4 }}>{err}</div></div></div>
                <div className="emu-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}><button className="emu-btn" onClick={() => router.back()}>Quay lại</button><button className="emu-btn primary" onClick={loadMeta}>Thử lại</button></div>
            </div>
        );
    }

    const cur = EXAM_NAV.find((n) => n.key === view)!;

    return (
        <div className="ex-embed">
            <div className="ex-head">
                <div className="ex-head-ic"><X name="clipboard" size={22} /></div>
                <div style={{ minWidth: 0, flex: 1 }}><h1>Kiểm tra</h1><div className="emu-sub">{cur.sub}</div></div>
                {meta && semester !== null && (
                    <div className="emu-seg">{[...meta.semesters.map((s) => s.code), 0].map((c) => <button key={c} className={cx(semester === c && 'on')} onClick={() => setSemester(c)}>{c === 0 ? 'Cả năm' : `HK${c}`}</button>)}</div>
                )}
                <button className="emu-btn primary" onClick={() => meta && setForm(emptyTest(meta))}><X name="plus" size={15} /> Tạo bài kiểm tra</button>
            </div>

            <nav className="ex-tabs" aria-label="Chức năng kiểm tra">
                {EXAM_NAV.map((n) => (
                    <button key={n.key} className={cx('ex-tab', view === n.key && 'on')} onClick={() => go(n.key)}><X name={n.icon} size={16} />{n.label}</button>
                ))}
            </nav>

            <div>
                {!ctx && <PageSkeleton />}
                {ctx && meta!.assignments.length === 0 && <div className="emu-card"><Empty icon="users" title="Bạn chưa được phân công giảng dạy" text="Hãy nhờ Giáo vụ phân công lớp – môn cho bạn trong năm học hiện tại." /></div>}
                {ctx && meta!.assignments.length > 0 && (
                    <>
                        {view === 'overview' && <OverviewView ctx={ctx} />}
                        {view === 'calendar' && <CalendarView ctx={ctx} />}
                        {view === 'tests' && <TestsView ctx={ctx} />}
                        {view === 'analytics' && <AnalyticsView ctx={ctx} focus={focus} />}
                        {view === 'bank' && <BankView ctx={ctx} />}
                        {view === 'papers' && <PapersView ctx={ctx} />}
                    </>
                )}
            </div>

            {meta && <TestForm meta={meta} initial={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); refresh(); }} />}
            {ctx && sheetId !== null && <ScoreSheet ctx={ctx} id={sheetId} onClose={() => setSheetId(null)} onChanged={refresh} />}
        </div>
    );
}