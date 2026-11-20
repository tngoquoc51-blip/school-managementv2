'use client';

import { Donut, Empty, Icon, RATING, fmtDateTime, ratingBadge, periodLabel } from '../ui';
import type { Overview, TabKey } from '../types';
import s from '../comments.module.css';

export default function OverviewTab({ ov, pick, go }: { ov: Overview; pick: (cs: number) => void; go: (t: TabKey) => void }) {
    const parts = ov.ratings.map((r) => ({ label: RATING[r.rating]?.label || r.rating, value: r.n, color: RATING[r.rating]?.color || '#64748b' }));
    const total = parts.reduce((a, p) => a + p.value, 0);
    return (
        <div className={`${s.panel} ${s.stack}`}>
            <div className={s.g21}>
                <section className={s.card}>
                    <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="chart" /> Tiến độ nhận xét theo lớp – môn</h3><div className={s.cardSub}>Tính theo kỳ nhận xét đang chọn ở đầu trang</div></div></div>
                    {ov.progress.length === 0 ? <Empty icon="📚" text="Bạn chưa được phân công lớp – môn nào trong năm học hiện tại." /> : ov.progress.map((p) => {
                        const pct = p.students ? Math.round((p.written / p.students) * 100) : 0;
                        return (
                            <div key={p.assignment.id} className={s.progressRow}>
                                <div><b>Lớp {p.assignment.class_name}</b><div className={s.cardSub}>{p.assignment.subject_name}</div></div>
                                <div><div className={s.bar}><div className={s.barFill} style={{ width: `${pct}%` }} /></div>
                                    <div className={s.cardSub} style={{ marginTop: 4 }}>{p.written}/{p.students} ({pct}%) · {p.published} đã công bố · {p.draft} nháp</div></div>
                                <div style={{ textAlign: 'right' }}><button className={`${s.btn} ${s.btnS} ${pct < 100 ? s.btnP : ''}`} onClick={() => pick(p.assignment.id)}><Icon n="pen" size={14} /> {pct < 100 ? 'Soạn tiếp' : 'Xem lại'}</button></div>
                            </div>);
                    })}
                </section>
                <section className={s.card}>
                    <div className={s.cardHead}><h3 className={s.cardTitle}><Icon n="star" /> Cơ cấu đánh giá</h3></div>
                    {total === 0 ? <Empty icon="📊" text="Chưa có nhận xét nào trong học kỳ này." /> : (
                        <div className={s.donutRow}><Donut parts={parts} center={String(total)} />
                            <div className={s.legend}>{parts.map((p) => <div key={p.label} className={s.lgItem}><span className={s.lgDot} style={{ background: p.color }} />{p.label}<span className={s.lgVal}>{p.value}</span></div>)}</div></div>)}
                    <div className={s.cardSub} style={{ marginTop: 10 }}>Tổng số nhận xét bạn đã viết trong học kỳ</div>
                </section>
            </div>
            <section className={s.card}>
                <div className={s.cardHead}><h3 className={s.cardTitle}><Icon n="clock" /> Nhận xét gần đây</h3><button className={s.btn} onClick={() => go('history')}>Xem tất cả</button></div>
                {ov.recent.length === 0 ? <Empty icon="📝" text="Chưa có nhận xét nào." /> : ov.recent.map((r) => (
                    <div key={r.id} className={s.recentItem}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b>{r.student_name}</b>{ratingBadge(r.rating)}
                                <span className={`${s.badge} ${r.status === 'published' ? s.bOk : s.bMute}`}>{r.status === 'published' ? 'Đã công bố' : 'Bản nháp'}</span></div>
                            <div className={s.cardSub}>{r.student_code} · Lớp {r.class_name} · {r.subject_name} · {periodLabel(r.kind, r.period)} · {fmtDateTime(r.updated_at)}</div>
                            <div className={s.clamp} style={{ marginTop: 4 }}>{r.content}</div>
                        </div>
                    </div>))}
            </section>
        </div>
    );
}