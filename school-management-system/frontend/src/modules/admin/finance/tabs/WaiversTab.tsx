'use client';

import { useState } from 'react';
import { finApi } from '@/services/adminFinanceService';
import { Empty, ErrorBox, Icon, Skeleton, fmtDate, fp, useDebounced, useFetch } from '../ui';
import type { Filters } from '../types';
import s from '../finance.module.css';

const KIND: Record<string, string> = { policy_family: 'Gia đình chính sách', poor_household: 'Hộ nghèo', near_poor: 'Hộ cận nghèo', sibling: 'Anh chị em ruột' };
const COLOR: Record<string, string> = { policy_family: '#2563eb', poor_household: '#e11d48', near_poor: '#d97706', sibling: '#7c3aed' };

export default function WaiversTab({ f }: { f: Filters }) {
    const [qIn, setQIn] = useState(''); const q = useDebounced(qIn); const [kind, setKind] = useState('');
    const key = JSON.stringify(f);
    const { data, loading, error, reload } = useFetch(() => finApi.waivers(fp(f, { q, kind })), [key, q, kind]);
    const total = data?.summary.reduce((a, x) => a + x.n, 0) ?? 0;

    return (
        <div className={s.panel}>
            <section className={s.card}>
                <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="percent" /> Miễn giảm học phí</h3><div className={s.cardSub}>{total} học sinh được miễn giảm trong năm học đã chọn</div></div></div>
                {data && (
                    <div className={s.sumRow}>{data.summary.map((x) => (
                        <button key={x.kind} className={s.sumBox} style={{ textAlign: 'left', cursor: 'pointer', borderColor: kind === x.kind ? COLOR[x.kind] : undefined }} onClick={() => setKind(kind === x.kind ? '' : x.kind)}>
                            <b style={{ color: COLOR[x.kind] }}>{x.n}</b><span>{KIND[x.kind] || x.kind} · TB giảm {x.avg_percent}%</span></button>))}</div>)}
                <div className={s.toolbar}>
                    <input className={s.input} style={{ minWidth: 240 }} placeholder="Tìm học sinh, mã HS, diện miễn giảm…" value={qIn} onChange={(e) => setQIn(e.target.value)} />
                    <select className={s.select} value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Mọi diện</option>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                </div>
                {error && !data ? <ErrorBox message={error} onRetry={reload} /> : !data ? <Skeleton h={48} n={6} /> : data.data.length === 0 ? <Empty icon="🎓" text="Không có học sinh nào được miễn giảm theo bộ lọc." /> : (
                    <div className={s.scroll} style={{ opacity: loading ? 0.6 : 1 }}>
                        <table className={s.table}>
                            <thead><tr><th>Học sinh</th><th>Lớp</th><th>Diện miễn giảm</th><th className={s.num}>Mức giảm</th><th>Người duyệt</th><th>Ngày</th></tr></thead>
                            <tbody>{data.data.map((w) => (
                                <tr key={w.id}><td><b>{w.student_name}</b><div className={s.cardSub}>{w.student_code}</div></td><td>{w.class_name || '—'}</td>
                                    <td><span className={s.badge} style={{ background: `${COLOR[w.kind] || '#64748b'}1a`, color: COLOR[w.kind] || '#64748b' }}>{KIND[w.kind] || w.kind}</span>{w.label && <div className={s.cardSub}>{w.label}</div>}</td>
                                    <td className={s.num}><b>{w.percent}%</b></td><td>{w.approved_by || '—'}</td><td>{fmtDate(w.created_at)}</td></tr>))}</tbody>
                        </table>
                    </div>)}
            </section>
        </div>
    );
}