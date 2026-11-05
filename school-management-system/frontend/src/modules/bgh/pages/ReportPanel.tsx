'use client';

import { useEffect, useState } from 'react';
import c from './approval.module.css';
import { approvalApi, type Report } from '../services/approvalService';

const TYPE = { profile: 'Hồ sơ học sinh', leave: 'Đơn xin nghỉ', dispute: 'Khiếu nại hóa đơn' } as const;

export default function ReportPanel() {
    const [days, setDays] = useState(30);
    const [r, setR] = useState<Report | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let live = true;
        approvalApi.report(days).then((d) => { if (live) { setR(d); setError(''); } }).catch((e) => live && setError(e instanceof Error ? e.message : 'Lỗi tải báo cáo'));
        return () => { live = false; };
    }, [days]);

    const ok = r?.daily.reduce((s, x) => s + Number(x.ok), 0) ?? 0;
    const bad = r?.daily.reduce((s, x) => s + Number(x.bad), 0) ?? 0;
    const max = Math.max(1, ...(r?.daily.map((x) => Number(x.ok) + Number(x.bad)) ?? [1]));

    return (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
            <div className={c.views}>
                {[7, 30, 90].map((d) => <button key={d} className={c.view} aria-pressed={days === d} onClick={() => setDays(d)}>{d} ngày</button>)}
            </div>
            {error && <div role="alert" className={c.err}>{error}</div>}
            <div className={c.kpis}>
                <div className={c.kpi}><small>Đã xử lý</small><b>{ok + bad}</b></div>
                <div className={c.kpi}><small>Tỉ lệ duyệt</small><b>{ok + bad ? Math.round((ok / (ok + bad)) * 100) : 0}%</b></div>
                <div className={c.kpi}><small>Thời gian xử lý trung bình</small><b>{r?.avg_hours ?? '–'}{r?.avg_hours != null && ' giờ'}</b></div>
            </div>
            <section className={c.panel}>
                <div className={c.sec}><h2>Số lượng xử lý theo ngày</h2></div>
                {!r || r.daily.length === 0 ? <p className={c.empty}>Chưa có yêu cầu nào được xử lý trong khoảng này.</p> : (
                    <>
                        <div className={c.chart} role="img" aria-label="Biểu đồ số yêu cầu xử lý theo ngày">
                            {r.daily.map((x) => (
                                <div key={x.d} className={c.col} title={`${x.d}: ${x.ok} duyệt, ${x.bad} từ chối`} style={{ height: `${((Number(x.ok) + Number(x.bad)) / max) * 100}%` }}>
                                    <div className={c.cOk} style={{ flex: Number(x.ok) }} /><div className={c.cBad} style={{ flex: Number(x.bad) }} />
                                </div>
                            ))}
                        </div>
                        <div className={c.legend}><span>■ <span style={{ color: '#15935f' }}>Duyệt</span></span><span>■ <span style={{ color: '#d6402f' }}>Từ chối</span></span></div>
                    </>
                )}
            </section>
            <div className={c.cols} style={{ gridTemplateColumns: '1fr 1fr' }}>
                <section className={`${c.panel} ${c.pad}`}>
                    <h2>Theo loại yêu cầu</h2>
                    {r?.by_type.map((t) => { const a = Number(t.ok), b = Number(t.bad); return (
                        <div key={t.type} style={{ marginTop: '.9rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{TYPE[t.type]}</b><small>{a} duyệt · {b} từ chối</small></div>
                            <div className={c.meter}><div style={{ flex: a, background: '#15935f' }} /><div style={{ flex: b, background: '#d6402f' }} /></div>
                        </div>); })}
                    {r && r.by_type.length === 0 && <p className={c.sub}>Chưa có dữ liệu.</p>}
                </section>
                <section className={`${c.panel} ${c.pad}`}>
                    <h2>Người xử lý nhiều nhất</h2>
                    {r?.top.map((t, i) => <div key={t.actor_name} className={c.item} style={{ padding: '.7rem 0' }}><span>{i + 1}. {t.actor_name}</span><b>{t.c}</b></div>)}
                    {r && r.top.length === 0 && <p className={c.sub}>Chưa có dữ liệu.</p>}
                </section>
            </div>
        </div>
    );
}