'use client';

import '@/app/bgh/rewards/rewards.css';
import './lessonlog.css';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { errMsg, getToken, logApi } from '@/modules/teacher/lessonlog/service';
import type { EntryTarget, Meta, View, ViewProps } from '@/modules/teacher/lessonlog/types';
import { addDays } from '@/modules/teacher/lessonlog/util';
import { Icon, Skeleton, UIProvider } from '@/app/bgh/rewards/ui';
import Overview from './views/Overview';
import WeekBook from './views/WeekBook';
import Progress from './views/Progress';
import Attendance from './views/Attendance';
import Notes, { NoteModal } from './views/Notes';
import Reviews from './views/Reviews';
import School from './views/School';
import Logs from './views/Logs';
import EntryModal from './EntryModal';

const TAB: Record<View, { i: string; l: string; t: string }> = {
    school: { i: 'users', l: 'Toàn trường', t: 'Tiến độ ghi sổ toàn trường' },
    overview: { i: 'home', l: 'Tổng quan', t: 'Tổng quan sổ đầu bài' },
    week: { i: 'list', l: 'Sổ tuần', t: 'Sổ đầu bài theo tuần' },
    progress: { i: 'flag', l: 'Tiến độ chương trình', t: 'Tiến độ chương trình theo môn' },
    attendance: { i: 'user', l: 'Chuyên cần', t: 'Chuyên cần và học sinh vắng' },
    notes: { i: 'star', l: 'Nề nếp', t: 'Sổ theo dõi nề nếp' },
    reviews: { i: 'award', l: 'Ký & duyệt tuần', t: 'Ký sổ và duyệt theo tuần' },
    logs: { i: 'log', l: 'Nhật ký', t: 'Nhật ký thao tác' },
};

function Shell() {
    const router = useRouter();
    const [meta, setMeta] = useState<Meta | null>(null);
    const [err, setErr] = useState('');
    const [yearId, setYearId] = useState<number | undefined>();
    const [classId, setClassId] = useState(0);
    const [date, setDate] = useState('');
    const [view, setView] = useState<View | null>(null);
    const [rev, setRev] = useState(0);
    const [entry, setEntry] = useState<EntryTarget | null>(null);
    const [noteOpen, setNoteOpen] = useState(false);

    useEffect(() => {
        if (!getToken()) { router.replace('/login'); return; }
        setErr('');
        logApi.meta(yearId).then((m) => {
            setMeta(m);
            setClassId((c) => (c && m.classes.some((x) => x.id === c) ? c : (m.classes.find((x) => x.is_mine) ?? m.classes[0])?.id ?? 0));
            setDate((d) => d || m.default_date);
            setView((v) => v ?? (m.me.is_bgh ? 'school' : 'overview'));
        }).catch((e) => {
            if (e?.response?.status === 401) router.replace('/login');
            else setErr(errMsg(e));
        });
    }, [yearId, router]);

    const changed = useCallback(() => setRev((r) => r + 1), []);
    if (err) return <div className="rw"><div className="rw-main"><main className="rw-content"><div className="rw-err"><Icon n="alert" />{err}</div></main></div></div>;
    if (!meta || !date || !view) return <div className="rw"><div className="rw-main"><main className="rw-content"><Skeleton h={260} /></main></div></div>;

    const cls = meta.classes.find((c) => c.id === classId);
    const isHomeroom = !!cls?.is_mine;
    const tabs: View[] = meta.me.is_bgh ? ['school', 'overview', 'week', 'progress', 'attendance', 'notes', 'reviews', 'logs'] : ['overview', 'week', 'progress', 'attendance', 'notes', 'reviews', 'logs'];
    const go = (v: View) => setView(v);
    const props: ViewProps = {
        meta, classId, date, rev, isHomeroom, setDate, setClass: setClassId, go, changed,
        openEntry: (s) => setEntry(s), openNote: () => setNoteOpen(true),
    };
    const needClass = view !== 'school';

    return (
        <div className="rw">
            <div className="rw-main">
                <header className="rw-top">
                    <div>
                        <h1>{TAB[view].t}</h1>
                        <div className="hint">
                            {needClass && cls ? <>Lớp {cls.name}{cls.homeroom_name ? ` · GVCN ${cls.homeroom_name}` : ''} · </> : null}Năm học {meta.year.label}
                        </div>
                    </div>
                    <span className="spacer" />
                    <div className="ll-ctl">
                        {needClass && meta.classes.length > 0 && (
                            <select value={classId} onChange={(e) => setClassId(Number(e.target.value))} aria-label="Chọn lớp">
                                {meta.classes.map((c) => <option key={c.id} value={c.id}>Lớp {c.name}{c.is_mine ? ' (chủ nhiệm)' : ''}</option>)}
                            </select>
                        )}
                        {meta.years.length > 1 && (
                            <select value={yearId ?? meta.year.id} onChange={(e) => { setYearId(Number(e.target.value)); setDate(''); setClassId(0); }} aria-label="Năm học">
                                {meta.years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
                            </select>
                        )}
                        {view !== 'logs' && (
                            <div className="ll-wk" role="group" aria-label="Chọn tuần">
                                <button onClick={() => setDate(addDays(date, -7))} aria-label="Tuần trước"><Icon n="back" s={16} /></button>
                                <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Ngày trong tuần" style={{ border: 0, background: 'transparent' }} />
                                <button onClick={() => setDate(addDays(date, 7))} aria-label="Tuần sau" style={{ transform: 'scaleX(-1)' }}><Icon n="back" s={16} /></button>
                                <button onClick={() => setDate(meta.default_date)}>Gần nhất</button>
                            </div>
                        )}
                        <button className="icon-btn" onClick={changed} title="Tải lại" aria-label="Tải lại"><Icon n="refresh" /></button>
                    </div>
                </header>

                <nav className="rw-tabs" aria-label="Chức năng sổ đầu bài">
                    {tabs.map((k) => (
                        <button key={k} className={view === k ? 'on' : ''} onClick={() => go(k)} aria-current={view === k ? 'page' : undefined}>
                            <Icon n={TAB[k].i} s={17} />{TAB[k].l}
                        </button>
                    ))}
                </nav>

                <main className="rw-content">
                    {needClass && !classId ? (
                        <div className="rw-err"><Icon n="info" />Tài khoản của bạn chưa được phân công lớp nào trong năm học này.</div>
                    ) : (
                        <>
                            {view === 'school' && <School {...props} />}
                            {view === 'overview' && <Overview {...props} />}
                            {view === 'week' && <WeekBook {...props} />}
                            {view === 'progress' && <Progress {...props} />}
                            {view === 'attendance' && <Attendance {...props} />}
                            {view === 'notes' && <Notes {...props} />}
                            {view === 'reviews' && <Reviews {...props} />}
                            {view === 'logs' && <Logs {...props} />}
                        </>
                    )}
                </main>
            </div>

            {entry && <EntryModal classId={classId} target={entry} onClose={() => setEntry(null)} onSaved={() => { setEntry(null); changed(); }} />}
            {noteOpen && <NoteModal meta={meta} classId={classId} date={date} onClose={() => setNoteOpen(false)} onSaved={() => { setNoteOpen(false); changed(); }} />}
        </div>
    );
}

export default function LessonLogApp() {
    return (
        <UIProvider>
            <Shell />
        </UIProvider>
    );
}