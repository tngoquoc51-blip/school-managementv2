'use client';

import { useEffect, useState } from 'react';
import { errMsg, logApi } from '@/modules/teacher/lessonlog/service';
import type { ProgressData, ViewProps } from '@/modules/teacher/lessonlog/types';
import { RATING, barTone, dm, dmy, ratingOf } from '@/modules/teacher/lessonlog/util';
import { Empty, Icon, Modal, Skeleton } from '@/app/bgh/rewards/ui';
import { Bar, Kpi } from '../parts';

/** Tiến độ chương trình theo môn: số tiết đã dạy so với kế hoạch đến hết tuần đang xem */
export default function Progress({ classId, date, rev }: ViewProps) {
    const [d, setD] = useState<ProgressData | null>(null);
    const [err, setErr] = useState('');
    const [sel, setSel] = useState<{ id: number; name: string } | null>(null);
    const [lessons, setLessons] = useState<ProgressData['lessons']>(null);

    useEffect(() => {
        setD(null); setErr('');
        logApi.progress(classId, date).then(setD).catch((e) => setErr(errMsg(e)));
    }, [classId, date, rev]);

    const open = (id: number, name: string) => {
        setSel({ id, name }); setLessons(null);
        logApi.progress(classId, date, id).then((r) => setLessons(r.lessons ?? [])).catch(() => setLessons([]));
    };

    if (err) return <div className="rw-err"><Icon n="alert" />{err}</div>;
    if (!d) return <Skeleton h={340} />;

    const planned = d.subjects.reduce((a, s) => a + s.planned, 0);
    const logged = d.subjects.reduce((a, s) => a + s.logged, 0);
    const slow = d.subjects.filter((s) => (s.rate ?? 100) < 70).length;

    return (
        <div className="rw-stack">
            <section className="rw-grid4">
                <Kpi label="Học kỳ" value={d.semester.name} note={`${dmy(d.semester.start)} – ${dmy(d.semester.end)}`} accent />
                <Kpi label="Số tuần đã qua" value={d.semester.weeks} note="tính từ đầu học kỳ" />
                <Kpi label="Tiết đã ghi / kế hoạch" value={`${logged}/${planned}`} note={planned ? `${Math.round(logged / planned * 100)}% chương trình` : ''} />
                <Kpi label="Môn chậm tiến độ" value={slow} tone={slow ? 'bad' : 'good'} note="dưới 70% kế hoạch" />
            </section>

            <div className="panel" style={{ overflow: 'auto' }}>
                <table className="tbl">
                    <thead><tr><th>Môn học</th><th>Tiết/tuần</th><th style={{ minWidth: 200 }}>Tiến độ</th><th>Xếp loại TB</th><th>Bài gần nhất</th><th /></tr></thead>
                    <tbody>
                    {d.subjects.map((s) => (
                        <tr key={s.subject_id}>
                            <td><b>{s.name}</b><div className="hint">{s.teacher_name || '—'}</div></td>
                            <td>{s.per_week}</td>
                            <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Bar pct={s.rate} tone={barTone(s.rate)} /><span style={{ whiteSpace: 'nowrap' }}><b>{s.logged}</b>/{s.planned}</span>{(s.rate ?? 100) < 70 && <span className="badge bad">Chậm</span>}</div></td>
                            <td>{ratingOf(s.avg_rating)}</td>
                            <td style={{ maxWidth: 280 }}>{s.last_title ? <><div>{s.last_title}</div><div className="hint">{dm(s.last_date)}{s.last_no ? ` · tiết PPCT ${s.last_no}` : ''}</div></> : <span className="muted">Chưa có</span>}</td>
                            <td style={{ textAlign: 'right' }}><button className="btn ghost sm" onClick={() => open(s.subject_id, s.name)}>Các bài đã dạy</button></td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {sel && (
                <Modal title={`Các bài đã dạy – ${sel.name}`} drawer onClose={() => setSel(null)} footer={<button className="btn ghost" onClick={() => setSel(null)}>Đóng</button>}>
                    {!lessons ? <Skeleton h={200} /> : !lessons.length ? <Empty icon="list" text="Chưa có bài nào được ký sổ." /> : (
                        <table className="tbl">
                            <thead><tr><th>Ngày</th><th>Tiết</th><th>PPCT</th><th>Tên bài dạy</th><th>Xếp loại</th></tr></thead>
                            <tbody>
                            {lessons.map((l) => (
                                <tr key={l.id}><td>{dm(l.entry_date)}</td><td>{l.period}</td><td>{l.lesson_no ?? '—'}</td>
                                    <td>{l.lesson_title}{l.homework && <div className="hint">BTVN: {l.homework}</div>}</td>
                                    <td>{l.rating ? <span className={`ll-st ${RATING[l.rating].tone}`}>{RATING[l.rating].l}</span> : '—'}</td></tr>
                            ))}
                            </tbody>
                        </table>
                    )}
                </Modal>
            )}
        </div>
    );
}