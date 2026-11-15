'use client';

import { useCallback, useEffect, useState } from 'react';
import s from '../categories.module.css';
import { catalogService, getErrorMessage } from '../catalogApi';
import Icon from '../components/Icon';
import { Badge, ErrorState, timeAgo } from '../components/ui';
import { ACTION_LABELS, ENTITY_LABELS } from '../constants';
import type { Overview, TabId } from '../types';

const BAR_COLORS = ['#0b6aa2', '#1b9fde', '#14b8a6', '#f59e0b', '#ef6c4d', '#7c8cf8', '#64748b'];

function Bars({ data }: { data: { key: string; label: string; count: number }[] }) {
    const max = Math.max(1, ...data.map((d) => d.count));
    if (data.length === 0) return <p className={s.muted}>Chưa có dữ liệu.</p>;
    return (
        <ul className={s.bars}>
            {data.map((d, i) => (
                <li key={d.key}>
                    <span>{d.label}</span>
                    <div className={s.barTrack}><i style={{ width: `${(d.count / max) * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} /></div>
                    <b>{d.count}</b>
                </li>
            ))}
        </ul>
    );
}

export default function OverviewTab({ onNavigate, refreshToken }: { onNavigate: (t: TabId) => void; refreshToken: number }) {
    const [data, setData] = useState<Overview | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setData(await catalogService.overview());
            setError(null);
        } catch (e) {
            setError(getErrorMessage(e));
        }
    }, []);

    useEffect(() => { void load(); }, [load, refreshToken]);

    if (error) return <div className={s.panel}><ErrorState message={error} onRetry={() => void load()} /></div>;
    if (!data) {
        return (
            <div className={s.statGrid}>
                {[0, 1, 2, 3].map((i) => <div key={i} className={`${s.statCard} ${s.skelCard}`} />)}
            </div>
        );
    }

    const c = data.counts;
    const stats: { tab: TabId; icon: string; label: string; value: number; sub: string; tone: string }[] = [
        { tab: 'subjects', icon: 'book', label: 'Môn học', value: c.subjects.total, sub: `${c.subjects.active} đang dùng · ${data.periods_per_week} tiết bắt buộc/tuần`, tone: 'indigo' },
        { tab: 'departments', icon: 'users', label: 'Tổ chuyên môn', value: c.departments.total, sub: `${c.departments.active} tổ đang hoạt động`, tone: 'cyan' },
        { tab: 'rooms', icon: 'building', label: 'Phòng học', value: c.rooms.total, sub: `Tổng sức chứa ${data.room_capacity.toLocaleString('vi-VN')} chỗ`, tone: 'emerald' },
        { tab: 'lookups', icon: 'layers', label: 'Danh mục dùng chung', value: c.groups.total, sub: `${c.items.total.toLocaleString('vi-VN')} mục trong các nhóm`, tone: 'amber' },
    ];

    return (
        <div className={s.overview}>
            <div className={s.statGrid}>
                {stats.map((st) => (
                    <button key={st.tab} className={`${s.statCard} ${s['tone_' + st.tone]}`} onClick={() => onNavigate(st.tab)}>
                        <span className={s.statIcon}><Icon name={st.icon} size={20} /></span>
                        <span className={s.statLabel}>{st.label}</span>
                        <strong className={s.statValue}>{st.value.toLocaleString('vi-VN')}</strong>
                        <span className={s.statSub}>{st.sub}</span>
                        <Icon name="chevronRight" size={16} className={s.statGo} />
                    </button>
                ))}
            </div>

            <div className={s.overviewGrid}>
                <section className={s.card}>
                    <header className={s.cardHead}><h3>Cần chú ý</h3>{data.warnings.length > 0 && <Badge tone="warning">{data.warnings.length}</Badge>}</header>
                    {data.warnings.length === 0 ? (
                        <div className={s.allGood}><Icon name="success" size={22} /><div><strong>Dữ liệu ổn định</strong><p>Không phát hiện thiếu sót nào trong danh mục.</p></div></div>
                    ) : (
                        <ul className={s.warnList}>
                            {data.warnings.map((w, i) => (
                                <li key={i}>
                                    <span className={`${s.warnIcon} ${w.level === 'warning' ? s.warnIconWarn : s.warnIconInfo}`}><Icon name={w.level === 'warning' ? 'alert' : 'info'} size={15} /></span>
                                    <span>{w.message}</span>
                                    <button className={s.linkBtn} onClick={() => onNavigate(w.tab)}>Xử lý</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className={s.card}>
                    <header className={s.cardHead}><h3>Môn học theo nhóm</h3></header>
                    <Bars data={data.subjects_by_group} />
                </section>

                <section className={s.card}>
                    <header className={s.cardHead}><h3>Phòng theo loại</h3></header>
                    <Bars data={data.rooms_by_type} />
                </section>

                <section className={s.card}>
                    <header className={s.cardHead}><h3>Nhóm danh mục lớn nhất</h3><button className={s.linkBtn} onClick={() => onNavigate('lookups')}>Xem tất cả</button></header>
                    <ul className={s.topGroups}>
                        {data.top_groups.map((g) => (
                            <li key={g.id}><i style={{ background: g.color ?? '#1b9fde' }} /><span>{g.name}</span><b>{g.items_count}</b></li>
                        ))}
                        {data.top_groups.length === 0 && <li className={s.muted}>Chưa có nhóm nào.</li>}
                    </ul>
                </section>

                <section className={`${s.card} ${s.cardWide}`}>
                    <header className={s.cardHead}><h3>Hoạt động gần đây</h3><button className={s.linkBtn} onClick={() => onNavigate('audit')}>Mở nhật ký</button></header>
                    {data.recent.length === 0 ? <p className={s.muted}>Chưa có thay đổi nào được ghi lại.</p> : (
                        <ol className={s.timeline}>
                            {data.recent.map((r) => {
                                const a = ACTION_LABELS[r.action] ?? { label: r.action, tone: 'neutral' as never };
                                return (
                                    <li key={r.id}>
                                        <Badge tone={a.tone} dot>{a.label}</Badge>
                                        <span className={s.timelineText}><strong>{r.entity_label || '—'}</strong> <small>{ENTITY_LABELS[r.entity] ?? r.entity}</small></span>
                                        <span className={s.timelineMeta}>{r.user_name || 'Hệ thống'} · {timeAgo(r.created_at)}</span>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </section>
            </div>
        </div>
    );
}