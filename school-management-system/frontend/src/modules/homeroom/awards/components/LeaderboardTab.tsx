'use client';

import { useEffect, useMemo, useState } from 'react';
import { emuApi, errMsg } from '../awardsService';
import type { ClassRank, Ctx, StudentRow } from '../types';
import { cx, downloadCsv, removeAccents, semLabel } from '../utils';
import Icon from './icons';
import { useToast } from './Toast';
import { Avatar, Empty, TierBadge } from './ui';

type SortKey = 'rank' | 'score' | 'plus_points' | 'minus_points' | 'gpa' | 'absent';

export default function LeaderboardTab({ ctx }: { ctx: Ctx }) {
    const { meta, students, scope, openStudent, tick } = ctx;
    const toast = useToast();
    const [mode, setMode] = useState<'students' | 'classes'>('students');
    const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'rank', dir: 1 });
    const [tier, setTier] = useState('');
    const [q, setQ] = useState('');
    const [classes, setClasses] = useState<ClassRank[]>([]);
    const [grade, setGrade] = useState(0);

    useEffect(() => {
        if (mode !== 'classes') return;
        emuApi.classRanking(scope).then(setClasses).catch((e) => toast.error('Không tải được xếp hạng lớp', errMsg(e)));
    }, [mode, scope, tick, toast]);

    const top3 = useMemo(() => [...students].sort((a, b) => b.score - a.score).slice(0, 3), [students]);
    const val = (s: StudentRow, k: SortKey) => (k === 'absent' ? s.absences.unexcused : k === 'gpa' ? s.gpa ?? -1 : s[k]);

    const rows = useMemo(() => {
        const k = removeAccents(q.trim());
        return students
            .filter((s) => (!tier || s.tier === tier) && (!k || removeAccents(s.full_name).includes(k) || s.code.toLowerCase().includes(k)))
            .sort((a, b) => (val(a, sort.key) - val(b, sort.key)) * sort.dir || a.rank - b.rank);
    }, [students, tier, q, sort]);

    const th = (key: SortKey, label: string, cls = '') => (
        <th className={cx('sort', cls)} onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'rank' || key === 'absent' ? 1 : -1 }))}>
            {label} {sort.key === key ? (sort.dir === 1 ? '↑' : '↓') : ''}
        </th>
    );

    const exportCsv = () => {
        downloadCsv(`xep-hang-thi-dua-${meta.class.name}-${semLabel(scope.semester)}.csv`, [
            ['Hạng', 'Mã HS', 'Họ tên', 'Điểm thi đua', 'Điểm cộng', 'Điểm trừ', 'ĐTB', 'Hạnh kiểm', 'Nghỉ có phép', 'Nghỉ không phép', 'Đi muộn', 'Xếp loại'],
            ...[...students].sort((a, b) => a.rank - b.rank).map((s) => [s.rank, s.code, s.full_name, s.score, s.plus_points, s.minus_points, s.gpa, s.conduct, s.absences.excused, s.absences.unexcused, s.absences.late, s.tier_label]),
        ]);
        toast.success('Đã xuất file CSV', 'Mở bằng Excel để in hoặc nộp báo cáo.');
    };

    const medal = ['#f2a900', '#94a3b8', '#c2763a'];
    const order = top3.length === 3 ? [1, 0, 2] : top3.map((_, i) => i);
    const shownClasses = classes.filter((c) => !grade || c.grade === grade);
    const maxAvg = Math.max(1, ...classes.map((c) => c.avg_score));
    const grades = Array.from(new Set(classes.map((c) => c.grade))).sort();

    return (
        <div className="emu-page">
            <div className="emu-row emu-wrap">
                <div className="emu-seg">
                    <button className={cx(mode === 'students' && 'on')} onClick={() => setMode('students')}>Học sinh trong lớp</button>
                    <button className={cx(mode === 'classes' && 'on')} onClick={() => setMode('classes')}>Các lớp toàn trường</button>
                </div>
                <span className="emu-spacer" />
                {mode === 'students' && <button className="emu-btn" onClick={exportCsv}><Icon name="download" /> Xuất CSV</button>}
            </div>

            {mode === 'students' ? (
                <>
                    {top3.length > 0 && (
                        <div className="emu-podium">
                            {order.map((i) => {
                                const s = top3[i];
                                return (
                                    <div key={s.id} className={cx('emu-pod', i === 0 && 'r1')} onClick={() => openStudent(s.id)}>
                                        <div className="emu-medal" style={{ background: medal[i] }}>{i + 1}</div>
                                        <div style={{ display: 'grid', placeItems: 'center', marginBottom: 8 }}><Avatar name={s.full_name} size="lg" /></div>
                                        <div className="emu-strong emu-clip">{s.full_name}</div>
                                        <div className="emu-muted" style={{ fontSize: 12 }}>{s.code}</div>
                                        <div className="big" style={{ color: medal[i] }}>{s.score}</div>
                                        <TierBadge tiers={meta.tiers} tier={s.tier} label={s.tier_label} />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="emu-card">
                        <div className="emu-card-h" style={{ flexWrap: 'wrap' }}>
                            <h3>Bảng xếp hạng thi đua</h3><span className="emu-sub">{rows.length}/{students.length} học sinh</span><span className="emu-spacer" />
                            <div className="emu-search" style={{ width: 220 }}><Icon name="search" size={15} /><input className="emu-input" style={{ height: 32 }} placeholder="Tìm học sinh…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                            <select className="emu-select" style={{ width: 150, height: 32 }} value={tier} onChange={(e) => setTier(e.target.value)}>
                                <option value="">Mọi xếp loại</option>{meta.tiers.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                            </select>
                        </div>
                        <div className="emu-tw" style={{ marginTop: 12 }}>
                            <table className="emu-table">
                                <thead><tr>{th('rank', 'Hạng')}<th>Học sinh</th>{th('score', 'Điểm TĐ', 'c')}{th('plus_points', 'Cộng', 'c')}{th('minus_points', 'Trừ', 'c')}{th('gpa', 'ĐTB', 'c')}<th className="c">Hạnh kiểm</th>{th('absent', 'Nghỉ KP', 'c')}<th>Xếp loại</th></tr></thead>
                                <tbody>
                                {rows.map((s) => (
                                    <tr key={s.id} className="click" onClick={() => openStudent(s.id)}>
                                        <td className="emu-strong emu-num">#{s.rank}</td>
                                        <td><div className="emu-row"><Avatar name={s.full_name} size="sm" /><div><b>{s.full_name}</b><div className="emu-muted" style={{ fontSize: 11.5 }}>{s.code}</div></div></div></td>
                                        <td className="c"><b className="emu-num">{s.score}</b></td>
                                        <td className="c emu-pos emu-num">+{s.plus_points}</td>
                                        <td className="c emu-neg emu-num">{s.minus_points}</td>
                                        <td className="c emu-num">{s.gpa ?? '—'}</td>
                                        <td className="c">{s.conduct ?? '—'}</td>
                                        <td className="c emu-num">{s.absences.unexcused}</td>
                                        <td><TierBadge tiers={meta.tiers} tier={s.tier} label={s.tier_label} /></td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                            {rows.length === 0 && <Empty icon="search" title="Không có học sinh phù hợp" />}
                        </div>
                    </div>
                </>
            ) : (
                <div className="emu-card">
                    <div className="emu-card-h"><h3>Xếp hạng thi đua các lớp</h3><span className="emu-sub">theo điểm trung bình mỗi học sinh</span><span className="emu-spacer" />
                        <select className="emu-select" style={{ width: 130, height: 32 }} value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
                            <option value={0}>Mọi khối</option>{grades.map((g) => <option key={g} value={g}>Khối {g}</option>)}
                        </select>
                    </div>
                    <div className="emu-tw" style={{ marginTop: 12 }}>
                        <table className="emu-table">
                            <thead><tr><th>Hạng</th><th>Lớp</th><th>Khối</th><th className="c">Sĩ số</th><th style={{ width: '38%' }}>Điểm TB</th><th className="c">Hạng khối</th></tr></thead>
                            <tbody>
                            {shownClasses.map((c) => (
                                <tr key={c.class_id} className={cx(c.is_mine && 'me')}>
                                    <td className="emu-strong emu-num">#{c.rank}</td>
                                    <td><b>{c.name}</b> {c.is_mine && <span className="emu-badge brand">Lớp tôi</span>}</td>
                                    <td>{c.grade}</td><td className="c emu-num">{c.students}</td>
                                    <td><div className="emu-row"><div className="emu-bar" style={{ flex: 1 }}><i style={{ width: `${(c.avg_score / maxAvg) * 100}%`, background: c.is_mine ? 'var(--gold)' : 'var(--brand)' }} /></div><b className="emu-num">{c.avg_score}</b></div></td>
                                    <td className="c emu-num">#{c.grade_rank}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        {classes.length === 0 && <Empty icon="chart" title="Đang tải xếp hạng…" />}
                    </div>
                </div>
            )}
        </div>
    );
}