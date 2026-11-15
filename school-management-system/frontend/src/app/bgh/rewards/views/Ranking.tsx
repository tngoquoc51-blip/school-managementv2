'use client';

import { useEffect, useMemo, useState } from 'react';
import { errMsg, rewardsApi } from '@/modules/bgh/rewards/rewardsService';
import type { Range, RankItem, ViewProps } from '@/modules/bgh/rewards/types';
import { Delta, Empty, fmt, Icon, Skeleton, sgn, useUI } from '../ui';

export default function Ranking({ yearId, date, period, rev, openClass, openScore }: ViewProps) {
    const { toast } = useUI();
    const [data, setData] = useState<{ range: Range; items: RankItem[] } | null>(null);
    const [grade, setGrade] = useState<number | ''>('');
    const [q, setQ] = useState('');
    const [err, setErr] = useState('');

    useEffect(() => {
        setData(null); setErr('');
        rewardsApi.ranking(yearId, period, date, grade || undefined).then(setData).catch((e) => setErr(errMsg(e)));
    }, [yearId, period, date, grade, rev]);

    const all = data?.items || [];
    const hasData = all.some((i) => i.weeks > 0);
    const items = useMemo(() => all.filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase())), [all, q]);
    const mn = Math.min(...all.map((i) => i.score)), mx = Math.max(...all.map((i) => i.score));
    const podium = hasData && !q ? all.slice(0, 3) : [];

    const exportCsv = () => {
        const rows = [['Hạng', 'Lớp', 'Khối', 'GVCN', 'Điểm', 'Điểm cộng', 'Điểm trừ', 'Số tuần có dữ liệu']];
        all.forEach((i) => rows.push([i.rank, i.name, i.grade, i.homeroom || '', i.score, i.plus, i.minus, i.weeks] as any));
        const csv = '\ufeff' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        a.download = `xep-hang-thi-dua-${date}.csv`;
        a.click();
        toast('success', 'Đã xuất bảng xếp hạng', `${all.length} lớp · ${data?.range.label}`);
    };

    if (err) return <div className="rw-err"><Icon n="alert" />{err}</div>;

    return (
        <div className="rw-stack">
            <div className="row">
                <div><b style={{ fontSize: 15 }}>{data?.range.label || 'Đang tải…'}</b></div>
                <span className="spacer" />
                {[['', 'Toàn trường'], [10, 'Khối 10'], [11, 'Khối 11'], [12, 'Khối 12']].map(([g, l]) => (
                    <button key={String(g)} className={`chip${grade === g ? ' on' : ''}`} onClick={() => setGrade(g as any)}>{l}</button>
                ))}
                <input placeholder="Tìm lớp…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm lớp" style={{ width: 130 }} />
                <button className="btn ghost" onClick={exportCsv} disabled={!data}><Icon n="download" s={16} />Xuất CSV</button>
            </div>

            {!data ? <Skeleton h={320} /> : (
                <>
                    {podium.length === 3 && (
                        <div className="podium">
                            {[podium[1], podium[0], podium[2]].map((i) => (
                                <button key={i.id} className={`pod p${i.rank <= 3 ? i.rank : 3}`} onClick={() => openClass(i.id)}>
                                    <div className="no">Hạng {i.rank}</div>
                                    <div className="nm">{i.name}</div>
                                    <div className="sc">{fmt(i.score)} điểm</div>
                                    <div className="hr">{i.homeroom || 'Chưa có GVCN'}</div>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="panel" style={{ overflow: 'auto' }}>
                        {!hasData && <div className="pb"><Empty icon="trophy" text="Kỳ này chưa có dữ liệu chấm điểm — tất cả các lớp đang ở mức điểm gốc." /></div>}
                        <table className="tbl">
                            <thead><tr><th>Hạng</th><th>Lớp</th><th>GVCN</th><th style={{ width: 200 }}>Điểm thi đua</th><th className="num">Cộng</th><th className="num">Trừ</th><th>Thứ hạng</th><th /></tr></thead>
                            <tbody>
                            {items.map((i) => (
                                <tr key={i.id} className="clk" onClick={() => openClass(i.id)}>
                                    <td><span className={`rank-no r${hasData && i.rank <= 3 ? i.rank : ''}`}>{i.rank}</span></td>
                                    <td><b>Lớp {i.name}</b><div className="hint">Khối {i.grade}</div></td>
                                    <td>{i.homeroom || <span className="muted">—</span>}</td>
                                    <td><b>{fmt(i.score)}</b><div className="scorebar"><i style={{ width: `${mx === mn ? 50 : 10 + ((i.score - mn) / (mx - mn)) * 90}%` }} /></div></td>
                                    <td className="num good-t">{sgn(i.plus)}</td>
                                    <td className="num bad-t">{sgn(i.minus)}</td>
                                    <td><Delta v={i.delta} /></td>
                                    <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                                        <button className="btn ghost sm" onClick={() => openScore([i.id])}>Chấm điểm</button>{' '}
                                    </td>
                                </tr>
                            ))}
                            {!items.length && <tr><td colSpan={8}><Empty text="Không tìm thấy lớp phù hợp." /></td></tr>}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}