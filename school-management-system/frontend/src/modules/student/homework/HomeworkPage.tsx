'use client';

import { useCallback, useEffect, useState } from 'react';
import s from './homework.module.css';
import { homeworkService, errorMessage, type HomeworkItem, type Meta, type Status, type Summary } from './api';
import { ToastProvider, useToast } from './Toast';
import MiniCalendar from './MiniCalendar';
import DetailDrawer from './DetailDrawer';
import PenScore from './PenScore';
import { dueLabel, fmtDate, fmtDateTime, fmtScore, pad, STATUS_LABEL, TYPE_LABEL } from './utils';

type Tab = 'all' | Status;
type Sort = 'due' | 'newest' | 'subject';
const TABS: { key: Tab; label: string }[] = [
    { key: 'all', label: 'Tất cả' }, { key: 'todo', label: 'Cần làm' }, { key: 'overdue', label: 'Quá hạn' },
    { key: 'returned', label: 'Làm lại' }, { key: 'submitted', label: 'Chờ chấm' }, { key: 'graded', label: 'Đã chấm' },
];

export default function HomeworkPage({ className = '' }: { className?: string }) {
    return (
        <div className={`${s.root} ${className}`}>
            <ToastProvider><Content /></ToastProvider>
        </div>
    );
}

function Content() {
    const toast = useToast();
    const [summary, setSummary] = useState<Summary | null>(null);
    const [subjects, setSubjects] = useState<{ id: number; name: string }[]>([]);
    const [upcoming, setUpcoming] = useState<HomeworkItem[]>([]);
    const [items, setItems] = useState<HomeworkItem[]>([]);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [tab, setTab] = useState<Tab>('all');
    const [subject, setSubject] = useState(0);
    const [sort, setSort] = useState<Sort>('due');
    const [starred, setStarred] = useState(false);
    const [q, setQ] = useState('');
    const [qDeb, setQDeb] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openId, setOpenId] = useState<number | null>(null);
    const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
    const [cal, setCal] = useState<HomeworkItem[]>([]);
    const [day, setDay] = useState<string | null>(null);
    const [dismissed, setDismissed] = useState<string[]>([]);

    const monthKey = `${month.getFullYear()}-${pad(month.getMonth() + 1)}`;

    useEffect(() => { const t = setTimeout(() => { setQDeb(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);

    const loadList = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const r = await homeworkService.list({
                status: tab === 'all' ? undefined : tab, subject_id: subject || undefined, q: qDeb || undefined,
                sort, starred: starred ? 1 : undefined, page, per_page: 10,
            });
            setItems(r.items); setMeta(r.meta);
        } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
    }, [tab, subject, qDeb, sort, starred, page]);

    const loadSide = useCallback(async () => {
        try {
            const [sm, up] = await Promise.all([homeworkService.summary(), homeworkService.list({ status: 'todo', sort: 'due', per_page: 5 })]);
            setSummary(sm); setUpcoming(up.items);
        } catch (e) { toast.push('error', 'Không tải được tổng quan', errorMessage(e)); }
    }, [toast]);

    const loadCal = useCallback(() => { homeworkService.calendar(monthKey).then(setCal).catch(() => setCal([])); }, [monthKey]);

    useEffect(() => { loadList(); }, [loadList]);
    useEffect(() => { loadSide(); homeworkService.subjects().then(setSubjects).catch(() => {}); }, [loadSide]);
    useEffect(() => { loadCal(); }, [loadCal]);

    const refreshAll = () => { loadList(); loadSide(); loadCal(); };
    const filtered = tab !== 'all' || subject !== 0 || qDeb !== '' || starred;
    const resetFilters = () => { setTab('all'); setSubject(0); setQ(''); setQDeb(''); setStarred(false); setPage(1); };
    const pick = (t: Tab) => { setTab(t); setPage(1); };

    const toggleStar = async (it: HomeworkItem) => {
        const next = !it.starred;
        setItems((a) => a.map((x) => (x.id === it.id ? { ...x, starred: next } : x)));
        try { await homeworkService.saveState(it.id, { starred: next }); }
        catch (e) {
            setItems((a) => a.map((x) => (x.id === it.id ? { ...x, starred: !next } : x)));
            toast.push('error', 'Chưa đánh dấu được bài', errorMessage(e));
        }
    };

    const alerts = (summary?.alerts ?? []).filter((a) => !dismissed.includes(a.id)).slice(0, 4);
    const dayItems = day ? cal.filter((i) => i.due_at.slice(0, 10) === day) : [];
    const c = summary?.counts;

    return (
        <>
            <header className={s.head}>
                <div>
                    <h1 className={s.title}>Bài tập</h1>
                    <p className={s.sub}>
                        {summary?.class ? `Lớp ${summary.class}. ` : ''}
                        {summary ? (summary.due_soon > 0 ? `${summary.due_soon} bài cần nộp trong 48 giờ tới.` : 'Không có bài nào đến hạn trong 48 giờ tới.') : 'Đang tải dữ liệu…'}
                    </p>
                </div>
                <label className={s.search}>
                    <span className={s.srOnly}>Tìm bài tập</span>
                    <input type="search" placeholder="Tìm theo tên bài hoặc môn" value={q} onChange={(e) => setQ(e.target.value)} />
                </label>
            </header>

            {alerts.length > 0 && (
                <section className={s.alerts} aria-label="Thông báo bài tập">
                    {alerts.map((a) => (
                        <div key={a.id} className={`${s.alert} ${s['alert_' + a.kind]}`}>
                            <button type="button" className={s.alertText} onClick={() => setOpenId(a.homework_id)}>{a.text}</button>
                            <button type="button" className={s.alertX} aria-label="Ẩn thông báo này" onClick={() => setDismissed((d) => [...d, a.id])}>×</button>
                        </div>
                    ))}
                </section>
            )}

            <section className={s.ledger} aria-label="Tổng quan bài tập">
                {([['todo', 'Cần làm'], ['overdue', 'Quá hạn'], ['submitted', 'Chờ chấm'], ['graded', 'Đã chấm']] as [Status, string][]).map(([k, label]) => (
                    <button key={k} type="button" className={`${s.ledgerItem} ${tab === k ? s.ledgerOn : ''}`} onClick={() => pick(tab === k ? 'all' : k)}>
                        <span className={`${s.ledgerNum} ${k === 'overdue' && (c?.overdue ?? 0) > 0 ? s.numLate : ''}`}>{c ? c[k] : '–'}</span>
                        <span className={s.ledgerLabel}>{label}</span>
                    </button>
                ))}
                <div className={s.ledgerItem}>
                    <span className={s.ledgerNum}>{summary?.avg_score != null ? fmtScore(summary.avg_score) : '–'}</span>
                    <span className={s.ledgerLabel}>Điểm trung bình (thang 10)</span>
                </div>
            </section>

            <div className={s.layout}>
                <main className={s.main}>
                    <div className={s.tabs} role="tablist" aria-label="Lọc theo trạng thái">
                        {TABS.map((t) => (
                            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                                    className={`${s.tab} ${tab === t.key ? s.tabOn : ''}`} onClick={() => pick(t.key)}>
                                {t.label}{c && t.key !== 'all' ? <span className={s.tabN}>{c[t.key]}</span> : null}
                            </button>
                        ))}
                    </div>

                    <div className={s.toolbar}>
                        <label>
                            <span className={s.srOnly}>Môn học</span>
                            <select value={subject} onChange={(e) => { setSubject(Number(e.target.value)); setPage(1); }}>
                                <option value={0}>Tất cả môn</option>
                                {subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                            </select>
                        </label>
                        <label>
                            <span className={s.srOnly}>Sắp xếp</span>
                            <select value={sort} onChange={(e) => { setSort(e.target.value as Sort); setPage(1); }}>
                                <option value="due">Việc gấp trước</option>
                                <option value="newest">Mới giao trước</option>
                                <option value="subject">Theo môn</option>
                            </select>
                        </label>
                        <button type="button" className={`${s.starFilter} ${starred ? s.starFilterOn : ''}`} aria-pressed={starred} onClick={() => { setStarred(!starred); setPage(1); }}>
                            {starred ? '★' : '☆'} Đã gắn sao
                        </button>
                        {filtered && <button type="button" className={s.linkBtn} onClick={resetFilters}>Xóa bộ lọc</button>}
                    </div>

                    {error ? (
                        <div className={s.empty} role="alert">
                            <h2>Chưa tải được danh sách</h2>
                            <p>{error}</p>
                            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={loadList}>Tải lại</button>
                        </div>
                    ) : loading && items.length === 0 ? (
                        <ul className={s.list} aria-busy="true">{[0, 1, 2, 3].map((i) => <li key={i} className={s.skeleton} />)}</ul>
                    ) : items.length === 0 ? (
                        <div className={s.empty}>
                            <h2>{filtered ? 'Không có bài nào khớp bộ lọc' : 'Chưa có bài tập nào'}</h2>
                            <p>{filtered ? 'Thử đổi môn học hoặc từ khóa tìm kiếm.' : 'Khi giáo viên giao bài, bài tập sẽ hiện ở đây.'}</p>
                            {filtered && <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={resetFilters}>Xóa bộ lọc</button>}
                        </div>
                    ) : (
                        <ul className={`${s.list} ${loading ? s.listBusy : ''}`}>
                            {items.map((it) => <Row key={it.id} it={it} onOpen={() => setOpenId(it.id)} onStar={() => toggleStar(it)} />)}
                        </ul>
                    )}

                    {meta && meta.last_page > 1 && (
                        <nav className={s.pager} aria-label="Phân trang">
                            <button type="button" className={`${s.btn} ${s.btnGhost}`} disabled={page <= 1} onClick={() => setPage(page - 1)}>Trang trước</button>
                            <span>Trang {meta.current_page} / {meta.last_page}</span>
                            <button type="button" className={`${s.btn} ${s.btnGhost}`} disabled={page >= meta.last_page} onClick={() => setPage(page + 1)}>Trang sau</button>
                        </nav>
                    )}
                </main>

                <aside className={s.aside}>
                    <section className={s.panel}>
                        <h2 className={s.panelTitle}>Lịch hạn nộp</h2>
                        <MiniCalendar month={month} items={cal} selected={day} onSelect={setDay} onMonth={(d) => { setMonth(d); setDay(null); }} />
                        {day && (
                            <ul className={s.dayList}>
                                {dayItems.length === 0 && <li className={s.muted}>Không có bài đến hạn ngày {fmtDate(day)}.</li>}
                                {dayItems.map((i) => (
                                    <li key={i.id}><button type="button" onClick={() => setOpenId(i.id)}><span className={`${s.dot} ${s['dot_' + i.status]}`} />{i.subject}: {i.title}</button></li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className={s.panel}>
                        <h2 className={s.panelTitle}>Việc cần làm tiếp theo</h2>
                        {upcoming.length === 0 ? <p className={s.muted}>Em đã nộp hết các bài đang mở.</p> : (
                            <ul className={s.upList}>
                                {upcoming.map((i) => {
                                    const d = dueLabel(i.due_at);
                                    return (
                                        <li key={i.id}>
                                            <button type="button" onClick={() => setOpenId(i.id)}>
                                                <span className={s.upTitle}>{i.title}</span>
                                                <span className={`${s.due} ${s['due_' + d.tone]}`}>{d.text}</span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>

                    <section className={s.panel}>
                        <h2 className={s.panelTitle}>Tiến độ theo môn</h2>
                        {summary?.on_time_rate != null && <p className={s.muted}>Nộp đúng hạn: <strong>{summary.on_time_rate}%</strong> số bài đã nộp.</p>}
                        <ul className={s.subjList}>
                            {(summary?.by_subject ?? []).map((b) => (
                                <li key={b.subject_id}>
                                    <span>{b.subject}</span><span className={s.muted}>{b.done}/{b.total}</span>
                                    <span className={s.bar}><span className={s.barFill} style={{ width: `${b.total ? (b.done / b.total) * 100 : 0}%` }} /></span>
                                </li>
                            ))}
                        </ul>
                    </section>
                </aside>
            </div>

            {openId !== null && <DetailDrawer id={openId} onClose={() => setOpenId(null)} onChanged={refreshAll} />}
        </>
    );
}

function Row({ it, onOpen, onStar }: { it: HomeworkItem; onOpen: () => void; onStar: () => void }) {
    const open = it.status === 'todo' || it.status === 'overdue' || it.status === 'returned';
    const due = dueLabel(it.due_at);
    return (
        <li className={`${s.row} ${s['st_' + it.status]}`}>
            <button type="button" className={s.rowMain} onClick={onOpen}>
                <span className={s.rowTop}>
                    <span className={s.chip}>{it.subject}</span>
                    <span className={s.rowType}>{TYPE_LABEL[it.type] ?? 'Bài tập'}</span>
                    {it.priority === 'high' && <span className={s.hot}>Quan trọng</span>}
                </span>
                <span className={s.rowTitle}>{it.title}</span>
                <span className={s.rowMeta}>{it.teacher}. Hạn nộp {fmtDateTime(it.due_at)}</span>
                {it.status === 'todo' && it.progress > 0 && (
                    <span className={s.bar} title={`Em tự đánh giá đã làm ${it.progress}%`}><span className={s.barFill} style={{ width: `${it.progress}%` }} /></span>
                )}
            </button>
            <span className={s.rowSide}>
                {it.status === 'graded' && it.score !== null
                    ? <PenScore score={it.score} max={it.max_score} />
                    : open && <span className={`${s.due} ${s['due_' + due.tone]}`}>{due.text}</span>}
                {it.status !== 'todo' && !(it.status === 'graded' && it.score !== null) && <span className={`${s.badge} ${s['badge_' + it.status]}`}>{STATUS_LABEL[it.status]}{it.status === 'submitted' && it.is_late ? ' (muộn)' : ''}</span>}
                <button type="button" className={`${s.starBtn} ${it.starred ? s.starOn : ''}`} aria-pressed={it.starred}
                        aria-label={it.starred ? 'Bỏ gắn sao' : 'Gắn sao bài này'} onClick={onStar}>{it.starred ? '★' : '☆'}</button>
            </span>
        </li>
    );
}