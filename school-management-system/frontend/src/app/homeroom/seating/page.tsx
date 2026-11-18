'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQ, useSeating } from '@/components/hr-seating/Shell';
import SeatCanvas, { ColorMode, SeatMap } from '@/components/hr-seating/SeatCanvas';
import { Avatar, Badge, Card, Donut, Empty, ErrorBox, HBar, Icon, Kpi, Legend, Seg, Skeleton, StackBar } from '@/components/hr-seating/ui';
import { EventRow, LEVELS, LEVEL_COLOR, Layout, Student, Summary, Warning, fixed, num, seatKey, timeAgo } from '@/lib/hr-seating';

interface Overview {
    class: { id: number; name: string; grade: number }; summary: Summary; alerts: Warning[]; active_layout: Layout | null; layout_count: number;
    students: Pick<Student, 'id' | 'code' | 'full_name' | 'ten' | 'gender' | 'level' | 'group' | 'flags' | 'officer_roles'>[]; events: EventRow[];
}
const ACTION_LABEL: Record<string, string> = { create: 'Tạo sơ đồ', update: 'Sửa sơ đồ', save: 'Lưu sơ đồ', publish: 'Công bố sơ đồ', delete: 'Xóa sơ đồ', auto: 'Xếp tự động', groups: 'Cập nhật tổ', officers: 'Cập nhật ban cán sự', flag: 'Cập nhật lưu ý', seed: 'Khởi tạo' };

export default function SeatingOverviewPage() {
    const { meta } = useSeating();
    const q = useQ<Overview>('/overview');
    const [mode, setMode] = useState<ColorMode>('group');
    const o = q.data;

    const students = useMemo(() => new Map((o?.students || []).map((s) => [s.id, s as unknown as Student])), [o]);
    const seats = useMemo<SeatMap>(() => {
        const m: SeatMap = {};
        (o?.active_layout?.seats || []).forEach((s) => { m[seatKey(s.row, s.col, s.pos)] = { student_id: s.student_id, locked: s.locked, note: s.note }; });
        return m;
    }, [o]);

    if (q.error && !o) return <ErrorBox error={q.error} onRetry={q.reload} />;
    if (!o) return <Skeleton h={120} n={4} />;
    const s = o.summary;
    const L = o.active_layout;
    const bad = o.alerts.filter((a) => a.level !== 'info').length;
    const levelTotal = LEVELS.reduce((t, l) => t + num(s.levels[l]), 0) || 1;
    const groupEntries = Object.entries(s.groups);
    const gMax = Math.max(1, ...groupEntries.map(([, n]) => n));

    return (
        <div className="hs-grid" style={{ gap: 20 }}>
            <div className="hs-hero">
                <div style={{ flex: 1, minWidth: 260 }}>
                    <span className="hs-hero-chip"><Icon name="grad" size={13} /> Lớp {o.class.name} · Năm học {meta.year_label}</span>
                    <h2 style={{ marginTop: 10 }}>Sĩ số & sơ đồ lớp {o.class.name}</h2>
                    <p>{s.total} học sinh ({s.male} nam, {s.female} nữ). {L ? <>Sơ đồ đang áp dụng: <b>{L.name}</b>.</> : 'Lớp chưa có sơ đồ chỗ ngồi chính thức.'}</p>
                </div>
                <div className="hs-row hs-wrap">
                    <Link href="/homeroom/seating/chart" className="hs-btn"><Icon name="layers" size={16} /> Mở sơ đồ</Link>
                    <Link href="/homeroom/seating/groups" className="hs-btn"><Icon name="users" size={16} /> Chia tổ</Link>
                    <Link href="/homeroom/seating/roster" className="hs-btn"><Icon name="clipboard" size={16} /> Danh sách</Link>
                    <button className="hs-btn" onClick={q.reload}><Icon name="refresh" size={16} /> Làm mới</button>
                </div>
            </div>

            <div className="hs-grid hs-g4">
                <Kpi icon="grad" tone="primary" label="Sĩ số lớp" value={s.total} sub={<span className="hs-muted">{s.male} nam · {s.female} nữ</span>} />
                <Kpi icon="star" tone="info" label="Điểm trung bình lớp" value={fixed(s.avg_score, 2)} sub={<span className="hs-muted">Tuổi TB {fixed(s.avg_age)}</span>} />
                <Kpi icon="layers" tone={s.unseated ? 'warn' : 'ok'} label="Đã xếp chỗ" value={`${s.seated}/${s.total}`} sub={<span className="hs-muted">{s.unseated ? `${s.unseated} em chưa có chỗ` : 'Đủ cả lớp'}</span>} />
                <Kpi icon="alert" tone={bad ? 'bad' : 'ok'} label="Cảnh báo cần xử lý" value={bad} sub={<span className="hs-muted">{bad ? 'Xem bên dưới' : 'Không có'}</span>} />
                <Kpi icon="eye" tone="info" label="Lưu ý chỗ ngồi" value={s.flagged} sub={<span className="hs-muted">Cận thị, cao, ràng buộc…</span>} />
                <Kpi icon="clipboard" tone={s.attendance_linked ? (s.absent_today ? 'warn' : 'ok') : 'primary'} label="Vắng hôm nay" value={s.attendance_linked ? num(s.absent_today) : '–'} sub={<span className="hs-muted">{s.attendance_linked ? 'Từ điểm danh' : 'Chưa kết nối điểm danh'}</span>} />
                <Kpi icon="users" tone="primary" label="Số tổ học tập" value={groupEntries.filter(([k]) => k !== 'Chưa vào tổ').length} />
                <Kpi icon="clock" tone="primary" label="Số phiên bản sơ đồ" value={o.layout_count} />
            </div>

            <div className="hs-grid hs-g-7-5">
                <Card title="Sơ đồ đang áp dụng" extra={
                    <div className="hs-row">
                        <Seg value={mode} onChange={setMode} options={[{ value: 'group', label: 'Tổ' }, { value: 'gender', label: 'Giới tính' }, { value: 'level', label: 'Học lực' }]} />
                        <Link href="/homeroom/seating/chart" className="hs-btn sm"><Icon name="edit" size={14} /> Chỉnh sửa</Link>
                    </div>}>
                    {!L ? <Empty icon="layers" title="Chưa có sơ đồ chính thức" hint="Tạo sơ đồ mới và công bố để học sinh và giáo viên bộ môn xem." /> : (
                        <SeatCanvas rows={L.rows_n} cols={L.cols_n} per={L.seats_per_desk} blocked={new Set(L.blocked)} seats={seats} students={students} mode={mode} readOnly compact />
                    )}
                </Card>
                <Card title="Cảnh báo & gợi ý">
                    {o.alerts.length === 0 ? <div className="hs-alert hs-tone-ok"><Icon name="check" /><div><b>Mọi thứ ổn</b><div>Sơ đồ không có cảnh báo.</div></div></div> : (
                        <div className="hs-grid" style={{ gap: 10 }}>
                            {o.alerts.map((a, i) => (
                                <div key={i} className={`hs-alert hs-tone-${a.level === 'error' ? 'bad' : a.level === 'warn' ? 'warn' : 'info'}`}>
                                    <Icon name={a.level === 'info' ? 'info' : 'alert'} />
                                    <div><b>{a.text}</b>{a.students.length > 0 && <div className="hs-small">{a.students.slice(0, 3).join(', ')}{a.students.length > 3 ? ` và ${a.students.length - 3} em khác` : ''}</div>}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            <div className="hs-grid hs-g3">
                <Card title="Giới tính">
                    <div className="hs-row hs-wrap" style={{ gap: 24 }}>
                        <Donut data={[{ label: 'Nam', value: s.male, color: '#1d6fe0' }, { label: 'Nữ', value: s.female, color: '#0891b2' }]} size={130} center={s.total} sub="học sinh" />
                        <div style={{ flex: 1, minWidth: 120 }}>
                            <HBar label="Nam" value={s.male} max={s.total || 1} color="#1d6fe0" text={`${s.male}`} />
                            <HBar label="Nữ" value={s.female} max={s.total || 1} color="#0891b2" text={`${s.female}`} />
                        </div>
                    </div>
                </Card>
                <Card title="Học lực học kỳ này">
                    <StackBar parts={LEVELS.map((l) => ({ label: l, value: num(s.levels[l]), color: LEVEL_COLOR[l] }))} />
                    <div style={{ marginTop: 12 }}>{LEVELS.map((l) => <HBar key={l} label={l} value={num(s.levels[l])} max={levelTotal} color={LEVEL_COLOR[l]} text={`${num(s.levels[l])}`} />)}</div>
                    <Legend items={LEVELS.map((l) => ({ label: l, color: LEVEL_COLOR[l] }))} />
                </Card>
                <Card title="Sĩ số các tổ" extra={<Link href="/homeroom/seating/groups" className="hs-btn sm ghost">Quản lý <Icon name="arrow" size={14} /></Link>}>
                    {groupEntries.map(([name, n]) => <HBar key={name} label={name} value={n} max={gMax} text={`${n}`} />)}
                </Card>
            </div>

            <div className="hs-grid hs-g2">
                <Card title="Sinh nhật trong tháng">
                    {s.birthdays_month.length === 0 ? <Empty icon="info" title="Không có sinh nhật trong tháng này" /> : s.birthdays_month.slice(0, 8).map((b) => (
                        <div key={b.id} className="hs-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                            <Avatar name={b.full_name} size={32} /><div style={{ flex: 1 }}><div className="hs-b">{b.full_name}</div><div className="hs-small hs-muted">{new Date(b.birth_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</div></div>
                            <Badge tone={b.days === 0 ? 'ok' : 'primary'}><Icon name="cake" size={12} /> {b.days === 0 ? 'Hôm nay' : `còn ${b.days} ngày`}</Badge>
                        </div>
                    ))}
                </Card>
                <Card title="Hoạt động gần đây" extra={<Link href="/homeroom/seating/history" className="hs-btn sm ghost">Tất cả</Link>}>
                    {o.events.length === 0 ? <Empty title="Chưa có hoạt động" /> : (
                        <div className="hs-timeline">{o.events.map((e) => (
                            <div className="hs-tl" key={e.id}><div className="hs-b hs-small">{ACTION_LABEL[e.action] || e.action}{e.detail ? ` – ${e.detail}` : ''}</div><div className="hs-small hs-muted">{timeAgo(e.created_at)}{e.actor_name ? ` · ${e.actor_name}` : ''}</div></div>
                        ))}</div>
                    )}
                </Card>
            </div>
        </div>
    );
}