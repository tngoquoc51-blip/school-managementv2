'use client';

import { useCallback, useEffect, useState } from 'react';
import { ago, errMsg, fmtBytes, fmtDate, fmtDT, settingsApi } from './api';
import { Badge, Btn, Card, Icon, Skeleton, useToast } from './ui';

export default function Overview({ go }: { go: (id: string) => void }) {
    const toast = useToast();
    const [d, setD] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try { setD(await settingsApi.overview()); } catch (e) { toast('err', 'Không tải được dữ liệu', errMsg(e)); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    if (loading && !d) return <Skeleton rows={4} />;
    if (!d) return <div className="st-alert bad"><Icon name="alert" /> Không tải được dữ liệu từ API. Chạy php artisan optimize:clear, rồi php artisan route:list --path=setting để kiểm tra route; đồng thời kiểm tra Laragon (Apache + MySQL) đang chạy.</div>;

    const s = d.system, st = d.stats;
    const diskUsed = s.disk_total_gb ? Math.round(((s.disk_total_gb - s.disk_free_gb) / s.disk_total_gb) * 100) : 0;
    const lastBk = d.backup?.last;
    const bkOld = !lastBk || (Date.now() - new Date(String(lastBk.created_at).replace(' ', 'T')).getTime()) / 86400000 > 7;

    const checks = [
        { ok: !s.debug || s.env !== 'production', text: s.env === 'production' && s.debug ? 'APP_DEBUG đang bật trên môi trường production' : 'Chế độ debug phù hợp môi trường', fix: null },
        { ok: !bkOld, text: bkOld ? 'Chưa có bản sao lưu nào trong 7 ngày gần đây' : 'Có bản sao lưu gần đây', fix: 'backup' },
        { ok: !d.maintenance, text: d.maintenance ? 'Hệ thống đang ở chế độ bảo trì — người dùng không truy cập được' : 'Hệ thống đang hoạt động bình thường', fix: 'maintenance' },
        { ok: (st.failed_logins_24h ?? 0) < 20, text: `${st.failed_logins_24h ?? 0} lần đăng nhập sai trong 24 giờ qua`, fix: 'audit' },
        { ok: diskUsed < 90, text: `Ổ đĩa đã dùng ${diskUsed}%`, fix: null },
    ];
    const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);

    const stat = (label: string, v: any, sub: string, c: string) => (
        <div className="st-stat" style={{ ['--c' as any]: c }}><small>{label}</small><b>{v ?? '—'}</b><span>{sub}</span></div>
    );

    return (
        <>
            <div className="st-stats">
                {stat('Tài khoản', st.users, 'người dùng hệ thống', 'var(--st-primary)')}
                {stat('Học sinh', st.students, 'trong CSDL', 'var(--st-accent)')}
                {stat('Giáo viên', st.teachers, 'hồ sơ giáo viên', 'var(--st-info)')}
                {stat('Lớp học', st.classes, d.school_year ? `Năm học ${d.school_year.label}` : 'chưa đặt năm học', 'var(--st-warn)')}
                {stat('Phiên hoạt động', st.sessions, 'token đang còn hạn', 'var(--st-ok)')}
                {stat('Nhật ký hôm nay', st.logs_today, 'sự kiện kiểm toán', 'var(--st-bad)')}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(380px,1fr))', gap: 18 }}>
                <Card icon="shield" title="Sức khỏe hệ thống" desc="Kiểm tra tự động các điểm cần chú ý" actions={<Badge kind={score >= 80 ? 'ok' : score >= 60 ? 'warn' : 'bad'}>{score}/100</Badge>}>
                    <div style={{ display: 'grid', gap: 10 }}>
                        {checks.map((c, i) => (
                            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <span style={{ color: c.ok ? 'var(--st-ok)' : 'var(--st-warn)' }}><Icon name={c.ok ? 'check' : 'alert'} /></span>
                                <span style={{ flex: 1 }}>{c.text}</span>
                                {!c.ok && c.fix && <button className="st-btn sm" onClick={() => go(c.fix!)}>Xử lý</button>}
                            </div>
                        ))}
                    </div>
                </Card>

                <Card icon="database" title="Cơ sở dữ liệu & lưu trữ" actions={<Btn className="sm" icon="refresh" onClick={load} busy={loading}>Làm mới</Btn>}>
                    <dl className="st-kv">
                        <dt>Cơ sở dữ liệu</dt><dd>{s.db_name} <Badge>{s.db_version}</Badge></dd>
                        <dt>Dung lượng</dt><dd>{s.db_size_mb} MB · {s.db_tables} bảng</dd>
                        <dt>Ổ đĩa</dt><dd><div className="st-bar" style={{ marginBottom: 6 }}><i style={{ width: `${diskUsed}%` }} /></div>{s.disk_free_gb} GB trống / {s.disk_total_gb} GB</dd>
                        <dt>Sao lưu gần nhất</dt><dd>{lastBk ? <>{ago(lastBk.created_at)} <Badge>{fmtBytes(lastBk.file_size)}</Badge></> : <Badge kind="warn">Chưa có</Badge>}</dd>
                    </dl>
                </Card>

                <Card icon="monitor" title="Máy chủ ứng dụng">
                    <dl className="st-kv">
                        <dt>Tên ứng dụng</dt><dd>{s.app_name}</dd>
                        <dt>Môi trường</dt><dd><Badge kind={s.env === 'production' ? 'ok' : 'info'}>{s.env}</Badge> {s.debug && <Badge kind="warn">debug</Badge>}</dd>
                        <dt>PHP / Laravel</dt><dd>{s.php} / {s.laravel}</dd>
                        <dt>Múi giờ</dt><dd>{s.timezone}</dd>
                        <dt>Giờ máy chủ</dt><dd>{fmtDT(s.server_time)}</dd>
                        <dt>Giới hạn PHP</dt><dd>memory {s.memory_limit} · exec {s.max_exec}s</dd>
                    </dl>
                </Card>

                <Card icon="school" title="Nhà trường & niên khóa">
                    <dl className="st-kv">
                        <dt>Tên trường</dt><dd>{d.school_name || '—'}</dd>
                        <dt>Năm học hiện hành</dt><dd>{d.school_year ? <>{d.school_year.label} <span style={{ color: 'var(--st-muted)', fontWeight: 400 }}>({fmtDate(d.school_year.start_date)} – {fmtDate(d.school_year.end_date)})</span></> : <Badge kind="warn">Chưa đặt</Badge>}</dd>
                        <dt>Chế độ bảo trì</dt><dd>{d.maintenance ? <Badge kind="bad">Đang bật</Badge> : <Badge kind="ok">Tắt</Badge>}</dd>
                    </dl>
                    <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                        <button className="st-btn sm" onClick={() => go('general')}>Thông tin trường</button>
                        <button className="st-btn sm" onClick={() => go('years')}>Năm học</button>
                        <button className="st-btn sm" onClick={() => go('security')}>Bảo mật</button>
                    </div>
                </Card>
            </div>
        </>
    );
}