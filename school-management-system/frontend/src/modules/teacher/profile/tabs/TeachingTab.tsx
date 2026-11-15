'use client';

import { useMemo, useState } from 'react';
import { profileApi } from '@/services/teacherProfileService';
import { colorOf, Empty, ErrorBox, Icon, inHomeroom, Skeleton, useFetch } from '../ui';
import s from '../profile.module.css';

const DAYS = [2, 3, 4, 5, 6, 7];
const todayWeekday = () => { const d = new Date().getDay(); return d === 0 ? 0 : d + 1; }; // CN → không có tiết

export default function TeachingTab() {
    const { data, loading, error, reload } = useFetch(() => profileApi.teaching());
    const [grade, setGrade] = useState<number | 'all'>('all');
    const [q, setQ] = useState('');
    const hr = inHomeroom();
    const grid = useMemo(() => { const m = new Map<string, any>(); data?.slots.forEach((x) => m.set(`${x.weekday}-${x.period}`, x)); return m; }, [data]);

    if (loading) return <Skeleton h={160} n={3} />;
    if (error || !data) return <ErrorBox message={error || 'Lỗi'} onRetry={reload} />;

    const grades = [...new Set(data.classes.map((c) => c.grade))].sort();
    const rows = data.classes.filter((c) => (grade === 'all' || c.grade === grade) && `${c.class_name} ${c.subject_name}`.toLowerCase().includes(q.toLowerCase()));
    const today = todayWeekday();

    return (
        <div className={`${s.panel} ${s.stack}`}>
            {data.homeroom.length > 0 && (
                <section className={s.card}>
                    <div className={s.cardHead}><h3 className={s.cardTitle}><Icon n="home" /> Lớp chủ nhiệm</h3></div>
                    <div className={s.g3}>
                        {data.homeroom.map((h) => (
                            <div key={h.id} className={s.item}>
                                <div className={s.itemIco} style={{ background: '#e0f4fa', color: '#0891b2' }}><Icon n="users" /></div>
                                <div style={{ flex: 1 }}><b>Lớp {h.name}</b><div className={s.cardSub}>Khối {h.grade} • Phòng {h.room || '—'} • Sĩ số tối đa {h.capacity}</div>
                                    {!hr && <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                        <a className={`${s.btn} ${s.btnS}`} href={`/teacher/attendance?class=${h.id}`}>Điểm danh</a>
                                        <a className={`${s.btn} ${s.btnS}`} href={`/teacher/grades?class=${h.id}`}>Bảng điểm</a></div>}</div>
                            </div>))}
                    </div>
                </section>
            )}

            <section className={s.card}>
                <div className={s.cardHead}>
                    <div><h3 className={s.cardTitle}><Icon n="calendar" /> Thời khóa biểu tuần</h3><div className={s.cardSub}>{data.slots.length} tiết/tuần • cột hôm nay được tô nổi bật</div></div>
                </div>
                {data.slots.length === 0 ? <Empty icon="🗓️" text="Chưa có thời khóa biểu được phân công." /> : (
                    <div className={s.scroll}>
                        <div className={s.tt}>
                            <div />{DAYS.map((d) => <div key={d} className={`${s.ttH} ${d === today ? s.ttToday : ''}`}>Thứ {d}</div>)}
                            {data.periods.map((p) => (
                                <FragmentRow key={p.id}>
                                    <div className={s.ttP}><b>Tiết {p.id}</b>{p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}</div>
                                    {DAYS.map((d) => { const c = grid.get(`${d}-${p.id}`);
                                        return c ? <div key={d} className={`${s.cell} ${s.cellOn}`} style={{ background: colorOf(c.subject_name) }}>{c.class_name}<small>{c.subject_name}{c.room ? ` • P.${c.room}` : ''}</small></div> : <div key={d} className={s.cell} />; })}
                                </FragmentRow>))}
                        </div>
                    </div>)}
            </section>

            <section className={s.card}>
                <div className={s.cardHead}>
                    <div><h3 className={s.cardTitle}><Icon n="book" /> Lớp đang giảng dạy ({data.classes.length})</h3></div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <div className={s.filters}>{(['all', ...grades] as const).map((g) => <button key={g} className={`${s.pill} ${grade === g ? s.pillOn : ''}`} onClick={() => setGrade(g)}>{g === 'all' ? 'Tất cả' : `Khối ${g}`}</button>)}</div>
                        <input className={s.input} style={{ width: 200 }} placeholder="Tìm lớp / môn…" value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                </div>
                {rows.length === 0 ? <Empty icon="🔎" text="Không có lớp phù hợp." /> : (
                    <div className={s.scroll}><table className={s.table}>
                        <thead><tr><th>Lớp</th><th>Môn</th><th>Khối</th><th>Phòng</th><th>Sĩ số tối đa</th><th /></tr></thead>
                        <tbody>{rows.map((c) => (
                            <tr key={c.class_subject_id}>
                                <td><b>{c.class_name}</b></td><td><span className={`${s.badge} ${s.bInfo}`}>{c.subject_name}</span></td><td>{c.grade}</td><td>{c.room || '—'}</td><td>{c.capacity}</td>
                                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{!hr && <>
                                    <a className={`${s.btn} ${s.btnS}`} href={`/teacher/attendance?class=${c.class_id}`}>Điểm danh</a>{' '}
                                    <a className={`${s.btn} ${s.btnS}`} href={`/teacher/grades?class=${c.class_id}&subject=${c.class_subject_id}`}>Nhập điểm</a></>}</td>
                            </tr>))}</tbody></table></div>)}
            </section>
        </div>
    );
}

function FragmentRow({ children }: { children: React.ReactNode }) { return <>{children}</>; }