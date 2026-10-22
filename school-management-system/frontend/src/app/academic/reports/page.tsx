'use client';
import { Bars, Card, ErrorBox, Loading, PageHead, fmt, useApi } from '../_components/ui';

const RT: Record<string, string> = { 'Giỏi': 'ok', 'Khá': 'pri', 'Trung bình': 'warn', 'Yếu': 'err', 'Kém': 'err' };
const CT: Record<string, string> = { 'Tốt': 'ok', 'Khá': 'pri', 'Đạt': 'warn', 'Chưa đạt': 'err' };

export default function Reports() {
    const { data, err, loading, reload } = useApi<any>('reports');
    if (loading) return <Loading />;
    if (err || !data) return <ErrorBox msg={err} retry={reload} />;
    const pct = (n: number, t: number) => (t ? Math.round((n * 100) / t) : 0);
    return (
        <>
            <PageHead title="Báo cáo thống kê" sub={`Năm học ${data.year} · Tổng hợp theo khối`} actions={<button className="ac-btn ghost" onClick={() => window.print()}>In báo cáo</button>} />
            <Card title="Học lực & hạnh kiểm theo khối" pad={false}>
                <div className="ac-tw"><table className="ac-table"><thead><tr><th>Khối</th><th className="n">Học sinh</th><th className="n">Điểm TB</th>{Object.keys(RT).map((k) => <th key={k} className="n">{k}</th>)}<th className="n">Hạnh kiểm Tốt</th><th className="n">Chưa đạt</th></tr></thead><tbody>
                {data.grades.map((g: any) => <tr key={g.grade}><td><b>Khối {g.grade}</b></td><td className="n">{g.students}</td><td className="n"><b>{fmt(g.avg)}</b></td>{Object.keys(RT).map((k) => <td key={k} className="n">{g.ranks[k]} <span className="ac-sub" style={{ display: 'inline' }}>({pct(g.ranks[k], g.students)}%)</span></td>)}<td className="n">{pct(g.conduct['Tốt'] ?? 0, g.students)}%</td><td className="n">{g.conduct['Chưa đạt'] ?? 0}</td></tr>)}
                </tbody></table></div>
            </Card>
            <div className="ac-grid ac-g3">
                {data.grades.map((g: any) => (
                    <Card key={g.grade} title={`Khối ${g.grade}`}>
                        <p style={{ color: '#5b6f85', margin: '0 0 8px' }}>Học lực</p>
                        <Bars items={Object.entries(g.ranks).map(([k, v]) => ({ label: k, value: v as number, tone: RT[k] }))} />
                        <p style={{ color: '#5b6f85', margin: '14px 0 8px' }}>Hạnh kiểm</p>
                        <Bars items={Object.entries(g.conduct).map(([k, v]) => ({ label: k, value: v as number, tone: CT[k] }))} />
                    </Card>
                ))}
            </div>
            <Card title="Điểm trung bình theo môn" pad={false}>
                <div className="ac-tw"><table className="ac-table"><thead><tr><th>Môn</th>{data.grades.map((g: any) => <th key={g.grade} className="n">Khối {g.grade}</th>)}</tr></thead><tbody>
                {data.subjects.map((s: any) => <tr key={s.subject}><td>{s.subject}</td>{data.grades.map((g: any) => <td key={g.grade} className="n">{fmt(s.by_grade[g.grade])}</td>)}</tr>)}
                </tbody></table></div>
            </Card>
        </>
    );
}