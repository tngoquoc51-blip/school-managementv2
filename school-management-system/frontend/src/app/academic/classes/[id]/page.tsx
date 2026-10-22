'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Bars, Card, ErrorBox, Loading, PageHead, Pill, Stat, fmt, useApi } from '../../_components/ui';

export default function ClassDetail() {
    const { id } = useParams<{ id: string }>();
    const { data, err, loading, reload } = useApi<any>(`classes/${id}`);
    if (loading) return <Loading />;
    if (err || !data) return <ErrorBox msg={err} retry={reload} />;
    const { class: c, stats, students, subjects } = data;
    const tone: Record<string, string> = { 'Giỏi': 'ok', 'Khá': 'pri', 'Trung bình': 'warn', 'Yếu': 'err', 'Kém': 'err' };
    return (
        <>
            <p style={{ marginBottom: 10 }}><Link href="/academic/classes" style={{ color: '#0369a1' }}>← Danh sách lớp</Link></p>
            <PageHead title={`Lớp ${c.name}`} sub={`Khối ${c.grade} · Năm học ${c.year} · GVCN: ${c.homeroom ?? '—'}`}
                      actions={<><Link className="ac-btn ghost" href={`/academic/timetable?class_id=${c.id}`}>Thời khóa biểu</Link><Link className="ac-btn ghost" href={`/academic/grades?class_id=${c.id}`}>Bảng điểm</Link></>} />
            <div className="ac-grid ac-g3" style={{ marginBottom: 18 }}>
                <Stat label="Sĩ số" value={stats.students} hint={`${stats.male} nam · ${stats.female} nữ`} />
                <Stat label="Điểm trung bình lớp" value={fmt(stats.avg)} tone="ok" />
                <div className="ac-card" style={{ marginBottom: 0, padding: 16 }}><Bars items={Object.entries(stats.ranks).map(([k, v]) => ({ label: k, value: v as number, tone: tone[k] }))} /></div>
            </div>
            <div className="ac-grid ac-g-main">
                <Card title="Danh sách học sinh" pad={false}>
                    <div className="ac-tw"><table className="ac-table"><thead><tr><th>STT</th><th>Mã HS</th><th>Họ và tên</th><th>Giới tính</th><th className="n">Cả năm</th><th>Học lực</th><th>Hạnh kiểm</th></tr></thead><tbody>
                    {students.map((s: any) => <tr key={s.code}><td>{s.no}</td><td>{s.code}</td><td><Link className="lk" href={`/academic/students/${s.code}`}>{s.full_name}</Link></td><td>{s.gender}</td><td className="n"><b>{fmt(s.avg)}</b></td><td>{s.rank ? <Pill>{s.rank}</Pill> : '—'}</td><td>{s.conduct ? <Pill>{s.conduct}</Pill> : '—'}</td></tr>)}
                    </tbody></table></div>
                </Card>
                <Card title="Môn học & giáo viên" pad={false}>
                    <div className="ac-tw"><table className="ac-table" style={{ minWidth: 0 }}><thead><tr><th>Môn</th><th>Giáo viên</th></tr></thead><tbody>
                    {subjects.map((s: any) => <tr key={s.id}><td>{s.subject}<span className="ac-sub">{s.periods} tiết/tuần</span></td><td>{s.teacher}</td></tr>)}
                    </tbody></table></div>
                </Card>
            </div>
        </>
    );
}