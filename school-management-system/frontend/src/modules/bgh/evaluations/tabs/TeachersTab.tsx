'use client';

import { useCallback, useEffect, useState } from 'react';
import s from '../../logs/logs.module.css';
import e from '../evaluations.module.css';
import { Empty, ErrorBox, Skeleton, useAsync } from '../../logs/components/ui';
import { fmtDate } from '../../logs/format';
import { evApi } from '../api';
import { Avatar, Progress, RatingChip, SearchBox, Tone, useDebounced } from '../components/bits';
import { useEv } from '../components/ctx';
import { RATING, score } from '../format';
import type { TeacherRow } from '../types';

export default function TeachersTab() {
    const ev = useEv();
    const [q, setQ] = useState(''); const dq = useDebounced(q);
    const [subject, setSubject] = useState(''); const [coverage, setCoverage] = useState(''); const [rating, setRating] = useState('');
    const [sort, setSort] = useState('name'); const [dir, setDir] = useState('asc');
    const st = useAsync<{ items: TeacherRow[]; min_required: number; total: number }>();
    const load = useCallback(() => st.run(() => evApi.teachers({ year: ev.year, semester: ev.semester, q: dq, subject_id: subject, coverage, rating, sort, dir })), [ev.year, ev.semester, dq, subject, coverage, rating, sort, dir]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, [load, ev.tick]);
    const sortBy = (k: string, d = 'desc') => { if (sort === k) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(k); setDir(d); } };
    const arrow = (k: string) => (sort === k ? (dir === 'asc' ? ' ▲' : ' ▼') : '');
    const min = st.data?.min_required ?? 1;

    return (
        <div className={s.stack}>
            <div className={e.toolbar}>
                <SearchBox value={q} onChange={setQ} placeholder="Tìm tên hoặc mã giáo viên…" />
                <select className={s.field} value={subject} onChange={(x) => setSubject(x.target.value)} aria-label="Tổ / môn"><option value="">Mọi tổ / môn</option>{ev.lk.subjects.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                <select className={s.field} value={coverage} onChange={(x) => setCoverage(x.target.value)} aria-label="Số lượt dự giờ">
                    <option value="">Mọi mức dự giờ</option><option value="none">Chưa được dự giờ</option><option value="below">Chưa đủ số lượt tối thiểu</option><option value="ok">Đã đủ số lượt</option>
                </select>
                <select className={s.field} value={rating} onChange={(x) => setRating(x.target.value)} aria-label="Xếp loại gần nhất"><option value="">Mọi xếp loại gần nhất</option>{Object.entries(RATING).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
            </div>
            {st.error ? <ErrorBox message={st.error} onRetry={load} /> : !st.data ? <Skeleton h={420} /> : st.data.items.length === 0 ? <div className={s.card}><Empty icon="users" title="Không có giáo viên phù hợp" /></div> : (
                <div className={s.card} style={{ padding: 0 }}>
                    <div className={s.tableWrap} style={{ border: 0 }}>
                        <table className={s.table}>
                            <thead><tr><th className={s.sortable} onClick={() => sortBy('name', 'asc')}>Giáo viên{arrow('name')}</th><th className={s.sortable} onClick={() => sortBy('count')}>Số lượt dự giờ{arrow('count')}</th><th className={s.sortable} onClick={() => sortBy('avg')}>Điểm TB{arrow('avg')}</th><th>Xếp loại gần nhất</th><th className={s.sortable} onClick={() => sortBy('last')}>Lần dự gần nhất{arrow('last')}</th><th>Lịch sắp tới</th><th>Cải tiến mở</th></tr></thead>
                            <tbody>
                            {st.data.items.map((t) => {
                                const n = Number(t.obs_count);
                                return (
                                    <tr key={t.id} onClick={() => ev.openTeacher(t.id)}>
                                        <td><div className={s.who}><Avatar name={t.full_name} /><div><div className={e.tdMain}>{t.full_name}</div><div className={e.tdSub}>{t.code} · {t.subject_name}</div></div></div></td>
                                        <td style={{ minWidth: 150 }}><div className={e.flex} style={{ gap: 8 }}><b>{n}/{min}</b>{n === 0 ? <Tone tone="crit">Chưa dự</Tone> : n < min ? <Tone tone="warn">Chưa đủ</Tone> : <Tone tone="ok">Đủ</Tone>}</div><Progress value={(n / min) * 100} /></td>
                                        <td><b>{score(t.obs_avg)}</b></td>
                                        <td><RatingChip v={t.last_rating} /></td>
                                        <td>{t.last_date ? fmtDate(t.last_date) : '—'}</td>
                                        <td>{Number(t.upcoming) ? <Tone tone="info">{t.upcoming} lịch</Tone> : <span className={s.faint}>—</span>}</td>
                                        <td>{Number(t.open_actions) ? <Tone tone="warn">{t.open_actions} việc</Tone> : <span className={s.faint}>—</span>}</td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ padding: '10px 18px 14px' }} className={`${s.small} ${s.muted}`}>{st.data.total} giáo viên · yêu cầu tối thiểu {min} lượt/giáo viên</div>
                </div>
            )}
        </div>
    );
}