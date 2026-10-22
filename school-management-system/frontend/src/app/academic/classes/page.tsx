'use client';
import Link from 'next/link';
import { Card, ErrorBox, Loading, PageHead, fmt, useApi } from '../_components/ui';

export default function Classes() {
    const { data, err, loading, reload } = useApi<any>('classes');
    if (loading) return <Loading />;
    if (err || !data) return <ErrorBox msg={err} retry={reload} />;
    const grades = [10, 11, 12];
    return (
        <>
            <PageHead title="Quản lý lớp" sub={`Năm học ${data.year} · ${data.items.length} lớp`} />
            {grades.map((g) => {
                const rows = data.items.filter((c: any) => c.grade === g);
                if (!rows.length) return null;
                return (
                    <Card key={g} title={`Khối ${g}`} right={<span style={{ color: '#5b6f85' }}>{rows.reduce((s: number, c: any) => s + c.students, 0)} học sinh</span>} pad={false}>
                        <div className="ac-tw"><table className="ac-table"><thead><tr><th>Lớp</th><th>Giáo viên chủ nhiệm</th><th className="n">Sĩ số</th><th className="n">Nam / Nữ</th><th className="n">Điểm TB</th><th className="n">Khá giỏi</th><th /></tr></thead><tbody>
                        {rows.map((c: any) => (
                            <tr key={c.id}><td><Link className="lk" href={`/academic/classes/${c.id}`}>{c.name}</Link></td><td>{c.homeroom ?? '—'}</td><td className="n">{c.students}</td><td className="n">{c.male} / {c.female}</td><td className="n"><b>{fmt(c.avg)}</b></td><td className="n">{c.good_rate ?? '—'}%</td><td className="n"><Link className="ac-btn ghost sm" href={`/academic/classes/${c.id}`}>Chi tiết</Link></td></tr>
                        ))}</tbody></table></div>
                    </Card>
                );
            })}
        </>
    );
}