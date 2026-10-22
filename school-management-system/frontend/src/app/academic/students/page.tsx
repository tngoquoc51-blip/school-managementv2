'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Empty, ErrorBox, Loading, PageHead, Pager, Pill, useApi } from '../_components/ui';
import { qs } from '../_lib/api';

export default function Students() {
    const [q, setQ] = useState('');
    const [dq, setDq] = useState('');
    const [grade, setGrade] = useState('');
    const [classId, setClassId] = useState('');
    const [gender, setGender] = useState('');
    const [page, setPage] = useState(1);
    useEffect(() => { const id = setTimeout(() => { setDq(q); setPage(1); }, 350); return () => clearTimeout(id); }, [q]);
    const classes = useApi<any>('classes');
    const { data, err, loading, reload } = useApi<any>(`students${qs({ q: dq, grade, class_id: classId, gender, page })}`);
    const cl = (classes.data?.items ?? []).filter((c: any) => !grade || String(c.grade) === grade);

    return (
        <>
            <PageHead title="Hồ sơ học sinh" sub="Tra cứu, xem và cập nhật hồ sơ của học sinh trong năm học hiện tại" />
            <Card pad={false}>
                <div className="ac-filters" style={{ padding: 16, margin: 0 }}>
                    <input className="ac-in" placeholder="Tìm theo họ tên hoặc mã học sinh…" value={q} onChange={(e) => setQ(e.target.value)} />
                    <select className="ac-sel" value={grade} onChange={(e) => { setGrade(e.target.value); setClassId(''); setPage(1); }}><option value="">Tất cả khối</option><option value="10">Khối 10</option><option value="11">Khối 11</option><option value="12">Khối 12</option></select>
                    <select className="ac-sel" value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1); }}><option value="">Tất cả lớp</option>{cl.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <select className="ac-sel" value={gender} onChange={(e) => { setGender(e.target.value); setPage(1); }}><option value="">Giới tính</option><option>Nam</option><option>Nữ</option></select>
                </div>
                {err ? <div style={{ padding: 16 }}><ErrorBox msg={err} retry={reload} /></div> : loading && !data ? <Loading /> : !data || data.items.length === 0 ? <Empty text="Không tìm thấy học sinh phù hợp." /> : (
                    <>
                        <div className="ac-tw"><table className="ac-table"><thead><tr><th>Mã HS</th><th>Họ và tên</th><th>Giới tính</th><th>Ngày sinh</th><th>Lớp</th><th>Tài khoản</th><th /></tr></thead><tbody>
                        {data.items.map((s: any) => (
                            <tr key={s.code}>
                                <td>{s.code}</td>
                                <td><Link className="lk" href={`/academic/students/${s.code}`}>{s.full_name}</Link></td>
                                <td>{s.gender}</td><td>{s.birth_date}</td>
                                <td><Link href={`/academic/classes/${s.class_id}`}>{s.class_name}</Link></td>
                                <td>{s.account_status !== 'active' ? <Pill tone="err">Bị khóa</Pill> : s.default_password ? <Pill tone="warn">Mật khẩu mặc định</Pill> : <Pill tone="ok">Đã đổi mật khẩu</Pill>}</td>
                                <td className="n"><Link className="ac-btn ghost sm" href={`/academic/students/${s.code}`}>Xem hồ sơ</Link></td>
                            </tr>
                        ))}</tbody></table></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', color: '#5b6f85', flexWrap: 'wrap' }}>
                            <span>Tổng <b>{data.total}</b> học sinh</span>
                            <Pager page={data.page} pages={data.pages} onChange={setPage} />
                        </div>
                    </>
                )}
            </Card>
        </>
    );
}