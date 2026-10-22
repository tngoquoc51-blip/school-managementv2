'use client';
import Link from 'next/link';
import { Bars, Card, Empty, ErrorBox, Loading, PageHead, Stat, fmtDT, useApi } from '../_components/ui';

export default function Dashboard() {
    const { data: d, err, loading, reload } = useApi<any>('dashboard');
    if (loading) return <Loading />;
    if (err || !d) return <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} />;
    const t = d.totals;
    const rankTone: Record<string, string> = { 'Giỏi': 'ok', 'Khá': 'pri', 'Trung bình': 'warn', 'Yếu': 'err', 'Kém': 'err' };
    return (
        <>
            <PageHead title="Tổng quan" sub={`Năm học ${d.year}`} actions={<Link className="ac-btn" href="/academic/students/requests">Duyệt hồ sơ{t.pending_requests > 0 ? ` (${t.pending_requests})` : ''}</Link>} />
            <div className="ac-grid ac-g4" style={{ marginBottom: 18 }}>
                <Stat label="Học sinh" value={t.students} hint={`${t.male} nam · ${t.female} nữ`} />
                <Stat label="Lớp học" value={t.classes} hint={`${d.by_grade.length} khối`} tone="ok" />
                <Stat label="Giáo viên" value={t.teachers} hint="Đang giảng dạy" tone="ok" />
                <Stat label="Hồ sơ chờ duyệt" value={t.pending_requests} hint={t.avg_score ? `Điểm TB toàn trường ${t.avg_score}` : undefined} tone={t.pending_requests ? 'warn' : 'ok'} />
            </div>
            <div className="ac-grid ac-g-main">
                <div>
                    <Card title="Việc cần xử lý">
                        <div style={{ margin: '-20px' }}>
                            {d.tasks.map((k: any) => (
                                <Link key={k.key} href={k.link} className="ac-task">
                                    <i className={`ac-dot ${k.level}`} /><span>{k.label}</span>
                                    <b>{k.count ?? '—'}{k.total ? <small style={{ color: '#5b6f85', fontWeight: 400 }}> / {k.total}</small> : null}</b>
                                </Link>
                            ))}
                        </div>
                    </Card>
                    <Card title="Đề nghị chỉnh sửa gần đây" right={<Link href="/academic/students/requests" className="ac-btn ghost sm">Xem tất cả</Link>} pad={false}>
                        {d.recent_requests.length === 0 ? <Empty text="Không có hồ sơ nào đang chờ duyệt." /> : (
                            <div className="ac-tw"><table className="ac-table"><thead><tr><th>Học sinh</th><th>Thông tin</th><th>Đề nghị</th><th>Gửi lúc</th></tr></thead><tbody>
                            {d.recent_requests.map((r: any) => (
                                <tr key={r.id}><td><Link className="lk" href={`/academic/students/${r.student.code}`}>{r.student.name}</Link><span className="ac-sub">{r.student.code} · {r.student.class}</span></td>
                                    <td>{r.field_label}</td><td>{r.new_value}</td><td>{fmtDT(r.created_at)}</td></tr>
                            ))}</tbody></table></div>
                        )}
                    </Card>
                </div>
                <div>
                    <Card title="Học lực toàn trường">
                        <Bars items={Object.entries(d.ranks).map(([k, v]) => ({ label: k, value: v as number, tone: rankTone[k] }))} />
                    </Card>
                    <Card title="Quy mô theo khối">
                        <Bars items={d.by_grade.map((g: any) => ({ label: `Khối ${g.grade}`, value: g.students }))} />
                        <p style={{ color: '#5b6f85', marginTop: 12, fontSize: 12.5 }}>{d.by_grade.map((g: any) => `Khối ${g.grade}: ${g.classes} lớp`).join(' · ')}</p>
                    </Card>
                </div>
            </div>
        </>
    );
}