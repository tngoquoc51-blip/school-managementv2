'use client';
import Link from 'next/link';
import { useList } from '@/app/academic/website/_wm';
import { Av, BASE, StPill, ago, span } from './_lh';

/** Tổng quan: số liệu chính, biểu đồ 14 ngày, theo chủ đề, khối lượng việc của từng người. */
export default function Overview() {
    const { data: d, err, loading, reload } = useList<any>('website/inbox/overview');
    if (err) return <div className="wm-state err">{err} <button className="wm-btn sm" onClick={reload}>Thử lại</button></div>;
    if (loading || !d) return <div className="wm-state">Đang tải…</div>;
    const c = d.counts;
    const max = Math.max(1, ...d.series.map((x: any) => x.n));
    const tmax = Math.max(1, ...d.topics.map((x: any) => x.n));
    return (
        <>
            <div className="lh-kpis">
                <Link href={`${BASE}/hop-thu?status=new`} className="lh-kpi hot"><span>Tin mới chưa nhận</span><b>{c.new}</b><small>Cần phân công và trả lời</small></Link>
                <Link href={`${BASE}/hop-thu?status=working`} className="lh-kpi"><span>Đang xử lý</span><b>{c.working}</b><small>Đã có người nhận</small></Link>
                <Link href={`${BASE}/hop-thu?overdue=1`} className={`lh-kpi ${d.overdue ? 'hot' : ''}`}><span>Quá hạn {d.sla_hours} giờ</span><b>{d.overdue}</b><small>Chưa phản hồi đúng cam kết</small></Link>
                <Link href={`${BASE}/hop-thu?assigned=none&status=open`} className="lh-kpi"><span>Chưa giao người</span><b>{d.unassigned}</b><small>Tin đang mở, chưa có người phụ trách</small></Link>
                <div className="lh-kpi"><span>Phản hồi trung bình (30 ngày)</span><b style={{ fontSize: 22 }}>{span(d.avg_response_minutes)}</b><small>Từ lúc gửi đến lần trả lời đầu</small></div>
                <div className="lh-kpi"><span>Nhận hôm nay</span><b>{d.today}</b><small>Tổng {c.total} tin từ trước đến nay</small></div>
            </div>

            <div className="lh-cols">
                <section className="wm-card lh-pad">
                    <h2 className="lh-h">Tin nhắn 14 ngày gần đây</h2>
                    <div className="lh-chart" role="img" aria-label="Biểu đồ số tin nhắn theo ngày">
                        {d.series.map((x: any) => (
                            <div key={x.date} className="lh-col" title={`${x.date.split('-').reverse().join('/')}: ${x.n} tin`}>
                                <i style={{ height: `${Math.max(x.n ? 8 : 2, (x.n / max) * 100)}%` }}><em>{x.n || ''}</em></i>
                                <span>{x.date.slice(8)}</span>
                            </div>
                        ))}
                    </div>
                </section>
                <section className="wm-card lh-pad">
                    <h2 className="lh-h">Theo chủ đề</h2>
                    {d.topics.length === 0 ? <p className="wm-sub">Chưa có dữ liệu.</p> : d.topics.map((t: any) => (
                        <div key={t.topic} className="lh-bar">
                            <span>{t.topic}</span>
                            <div><i style={{ width: `${(t.n / tmax) * 100}%` }} /></div>
                            <b>{t.n}</b>{Number(t.open_n) > 0 && <small>{t.open_n} đang mở</small>}
                        </div>
                    ))}
                </section>
            </div>

            <div className="lh-cols">
                <section className="wm-card">
                    <div className="lh-pad lh-between"><h2 className="lh-h" style={{ margin: 0 }}>Tin mới cần xử lý</h2><Link className="wm-btn ghost sm" href={`${BASE}/hop-thu?status=open`}>Mở hộp thư</Link></div>
                    {d.latest.length === 0 ? <div className="wm-state">Không có tin mới. Hộp thư đang gọn gàng.</div> : (
                        <ul className="lh-list">
                            {d.latest.map((m: any) => (
                                <li key={m.id}><Link href={`${BASE}/hop-thu/${m.id}`}>
                                    <Av name={m.full_name} />
                                    <div><b>{m.full_name}{Number(m.priority) === 1 && <span className="lh-flag">Ưu tiên</span>}</b><p>{m.message}</p></div>
                                    <small>{m.topic}<br />{ago(m.created_at)}</small>
                                </Link></li>
                            ))}
                        </ul>
                    )}
                </section>
                <section className="wm-card lh-pad">
                    <h2 className="lh-h">Khối lượng việc đang mở</h2>
                    {d.workload.length === 0 ? <p className="wm-sub">Chưa có tin nào được giao cho ai. Mở một tin và chọn người phụ trách.</p> : d.workload.map((w: any) => (
                        <div key={w.u} className="lh-person"><Av name={w.name} /><span>{w.name}</span><b>{w.n} tin</b></div>
                    ))}
                    <div className="lh-stat-row">
                        <span><StPill s="done" /> {c.done}</span><span><StPill s="spam" /> {c.spam}</span>
                    </div>
                </section>
            </div>
        </>
    );
}