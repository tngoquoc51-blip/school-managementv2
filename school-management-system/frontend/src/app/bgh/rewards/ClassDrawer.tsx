'use client';

import { useEffect, useState } from 'react';
import { errMsg, rewardsApi } from '@/modules/bgh/rewards/rewardsService';
import type { ClassDetail, Meta, Period } from '@/modules/bgh/rewards/types';
import { CAT_COLOR, Empty, fdt, fmt, Icon, KIND, Modal, num, Skeleton, Spark, sgn, STATUS } from './ui';

export default function ClassDrawer({ id, meta, period, date, onClose, onScore, onAward, awardLabel }: {
    id: number; meta: Meta; period: Period; date: string;
    onClose: () => void; onScore?: (id: number) => void; onAward?: (id: number) => void; awardLabel?: string;
}) {
    const [d, setD] = useState<ClassDetail | null>(null);
    const [err, setErr] = useState('');

    useEffect(() => {
        setD(null); setErr('');
        rewardsApi.classDetail(id, period, date).then(setD).catch((e) => setErr(errMsg(e)));
    }, [id, period, date]);

    const maxC = Math.max(1, ...(d?.categories || []).map((c) => Math.max(c.plus, Math.abs(c.minus))));

    return (
        <Modal drawer title={d ? `Lớp ${d.class.name} · Hồ sơ thi đua` : 'Hồ sơ thi đua'} onClose={onClose}
               footer={d && <>
                   {onAward && <button className="btn ghost" onClick={() => onAward(id)}><Icon n="award" s={16} />{awardLabel || 'Đề xuất khen thưởng'}</button>}
                   {onScore && <button className="btn brass" onClick={() => onScore(id)}><Icon n="edit" s={16} />Chấm điểm lớp này</button>}
               </>}>
            {err ? <div className="rw-err"><Icon n="alert" />{err}</div> : !d ? <><Skeleton h={90} /><Skeleton h={120} /><Skeleton h={160} /></> : (
                <>
                    <div className="panel"><div className="pb">
                        <div className="row"><b style={{ fontSize: 18 }}>Lớp {d.class.name}</b><span className="badge info">Khối {d.class.grade}</span><span className="spacer" />
                            <span className="muted">{d.class.students} học sinh{d.class.room ? ` · P.${d.class.room}` : ''}</span></div>
                        <div className="muted" style={{ marginTop: 4 }}>GVCN: {d.class.homeroom || 'Chưa phân công'}</div>
                        <div className="grid2" style={{ marginTop: 14 }}>
                            <div><div className="hint">Điểm · {d.range.label}</div><div style={{ fontSize: 30, fontWeight: 800 }}>{fmt(d.rank.score)}</div></div>
                            <div><div className="hint">Thứ hạng</div>
                                <div style={{ fontSize: 20, fontWeight: 800 }} className="brass-t">#{d.rank.school ?? '—'} <small className="muted" style={{ fontSize: 12, fontWeight: 500 }}>/ {d.rank.total} lớp</small></div>
                                <div className="hint">Hạng {d.rank.grade}/{d.rank.grade_total} trong khối {d.class.grade}</div></div>
                        </div>
                    </div></div>

                    <div className="panel"><div className="ph"><h3>Điểm trung bình 10 tuần</h3></div><div className="pb"><Spark data={d.weekly.map((w) => w.avg)} w={480} h={80} />
                        <div className="row hint" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><span>{d.weekly[0]?.label}</span><span>{d.weekly[d.weekly.length - 1]?.label}</span></div></div></div>

                    <div className="panel"><div className="ph"><h3>Theo mảng thi đua</h3></div><div className="pb">
                        {!d.categories.length ? <Empty text="Chưa có dữ liệu trong kỳ này." /> : d.categories.map((c) => (
                            <div className="cb" key={c.category}>
                                <span style={{ fontWeight: 600, color: CAT_COLOR[c.category] }}>{meta.categories[c.category]}</span>
                                <div className="tr"><i style={{ width: `${(c.plus / maxC) * 100}%`, background: 'var(--good)' }} /><i style={{ width: `${(Math.abs(c.minus) / maxC) * 100}%`, background: 'var(--bad)' }} /><small>{sgn(c.plus)} / {sgn(c.minus)}</small></div>
                            </div>
                        ))}
                    </div></div>

                    <div className="panel"><div className="ph"><h3>Ghi nhận gần đây</h3></div><div className="pb">
                        {!d.records.length ? <Empty text="Chưa có ghi nhận trong kỳ." /> : d.records.slice(0, 12).map((r) => (
                            <div className="li" key={r.id}>
                                <span><div className="nm">{r.criteria}</div><div className="sb">{fdt(r.record_date)}{r.note ? ` · ${r.note}` : ''}</div></span>
                                <span className={`val ${num(r.points) > 0 ? 'good-t' : 'bad-t'}`}>{sgn(r.points)}</span>
                            </div>
                        ))}
                    </div></div>

                    {!!d.awards.length && (
                        <div className="panel"><div className="ph"><h3>Khen thưởng / kỷ luật</h3></div><div className="pb">
                            {d.awards.map((a) => (
                                <div className="li" key={a.id}><span className="nm">{a.title}</span>
                                    <span className="val" style={{ display: 'flex', gap: 6 }}><span className={`badge ${KIND[a.kind].tone}`}>{KIND[a.kind].label}</span><span className={`badge ${STATUS[a.status].tone}`}>{STATUS[a.status].label}</span></span></div>
                            ))}
                        </div></div>
                    )}
                </>
            )}
        </Modal>
    );
}