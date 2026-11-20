'use client';
import { useEffect, useState } from 'react';
import { wApi, errMsg } from './api';
import { CHART, fmtDateTime, moneyShort } from './format';
import type { Stats } from './types';
import { Badge, Empty, Icon, Skeleton, useUI } from './ui';

function Donut({ data }: { data: { label: string; value: number }[] }) {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    const R = 54, C = 2 * Math.PI * R;
    let off = 0;
    return (
        <div className="wv-donut">
            <svg width="150" height="150" viewBox="0 0 140 140" role="img" aria-label="Cơ cấu theo chính sách">
                <circle cx="70" cy="70" r={R} fill="none" stroke="var(--line)" strokeWidth="18" />
                {data.map((d, i) => {
                    const len = (d.value / total) * C;
                    const el = <circle key={i} cx="70" cy="70" r={R} fill="none" stroke={CHART[i % CHART.length]} strokeWidth="18"
                                       strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 70 70)" />;
                    off += len; return el;
                })}
                <text x="70" y="68" textAnchor="middle" fontSize="22" fontWeight="800" fill="currentColor">{total === 1 && !data.length ? 0 : total}</text>
                <text x="70" y="86" textAnchor="middle" fontSize="10" fill="var(--muted)">bản ghi</text>
            </svg>
            <div className="wv-legend">
                {data.map((d, i) => (<div key={d.label}><span><i style={{ background: CHART[i % CHART.length] }} />{d.label}</span><b>{d.value}</b></div>))}
            </div>
        </div>
    );
}

export default function OverviewTab({ yearId, tick, goto }: { yearId: number; tick: number; goto: (tab: string) => void }) {
    const { toast } = useUI();
    const [s, setS] = useState<Stats | null>(null);

    useEffect(() => {
        let live = true; setS(null);
        wApi.stats(yearId).then((d) => live && setS(d)).catch((e) => toast('error', 'Không tải được thống kê', errMsg(e)));
        return () => { live = false; };
    }, [yearId, tick, toast]);

    if (!s) return <div className="wv-card"><Skeleton rows={8} /></div>;

    const pctStudents = s.enrolled ? ((s.students / s.enrolled) * 100).toFixed(1) : '0';
    const maxG = Math.max(1, ...s.by_grade.map((g) => g.students));
    const months = Array.from(new Set(s.trend.map((t) => t.m)));
    const maxM = Math.max(1, ...months.map((m) => s.trend.filter((t) => t.m === m).reduce((a, b) => a + b.c, 0)));

    return (
        <div className="wv-grid">
            <div className="wv-grid wv-g4">
                <div className="wv-card wv-stat"><div className="ic c-warn"><Icon n="clock" size={22} /></div><div><div className="v">{s.requests.pending}</div><div className="l">Đơn chờ duyệt</div></div></div>
                <div className="wv-card wv-stat"><div className="ic c-ok"><Icon n="check" size={22} /></div><div><div className="v">{s.active_count}</div><div className="l">Miễn giảm đang áp dụng</div></div></div>
                <div className="wv-card wv-stat"><div className="ic c-info"><Icon n="users" size={22} /></div><div><div className="v">{s.students} <small style={{ fontSize: 13, color: 'var(--muted)' }}>/ {s.enrolled}</small></div><div className="l">Học sinh được hỗ trợ ({pctStudents}%)</div></div></div>
                <div className="wv-card wv-stat"><div className="ic c-pri"><Icon n="wallet" size={22} /></div><div><div className="v">{moneyShort(s.estimate)}</div><div className="l">Giá trị miễn giảm ước tính</div></div></div>
            </div>

            <div className="wv-grid wv-g2">
                <div className="wv-card">
                    <h3>Cơ cấu theo chính sách</h3>
                    {s.by_type.length ? <Donut data={s.by_type.map((t) => ({ label: t.label, value: t.count }))} /> : <Empty icon="percent" title="Chưa có miễn giảm nào" hint="Lập đơn đề nghị để bắt đầu." />}
                </div>
                <div className="wv-card">
                    <h3>Học sinh được miễn giảm theo khối</h3>
                    {s.by_grade.length ? (
                        <div className="wv-bars">
                            {s.by_grade.map((g) => (
                                <div key={g.grade} className="wv-bar1"><b>{g.students}</b><div style={{ height: `${(g.students / maxG) * 100}%` }} /><span>Khối {g.grade}</span></div>
                            ))}
                        </div>
                    ) : <Empty icon="grid" title="Chưa có dữ liệu" />}
                </div>
            </div>

            <div className="wv-grid wv-g2">
                <div className="wv-card">
                    <h3 style={{ display: 'flex', justifyContent: 'space-between' }}>Đơn chờ xử lý <button className="wv-btn sm" onClick={() => goto('requests')}>Xem tất cả</button></h3>
                    {s.pending_queue.length ? (
                        <div className="wv-queue">
                            {s.pending_queue.map((q) => (
                                <div className="wv-q" key={q.id}>
                                    <div><b>{q.student_name}</b> <span className="wv-sub">· {q.class_name || '—'} · {q.student_code}</span><div className="wv-sub">{q.label} · {q.percent}% · {fmtDateTime(q.requested_at)}</div></div>
                                    {q.priority === 'high' ? <Badge s="high" label="Ưu tiên" /> : <Badge s="pending" />}
                                </div>
                            ))}
                        </div>
                    ) : <Empty icon="check" title="Không còn đơn nào chờ duyệt" hint="Tuyệt vời, mọi đơn đã được xử lý." />}
                </div>
                <div className="wv-card">
                    <h3>Kết quả xử lý đơn (6 tháng gần nhất)</h3>
                    {months.length ? (
                        <div className="wv-bars">
                            {months.map((m) => {
                                const ok = s.trend.find((t) => t.m === m && t.status === 'approved')?.c || 0;
                                const no = s.trend.filter((t) => t.m === m && t.status !== 'approved').reduce((a, b) => a + b.c, 0);
                                return (
                                    <div key={m} className="wv-bar1"><b>{ok + no}</b>
                                        <div style={{ height: `${((ok + no) / maxM) * 100}%`, background: no ? `linear-gradient(180deg,var(--bad) ${(no / (ok + no)) * 100}%,var(--ok) 0)` : 'linear-gradient(180deg,#34d399,var(--ok))' }} />
                                        <span>{m.slice(5)}/{m.slice(2, 4)}</span></div>
                                );
                            })}
                        </div>
                    ) : <Empty icon="clock" title="Chưa có đơn nào được xử lý" />}
                    <p className="wv-sub" style={{ margin: '8px 0 0' }}>Xanh: duyệt · Đỏ: từ chối/hủy. Số liệu ước tính tính theo học phí/học kỳ hiện hành.</p>
                </div>
            </div>

            {s.by_type.length > 0 && (
                <div className="wv-card">
                    <h3>Giá trị ước tính theo chính sách</h3>
                    <div className="wv-tw" style={{ boxShadow: 'none' }}>
                        <table className="wv-t" style={{ minWidth: 480 }}>
                            <thead><tr><th>Chính sách</th><th>Số học sinh</th><th>Giá trị ước tính</th></tr></thead>
                            <tbody>{s.by_type.map((t) => <tr key={t.kind}><td><b>{t.label}</b></td><td>{t.count}</td><td className="wv-money">{moneyShort(t.estimate)}</td></tr>)}</tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}