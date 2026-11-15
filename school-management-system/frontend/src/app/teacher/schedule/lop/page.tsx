'use client';
// Lớp của tôi (/teacher/schedule/lop)
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useMemo, useState } from 'react';
import { Card, Drawer, Empty, ErrorBox, Ico, Loading, Pill, num, useLoad } from '../../attendance/_ta';
import { ClassTable, subjStyle, tk } from '../_tk';

type Row = { class_id: number; class_name: string; grade: number; subject_id: number; subject: string; cs: number; per_week: number; total: number; is_home: boolean };
type Res = { data: Row[]; homeroom: { id: number; name: string; grade: number } | null };

function Inner() {
    const qp = useSearchParams();
    const [open, setOpen] = useState<number | null>(qp.get('c') ? Number(qp.get('c')) : null);
    const [q, setQ] = useState(''); const [g, setG] = useState('');
    const { data, err, loading, reload } = useLoad(() => tk<Res>('classes'), []);
    const groups = useMemo(() => {
        const m = new Map<number, { id: number; name: string; grade: number; total: number; home: boolean; rows: Row[] }>();
        (data?.data || []).forEach((r) => { const x = m.get(r.class_id) || { id: r.class_id, name: r.class_name, grade: r.grade, total: r.total, home: false, rows: [] }; x.rows.push(r); x.home = x.home || r.is_home; m.set(r.class_id, x); });
        if (data?.homeroom && !m.has(data.homeroom.id)) m.set(data.homeroom.id, { id: data.homeroom.id, name: data.homeroom.name, grade: data.homeroom.grade, total: 0, home: true, rows: [] });
        return Array.from(m.values()).filter((x) => (!g || String(x.grade) === g) && (!q || x.name.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name));
    }, [data, q, g]);
    const grades = Array.from(new Set((data?.data || []).map((r) => r.grade))).sort();
    const totalStu = groups.reduce((s, x) => s + x.total, 0);

    return (
        <div className="ta-page">
            <div className="ta-toolbar">
                <input placeholder="Tìm lớp…" value={q} onChange={(e) => setQ(e.target.value)} />
                <select value={g} onChange={(e) => setG(e.target.value)}><option value="">Tất cả các khối</option>{grades.map((x) => <option key={x} value={x}>Khối {x}</option>)}</select>
                <span className="ta-mute">{groups.length} lớp · {num(totalStu)} học sinh</span>
            </div>
            {loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /> : groups.length === 0
                ? <Card><Empty icon="users" title="Chưa có lớp nào" text="Bạn chưa được phân công giảng dạy lớp nào trong năm học hiện tại." /></Card>
                : <div className="ts-classes">{groups.map((c) => (
                    <div className="ts-cls" key={c.id}>
                        <header><h3>{c.name}</h3>{c.home && <Pill tone="amber" dot>Chủ nhiệm</Pill>}</header>
                        <span className="ta-mute">Khối {c.grade} · {num(c.total)} học sinh</span>
                        {c.rows.length > 0 && <ul>{c.rows.map((r) => <li key={r.cs} style={subjStyle(r.subject_id)}>{r.subject}<small>{r.per_week} tiết/tuần</small></li>)}</ul>}
                        <div className="foot">
                            <button className="ta-btn sm primary" onClick={() => setOpen(c.id)}><Ico n="cal" size={14} />TKB của lớp</button>
                            {c.home && <Link href="/teacher/attendance/chu-nhiem" className="ta-btn sm"><Ico n="school" size={14} />Chuyên cần lớp</Link>}
                        </div>
                    </div>))}</div>}
            {open !== null && <Drawer title="Thời khóa biểu của lớp" onClose={() => setOpen(null)}><ClassTable id={open} /></Drawer>}
        </div>
    );
}
export default function ClassesPage() { return <Suspense fallback={<Loading />}><Inner /></Suspense>; }