'use client';

import { useEffect, useState } from 'react';
import { emuApi, errMsg } from '../awardsService';
import type { Ctx, StudentDetail } from '../types';
import { fmtDate, semLabel } from '../utils';
import { Ring } from './Charts';
import Icon from './icons';
import { Drawer } from './Overlay';
import { useToast } from './Toast';
import { Avatar, CatIcon, Empty, Points, Skel, TierBadge } from './ui';

export default function StudentDrawer({ ctx, id, onClose, onScore, onPropose }: {
    ctx: Ctx; id: number | null; onClose: () => void; onScore: (id: number) => void; onPropose: (id: number) => void;
}) {
    const { meta, scope, tick } = ctx;
    const toast = useToast();
    const [d, setD] = useState<StudentDetail | null>(null);

    useEffect(() => {
        if (!id) { setD(null); return; }
        emuApi.student(scope, id).then(setD).catch((e) => { toast.error('Không tải được hồ sơ', errMsg(e)); onClose(); });
    }, [id, scope, tick]); // eslint-disable-line react-hooks/exhaustive-deps

    const s = d?.student;
    const maxCat = Math.max(1, ...(d?.categories ?? []).map((c) => Math.max(c.plus, -c.minus)));

    return (
        <Drawer open={!!id} onClose={onClose} title="Hồ sơ thi đua" subtitle={`${semLabel(scope.semester)} · lớp ${meta.class.name}`}
                footer={s && <><button className="emu-btn" onClick={() => onPropose(s.id)}><Icon name="trophy" /> Đề xuất khen thưởng</button><button className="emu-btn primary" onClick={() => onScore(s.id)}><Icon name="plus" /> Chấm điểm</button></>}>
            {!s && <><Skel h={90} /><Skel h={120} /><Skel h={160} /></>}
            {s && d && (
                <>
                    <div className="emu-row" style={{ gap: 16 }}>
                        <Avatar name={s.full_name} size="lg" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 style={{ margin: 0, fontSize: 19 }}>{s.full_name}</h3>
                            <div className="emu-muted">{s.code} · {s.gender} · sinh {fmtDate(s.birth_date)}</div>
                            <div style={{ marginTop: 6 }}><TierBadge tiers={meta.tiers} tier={s.tier} label={s.tier_label} /></div>
                        </div>
                        <div style={{ color: 'var(--brand)' }}>
                            <Ring value={s.score} max={140} size={88} stroke={9} color="var(--brand)" track="var(--line)"><div><b style={{ fontSize: 22, color: 'var(--ink)' }}>{s.score}</b><div className="emu-muted" style={{ fontSize: 10 }}>hạng #{s.rank}</div></div></Ring>
                        </div>
                    </div>

                    <div className="emu-grid emu-g3" style={{ gap: 10 }}>
                        {[['ĐTB', s.gpa ?? '—'], ['Hạnh kiểm', s.conduct ?? '—'], ['Nghỉ KP', `${s.absences.unexcused} buổi`], ['Điểm cộng', `+${s.plus_points}`], ['Điểm trừ', s.minus_points], ['Đi muộn', `${s.absences.late} lần`]].map(([k, v]) => (
                            <div key={String(k)} className="emu-card" style={{ padding: '10px 12px' }}><div className="emu-muted" style={{ fontSize: 11.5 }}>{k}</div><b style={{ fontSize: 17 }}>{v}</b></div>
                        ))}
                    </div>

                    <div>
                        <b>So sánh các học kỳ</b>
                        <table className="emu-table" style={{ marginTop: 6 }}><thead><tr><th>Kỳ</th><th className="c">Điểm TĐ</th><th className="c">Hạng</th><th className="c">ĐTB</th><th className="c">Hạnh kiểm</th></tr></thead>
                            <tbody>{d.per_semester.map((p) => <tr key={p.semester}><td>HK{p.semester}</td><td className="c emu-strong">{p.score}</td><td className="c">#{p.rank}</td><td className="c">{p.gpa ?? '—'}</td><td className="c">{p.conduct ?? '—'}</td></tr>)}</tbody></table>
                    </div>

                    {d.categories.length > 0 && (
                        <div className="emu-col"><b>Điểm theo nhóm</b>
                            {d.categories.map((c) => (
                                <div key={c.key} className="emu-row"><CatIcon cat={c.key} size={26} /><span style={{ width: 130 }} className="emu-clip">{c.label}</span>
                                    <div className="emu-bar" style={{ flex: 1 }}><i style={{ width: `${(c.plus / maxCat) * 100}%`, background: 'var(--ok)' }} /></div>
                                    <div className="emu-bar" style={{ flex: 1 }}><i style={{ width: `${(-c.minus / maxCat) * 100}%`, background: 'var(--danger)' }} /></div></div>
                            ))}
                        </div>
                    )}

                    <div className="emu-col"><b>Khen thưởng đã đề xuất</b>
                        {d.proposals.length === 0 && <span className="emu-muted">Chưa có đề xuất nào.</span>}
                        {d.proposals.map((p) => <div key={p.id} className="emu-row"><Icon name="trophy" size={15} /> {p.award_name}<span className="emu-muted">· {semLabel(p.semester)}</span><span className={`emu-badge ${p.status === 'approved' ? 'ok' : p.status === 'rejected' || p.status === 'cancelled' ? 'bad' : 'info'}`} style={{ marginLeft: 'auto' }}>{{ draft: 'Nháp', submitted: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', cancelled: 'Đã hủy' }[p.status]}</span></div>)}
                    </div>

                    <div className="emu-col"><b>Lịch sử ghi nhận</b>
                        {d.records.length === 0 && <Empty icon="history" title="Chưa có ghi nhận" />}
                        {d.records.map((r) => (
                            <div key={r.id} className="emu-row" style={{ alignItems: 'flex-start' }}>
                                <CatIcon cat={r.category} size={30} />
                                <div style={{ flex: 1, minWidth: 0 }}><div>{r.criterion_name}</div><div className="emu-muted" style={{ fontSize: 12 }}>{fmtDate(r.record_date)}{r.note ? ` · ${r.note}` : ''}</div></div>
                                <Points value={r.points} />
                            </div>
                        ))}
                    </div>
                </>
            )}
        </Drawer>
    );
}