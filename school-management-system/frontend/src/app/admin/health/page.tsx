'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, Empty, ErrorBox, LEVEL, Loading, Pill, Ring, STATE, TrafficChart, ago, dur, mon, num, useLoad, useMon } from './_hl';

type Svc = { key: string; name: string; status: string; value: string; detail: string; ms: number };
const ICON: Record<string, string> = {
    database: 'M4 6c0-2 16-2 16 0s-16 2-16 0v12c0 2 16 2 16 0V6M4 12c0 2 16 2 16 0',
    disk: 'M4 16h16v4H4zM6 4h12l2 12H4z', storage: 'M3 7h18v12H3zM3 7l3-3h12l3 3',
    cache: 'M13 2L4 14h7l-1 8 9-12h-7z', php: 'M4 6h16v12H4zM8 10l-2 2 2 2M16 10l2 2-2 2',
    debug: 'M12 8a4 4 0 014 4v4a4 4 0 01-8 0v-4a4 4 0 014-4zM9 4l2 2M15 4l-2 2', backup: 'M12 3v12m0 0l-4-4m4 4l4-4M4 19h16',
    traffic: 'M3 17l5-6 4 3 6-8', deploy: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
};

export default function Overview() {
    const { canWrite, toast, refreshBadge } = useMon();
    const { data, err, loading, reload } = useLoad<any>('overview', 30);
    const [running, setRunning] = useState(false);

    const run = async () => {
        setRunning(true);
        try { await mon('checks/run', { method: 'POST' }); await reload(); refreshBadge(); toast('Đã chạy kiểm tra toàn bộ dịch vụ.'); }
        catch (e: any) { toast(e.message, 'err'); } finally { setRunning(false); }
    };

    if (loading && !data) return <Loading rows={5} />;
    if (err && !data) return <ErrorBox msg={err} retry={reload} />;
    const d = data!, k = d.kpis, sys = d.system;
    const bad = d.services.filter((s: Svc) => s.status === 'fail').length, warn = d.services.filter((s: Svc) => s.status === 'warn').length;
    const headline = d.score.tone === 'good' ? 'Mọi thứ đang vận hành ổn định' : d.score.tone === 'warn' ? 'Có một vài điểm cần chú ý' : 'Hệ thống đang gặp sự cố';

    return (
        <div className="hl-stack">
            <section className={`hl-hero t-${d.score.tone}`}>
                <Ring value={d.score.value} tone={d.score.tone} />
                <div className="hl-hero-t">
                    <Pill tone={d.score.tone === 'good' ? 'green' : d.score.tone === 'warn' ? 'amber' : 'red'} dot>{d.score.label}</Pill>
                    <h2>{headline}</h2>
                    <p>{bad ? `${bad} dịch vụ gặp sự cố` : 'Tất cả dịch vụ cốt lõi đang chạy'}{warn ? `, ${warn} mục cần chú ý` : ''}{d.alerts.length ? ` · ${d.alerts.length} cảnh báo đang mở` : ' · không có cảnh báo mở'}.</p>
                    <div className="hl-facts">
                        <span>PHP <b>{sys.php}</b></span><span>Laravel <b>{sys.laravel}</b></span><span>Môi trường <b>{sys.env}</b></span>
                        <span>CSDL chạy <b>{dur(k.db_uptime_s)}</b></span><span>Múi giờ <b>{sys.timezone}</b></span>
                    </div>
                </div>
                <div className="hl-hero-a">
                    <button className="hl-btn light" onClick={run} disabled={running}>{running ? 'Đang kiểm tra…' : '⟳ Chạy kiểm tra ngay'}</button>
                    <Link href="/admin/health/canh-bao" className="hl-btn ghost-l">Xem cảnh báo</Link>
                </div>
            </section>

            <div className="hl-kpis">
                <K label="Request 24 giờ" v={num(k.requests_24h)} sub={`${(k.requests_24h / 1440).toFixed(1)} / phút`} tone="blue" href="/admin/health/hieu-nang" />
                <K label="Thời gian TB" v={`${k.avg_ms} ms`} sub={`P95: ${k.p95_ms} ms`} tone={k.p95_ms > 1500 ? 'amber' : 'teal'} href="/admin/health/hieu-nang" />
                <K label="Tỉ lệ lỗi 5xx" v={`${k.error_rate}%`} sub={`${num(k.client_errors)} lỗi 4xx`} tone={k.error_rate > 1 ? 'red' : 'green'} href="/admin/health/hieu-nang" />
                <K label="Phiên đang mở" v={num(k.sessions_staff + k.sessions_student)} sub={`${k.sessions_staff} nhân viên · ${k.sessions_student} học sinh`} tone="violet" href="/admin/health/phien-bao-mat" />
                <K label="Đăng nhập sai 24h" v={num(k.failed_logins_24h)} sub={`${k.locked_accounts} tài khoản đang khóa`} tone={k.failed_logins_24h > 10 ? 'red' : 'slate'} href="/admin/health/phien-bao-mat?tab=bao-mat" />
                <K label="Cơ sở dữ liệu" v={`${k.db_mb} MB`} sub={`${k.db_tables} bảng`} tone="indigo" href="/admin/health/co-so-du-lieu" />
            </div>

            <Card title="Trạng thái dịch vụ" sub="Kiểm tra trực tiếp mỗi lần mở trang" right={<Link className="hl-link" href="/admin/health/dich-vu">Chi tiết →</Link>}>
                <div className="hl-svcs">
                    {d.services.map((s: Svc) => (
                        <div key={s.key} className={`hl-svc s-${s.status}`} title={s.detail}>
                            <span className="ic"><svg viewBox="0 0 24 24"><path d={ICON[s.key] || ICON.cache} /></svg></span>
                            <div><b>{s.name}</b><em>{s.value}</em></div>
                            <i className="dot" aria-label={STATE[s.status]?.label} />
                        </div>
                    ))}
                </div>
            </Card>

            <div className="hl-grid2">
                <Card title="Lưu lượng 24 giờ qua" sub="Cột: số request · Đường: thời gian xử lý trung bình" right={<Pill tone="blue">{num(k.requests_24h)} request</Pill>}>
                    {k.requests_24h === 0 ? <Empty icon="∅" title="Chưa có số liệu request" text="Bật middleware RequestMonitor rồi dùng hệ thống một lúc, biểu đồ sẽ xuất hiện." /> : <TrafficChart data={d.series} />}
                </Card>
                <Card title="Cảnh báo đang mở" right={<Link className="hl-link" href="/admin/health/canh-bao">Tất cả →</Link>}>
                    {d.alerts.length === 0 ? <Empty title="Không có cảnh báo" text="Các chỉ số đều trong ngưỡng an toàn." /> : (
                        <ul className="hl-alerts">{d.alerts.map((a: any) => (
                            <li key={a.id} className={`sev-${a.severity}`}><i /><div><b>{a.title}</b><span>{a.detail}</span><small>{ago(a.created_at)}{a.status === 'ack' ? ' · đã tiếp nhận' : ''}</small></div></li>))}</ul>
                    )}
                </Card>
            </div>

            <div className="hl-grid2 even">
                <Card title="Hoạt động gần đây" right={<Link className="hl-link" href="/admin/health/nhat-ky">Nhật ký →</Link>}>
                    <ul className="hl-feed">{d.recent_logs.map((l: any) => (
                        <li key={l.id}><Pill tone={LEVEL[l.level]?.tone}>{LEVEL[l.level]?.label}</Pill><div><span>{l.message}</span><small>{ago(l.created_at)}{l.ip ? ` · ${l.ip}` : ''}</small></div></li>))}</ul>
                </Card>
                <Card title="Thông số máy chủ">
                    <dl className="hl-dl">
                        <dt>Hệ điều hành</dt><dd>{sys.os}</dd><dt>PHP memory_limit</dt><dd>{sys.memory_limit}</dd>
                        <dt>upload_max_filesize</dt><dd>{sys.upload_max}</dd><dt>max_execution_time</dt><dd>{sys.max_exec}s</dd>
                        <dt>Chế độ debug</dt><dd>{sys.debug ? <Pill tone="amber">Đang bật</Pill> : <Pill tone="green">Tắt</Pill>}</dd>
                        <dt>Giờ máy chủ (UTC)</dt><dd>{sys.server_time}</dd>
                    </dl>
                    {!canWrite && <p className="hl-hint">Chế độ chỉ xem.</p>}
                </Card>
            </div>
        </div>
    );
}

function K({ label, v, sub, tone, href }: { label: string; v: string; sub: string; tone: string; href: string }) {
    return <Link href={href} className={`hl-kpi t-${tone}`}><span>{label}</span><b>{v}</b><small>{sub}</small></Link>;
}