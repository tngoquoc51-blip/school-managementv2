'use client';
import { useEffect, useState } from 'react';
import { actionLabel, commendLabel, fmtDate, fmtDateTime } from './constants';
import { disciplineService, errMsg } from './disciplineService';
import StudentPicker from './StudentPicker';
import type { StudentHit, TabProps } from './types';
import { Badge, Empty, Icon, RankBadge, Sev, SkelRows, StatusBadge, ScoreRing, rankColor, useUI } from './ui';

export default function StudentsTab({ meta, scope, tick, refresh, openRecord, newRecord, focusStudent, clearFocus }: TabProps & { focusStudent: number | null; clearFocus: () => void }) {
    const { toast, confirm } = useUI();
    const [sel, setSel] = useState<StudentHit | null>(null);
    const [id, setId] = useState<number | null>(focusStudent);
    const [d, setD] = useState<any>(null);

    useEffect(() => { if (focusStudent) { setId(focusStudent); setSel(null); clearFocus(); } }, [focusStudent]);
    useEffect(() => { if (sel) setId(sel.id); }, [sel]);
    useEffect(() => {
        if (!id) return;
        setD(null);
        disciplineService.studentProfile(id, { year_id: scope.yearId }).then(setD).catch((e) => toast('error', 'Không tải được hồ sơ', errMsg(e)));
    }, [id, scope.yearId, tick]);

    const apply = async (sem: 1 | 2) => {
        const rank = d.scores[`hk${sem}`].rank;
        if (!(await confirm({ title: `Ghi hạnh kiểm HK${sem} vào sổ?`, text: `Hạnh kiểm đề xuất theo điểm rèn luyện: ${rank}. Dữ liệu trong sổ hạnh kiểm chính thức sẽ được cập nhật.`, okLabel: 'Ghi vào sổ' }))) return;
        try { const r = await disciplineService.applyConduct(d.student.id, { year_id: scope.yearId, semester: sem }); toast('success', r.message); refresh(); }
        catch (e) { toast('error', 'Không ghi được hạnh kiểm', errMsg(e)); }
    };

    return (
        <div className="dc-stack">
            <section className="dc-card"><div className="dc-card-b" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <b>Tra cứu hồ sơ rèn luyện</b>
                <div style={{ flex: 1, minWidth: 280 }}><StudentPicker scope={scope} value={sel} onChange={(s) => { setSel(s); if (!s) { setId(null); setD(null); } }} /></div>
            </div></section>

            {!id && <section className="dc-card"><Empty icon="user" text="Chọn một học sinh để xem điểm rèn luyện, lịch sử vi phạm, khen thưởng và chuyên cần." /></section>}
            {id && !d && <SkelRows n={8} />}
            {d && (() => {
                const s = d.scores.year; const att = d.attendance as Record<string, number>;
                const absent = Object.entries(att).filter(([k]) => k !== 'present').reduce((a, [, v]) => a + v, 0);
                return <>
                    <section className="dc-card"><div className="dc-card-b" style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
                        <ScoreRing score={s.score} max={meta.settings.base_score} color={rankColor(s.rank)} />
                        <div style={{ flex: 1, minWidth: 240 }}>
                            <h2 style={{ fontSize: 20 }}>{d.student.full_name}</h2>
                            <p style={{ color: 'var(--muted)', margin: '4px 0 10px' }}>{d.student.code} · {d.student.gender} · Sinh {fmtDate(d.student.birth_date)} · Lớp {d.class?.name ?? 'chưa xếp lớp'}</p>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <RankBadge r={s.rank} /><Badge tone="bad">-{s.deduct} điểm vi phạm ({s.violations})</Badge><Badge tone="ok">+{s.add} điểm khen thưởng ({s.commendations})</Badge>
                                {s.score < meta.settings.warn_score && <Badge tone="bad">Dưới mức cảnh báo</Badge>}
                            </div>
                        </div>
                        <button className="dc-btn primary" onClick={() => newRecord()}><Icon n="plus" />Ghi nhận vi phạm</button>
                    </div></section>

                    <div className="dc-cols">
                        <section className="dc-card"><div className="dc-card-h"><h3>Hạnh kiểm theo học kỳ</h3></div><div className="dc-card-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {([1, 2] as const).map((n) => { const x = d.scores[`hk${n}`]; return (
                                <div key={n} className="dc-item" style={{ padding: 0, border: 0 }}>
                                    <div className="grow"><b>Học kỳ {n}</b><small>Điểm {x.score} · đề xuất</small></div><RankBadge r={x.rank} />
                                    {meta.permissions.approve && <button className="dc-btn sm" onClick={() => apply(n)}>Ghi vào sổ</button>}
                                </div>); })}
                            <div className="dc-note info" style={{ marginTop: 4 }}>
                                Sổ hạnh kiểm chính thức: {d.official_conduct ? <b>HK1 {d.official_conduct.hk1 || '—'} · HK2 {d.official_conduct.hk2 || '—'} · Cả năm {d.official_conduct.year_result}</b> : 'chưa có dữ liệu'}</div>
                        </div></section>
                        <section className="dc-card"><div className="dc-card-h"><h3>Chuyên cần (liên kết điểm danh)</h3></div><div className="dc-card-b">
                            {!Object.keys(att).length ? <p style={{ color: 'var(--muted)' }}>Chưa có dữ liệu điểm danh năm học này.</p> : (
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    {Object.entries(att).map(([k, v]) => <Badge key={k} tone={k === 'present' ? 'ok' : 'warn'}>{k}: {v}</Badge>)}
                                    {absent >= 5 && <Badge tone="bad">Vắng {absent} buổi – cân nhắc ghi nhận lỗi “Nghỉ học không phép”</Badge>}
                                </div>)}
                        </div></section>
                    </div>

                    <div className="dc-cols">
                        <section className="dc-card"><div className="dc-card-h"><h3>Lịch sử vi phạm ({d.records.length})</h3></div>
                            {!d.records.length ? <Empty icon="ok" text="Học sinh chưa có vi phạm nào" /> : <div className="dc-list">{d.records.map((r: any) => (
                                <div key={r.id} className="dc-item click" onClick={() => openRecord(r.id)}>
                                    <div className="grow"><b>{r.category_name}</b><small>{fmtDateTime(r.occurred_at)}{r.action_type ? ` · ${actionLabel(r.action_type)}` : ''}</small></div>
                                    <Sev n={r.severity} /><span style={{ color: 'var(--bad)', fontWeight: 600 }}>-{r.points}</span><StatusBadge s={r.status} />
                                </div>))}</div>}
                        </section>
                        <section className="dc-card"><div className="dc-card-h"><h3>Khen thưởng ({d.commendations.length})</h3></div>
                            {!d.commendations.length ? <Empty icon="star" text="Chưa có khen thưởng" /> : <div className="dc-list">{d.commendations.map((c: any) => (
                                <div key={c.id} className="dc-item"><div className="grow"><b>{c.title}</b><small>{commendLabel(c.kind)} · {fmtDate(c.awarded_date)}</small></div>
                                    <span style={{ color: 'var(--ok)', fontWeight: 600 }}>+{c.points}</span><Badge tone={c.status === 'approved' ? 'ok' : c.status === 'pending' ? 'warn' : 'mute'}>{c.status === 'approved' ? 'Đã duyệt' : c.status === 'pending' ? 'Chờ duyệt' : 'Từ chối'}</Badge></div>))}</div>}
                        </section>
                    </div>
                    <section className="dc-card"><div className="dc-card-h"><h3>Dòng thời gian</h3></div><div className="dc-card-b">
                        {!d.timeline.length ? <p style={{ color: 'var(--muted)' }}>Chưa có hoạt động.</p> :
                            <ul className="dc-timeline" style={{ margin: 0 }}>{d.timeline.map((l: any) => <li key={l.id}>{l.summary}<small>{l.actor_name} · {fmtDateTime(l.created_at)}</small></li>)}</ul>}
                    </div></section>
                </>;
            })()}
        </div>
    );
}