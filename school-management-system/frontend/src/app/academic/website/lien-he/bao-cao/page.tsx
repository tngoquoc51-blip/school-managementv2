'use client';
import { useState } from 'react';
import { api, qs } from '@/app/academic/_lib/api';
import { downloadCsv, dt, useList, useToast } from '@/app/academic/website/_wm';
import { ST, span } from '../_lh';

const RANGES: [number, string][] = [[7, '7 ngày'], [30, '30 ngày'], [90, '90 ngày'], [365, '12 tháng']];

/** Báo cáo: khối lượng tin, thời gian phản hồi, tỉ lệ đúng cam kết, theo chủ đề và theo người xử lý. */
export default function Report() {
    const [days, setDays] = useState(30);
    const { data: d, err, loading, reload } = useList<any>(`website/inbox/report${qs({ days })}`);
    const toast = useToast();
    async function exportCsv() {
        try {
            const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
            const r = await api<any>(`website/inbox/export${qs({ from })}`);
            downloadCsv(`bao-cao-lien-he-${days}-ngay.csv`, ['Mã', 'Người gửi', 'Chủ đề', 'Trạng thái', 'Người phụ trách', 'Gửi lúc', 'Trả lời lần đầu', 'Quá hạn'],
                r.items.map((m: any) => [m.id, m.full_name, m.topic, ST[m.status], m.assigned_name || '', dt(m.created_at), dt(m.first_response_at), m.overdue ? 'Có' : '']));
            toast.ok(`Đã xuất ${r.items.length} dòng.`);
        } catch (e: any) { toast.fail(e.message); }
    }
    const max = Math.max(1, ...(d?.series ?? []).map((x: any) => x.n));
    const tmax = Math.max(1, ...(d?.topics ?? []).map((x: any) => x.n));
    return (
        <>
            {toast.node}
            <div className="wm-head" style={{ marginBottom: 14 }}>
                <div><h2 className="lh-h" style={{ margin: 0 }}>Báo cáo</h2><p className="wm-sub">Số liệu tính theo ngày nhận tin trong khoảng thời gian đã chọn.</p></div>
                <div className="wm-act">
                    <div className="lh-pills" style={{ margin: 0 }}>{RANGES.map(([k, v]) => <button key={k} className={`lh-pillbtn ${days === k ? 'on' : ''}`} onClick={() => setDays(k)}>{v}</button>)}</div>
                    <button className="wm-btn ghost" onClick={exportCsv}>Xuất Excel (CSV)</button>
                </div>
            </div>
            {err ? <div className="wm-state err">{err} <button className="wm-btn sm" onClick={reload}>Thử lại</button></div> : loading || !d ? <div className="wm-state">Đang tải…</div> : (
                <>
                    <div className="lh-kpis">
                        <div className="lh-kpi"><span>Tin nhận được</span><b>{d.total}</b><small>{d.spam} tin spam</small></div>
                        <div className="lh-kpi"><span>Đã trả lời</span><b>{d.answered}</b><small>{d.total ? Math.round((100 * d.answered) / d.total) : 0}% tổng số tin</small></div>
                        <div className="lh-kpi"><span>Phản hồi trung bình</span><b style={{ fontSize: 22 }}>{span(d.avg_response_minutes)}</b><small>Đến lần trả lời đầu tiên</small></div>
                        <div className={`lh-kpi ${d.sla_rate !== null && d.sla_rate < 80 ? 'hot' : ''}`}><span>Đúng cam kết {d.sla_hours} giờ</span><b>{d.sla_rate === null ? '—' : `${d.sla_rate}%`}</b><small>Tỉ lệ tin được trả lời kịp hạn</small></div>
                    </div>
                    <section className="wm-card lh-pad">
                        <h2 className="lh-h">Số tin theo thời gian{d.days > 90 ? ' (gộp theo tuần)' : ''}</h2>
                        <div className="lh-chart lh-chart-lg" role="img" aria-label="Biểu đồ số tin theo thời gian">
                            {d.series.map((x: any) => <div key={x.date} className="lh-col" title={`${x.date.split('-').reverse().join('/')}: ${x.n} tin`}><i style={{ height: `${Math.max(x.n ? 6 : 1, (x.n / max) * 100)}%` }} />{d.series.length <= 31 && <span>{x.date.slice(8)}</span>}</div>)}
                        </div>
                    </section>
                    <div className="lh-cols">
                        <section className="wm-card">
                            <div className="lh-pad"><h2 className="lh-h" style={{ margin: 0 }}>Theo chủ đề</h2></div>
                            {d.topics.length === 0 ? <div className="wm-state">Chưa có dữ liệu.</div> : <div className="wm-tw"><table className="wm-table" style={{ minWidth: 420 }}><thead><tr><th>Chủ đề</th><th>Số tin</th><th>Đã trả lời</th><th>Phản hồi TB</th></tr></thead><tbody>
                            {d.topics.map((t: any) => <tr key={t.topic}><td><b>{t.topic}</b><div className="lh-mini"><i style={{ width: `${(t.n / tmax) * 100}%` }} /></div></td><td>{t.n}</td><td>{Number(t.done)}</td><td>{span(t.avg_min === null ? null : Math.round(t.avg_min))}</td></tr>)}
                            </tbody></table></div>}
                        </section>
                        <section className="wm-card">
                            <div className="lh-pad"><h2 className="lh-h" style={{ margin: 0 }}>Theo người xử lý</h2></div>
                            {d.staff.length === 0 ? <div className="wm-state">Chưa có tin nào được giao cho ai trong kỳ này.</div> : <div className="wm-tw"><table className="wm-table" style={{ minWidth: 320 }}><thead><tr><th>Nhân viên</th><th>Được giao</th><th>Đã xong</th></tr></thead><tbody>
                            {d.staff.map((s: any) => <tr key={s.name}><td><b>{s.name}</b></td><td>{s.n}</td><td>{Number(s.done)}</td></tr>)}
                            </tbody></table></div>}
                        </section>
                    </div>
                </>
            )}
        </>
    );
}