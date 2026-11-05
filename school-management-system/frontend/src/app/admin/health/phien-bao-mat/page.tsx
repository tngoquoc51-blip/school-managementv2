'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Card, Confirm, Empty, ErrorBox, HBars, LEVEL, Loading, Pill, Tabs, WriteNote, ago, dt, mon, num, useLoad, useMon } from '../_hl';

export default function Page() { return <Suspense fallback={<Loading rows={4} />}><Inner /></Suspense>; }

function Inner() {
    const sp = useSearchParams();
    const [tab, setTab] = useState(sp.get('tab') === 'bao-mat' ? 'bao-mat' : 'phien');
    return (
        <div className="hl-stack">
            <WriteNote />
            <Tabs value={tab} onChange={setTab} items={[{ key: 'phien', label: 'Phiên đăng nhập' }, { key: 'bao-mat', label: 'Bảo mật & tài khoản' }]} />
            {tab === 'phien' ? <Sessions /> : <Security />}
        </div>
    );
}

function Sessions() {
    const { canWrite, toast } = useMon();
    const { data, err, loading, reload } = useLoad<any>('sessions', 30);
    const [who, setWho] = useState<'staff' | 'student'>('staff');
    const [ask, setAsk] = useState<any>(null);
    if (loading && !data) return <Loading rows={4} />;
    if (err && !data) return <ErrorBox msg={err} retry={reload} />;
    const rows = who === 'staff' ? data!.staff : data!.students;
    const done = async (p: Promise<any>) => { try { const r: any = await p; toast(r.message || 'Xong.'); setAsk(null); reload(); } catch (e: any) { toast(e.message, 'err'); } };

    return (
        <>
            <div className="hl-bar">
                <Tabs value={who} onChange={(k) => setWho(k as any)} items={[{ key: 'staff', label: 'Nhân viên', n: data!.staff.length }, { key: 'student', label: 'Học sinh', n: data!.students.length }]} />
                {canWrite && rows.length > 0 && <button className="hl-btn danger-o" onClick={() => setAsk({ all: true })}>Thu hồi tất cả{who === 'staff' ? ' (trừ phiên của bạn)' : ''}</button>}
            </div>
            <Card flush>
                {!rows.length ? <Empty icon="∅" title="Không có phiên nào đang mở" /> : (
                    <div className="hl-tw"><table className="hl-table">
                        <thead><tr><th>Người dùng</th><th>{who === 'staff' ? 'Vai trò' : 'Mã HS'}</th><th>Đăng nhập lúc</th><th>Hết hạn</th><th />{canWrite && <th />}</tr></thead>
                        <tbody>{rows.map((s: any) => (
                            <tr key={s.id}><td><b>{s.name}</b><small>{s.username}{s.current ? ' · phiên của bạn' : ''}</small></td>
                                <td>{who === 'staff' ? <Pill tone="blue">{s.role}</Pill> : <span className="mono">{s.code}</span>}</td>
                                <td>{dt(s.created_at)}<small>{ago(s.created_at)}</small></td><td>{dt(s.expires_at)}</td>
                                <td className="r"><Link className="hl-link" href={`/admin/health/nhat-ky?actor=${encodeURIComponent(s.username)}`}>Hoạt động</Link></td>{canWrite && <td className="r">{s.current ? <Pill tone="green">Đang dùng</Pill> : <button className="hl-btn sm danger-o" onClick={() => setAsk(s)}>Thu hồi</button>}</td>}</tr>))}</tbody>
                    </table></div>
                )}
            </Card>
            {ask && (ask.all
                ? <Confirm danger title="Thu hồi hàng loạt?" okText="Thu hồi tất cả" text={who === 'staff' ? 'Mọi nhân viên khác sẽ bị đăng xuất ngay (phiên của bạn được giữ).' : 'Toàn bộ học sinh đang đăng nhập sẽ bị đăng xuất ngay.'} onClose={() => setAsk(null)} onOk={() => done(mon('sessions/revoke-all', { method: 'POST', body: { scope: who } }))} />
                : <Confirm danger title="Thu hồi phiên?" okText="Thu hồi" text={<>Đăng xuất <b>{ask.name}</b> khỏi thiết bị này. Người dùng sẽ phải đăng nhập lại.</>} onClose={() => setAsk(null)} onOk={() => done(mon(`sessions/${who}/${ask.id}/revoke`, { method: 'POST' }))} />)}
        </>
    );
}

function Security() {
    const { canWrite, toast } = useMon();
    const { data, err, loading, reload } = useLoad<any>('security', 45);
    if (loading && !data) return <Loading rows={4} />;
    if (err && !data) return <ErrorBox msg={err} retry={reload} />;
    const d = data!, s = d.summary;
    const unlock = async (a: any) => { try { const r: any = await mon(`accounts/${a.type}/${a.id}/unlock`, { method: 'POST' }); toast(r.message); reload(); } catch (e: any) { toast(e.message, 'err'); } };
    const maxD = Math.max(1, ...d.daily.map((x: any) => Number(x.ok) + Number(x.bad)));

    return (
        <>
            <div className="hl-kpis six">
                <div className={`hl-kpi t-${s.failed_24h > 10 ? 'red' : 'slate'}`}><span>Đăng nhập sai 24h</span><b>{num(s.failed_24h)}</b><small>ghi nhận bởi middleware</small></div>
                <div className={`hl-kpi t-${s.locked ? 'amber' : 'green'}`}><span>Tài khoản đang khóa</span><b>{s.locked}</b><small>khóa tạm do nhập sai</small></div>
                <div className="hl-kpi t-violet"><span>Đang nhập sai dở dang</span><b>{s.failing}</b><small>có số lần sai &gt; 0</small></div>
                <div className="hl-kpi t-blue"><span>Chưa đổi mật khẩu mặc định</span><b>{s.must_change}</b><small>học sinh</small></div>
                <div className={`hl-kpi t-${s.default_pw_staff ? 'red' : 'green'}`}><span>Nhân viên còn MK mặc định</span><b>{s.default_pw_staff}</b><small>{s.default_pw_staff ? 'cần đổi trước khi lên server' : 'đã đổi hết'}</small></div>
                <div className="hl-kpi t-slate"><span>Nhân viên bị vô hiệu</span><b>{s.inactive_staff}</b><small>trạng thái ≠ active</small></div>
            </div>

            <div className="hl-grid2 even">
                <Card title="Đăng nhập 7 ngày qua" sub="Xanh: thành công · Đỏ: thất bại">
                    {!d.daily.length ? <Empty icon="∅" title="Chưa có dữ liệu đăng nhập" text="Cần bật middleware RequestMonitor." /> : (
                        <div className="hl-stackbars">{d.daily.map((x: any) => (
                            <div key={x.d}><div className="col"><i className="bad" style={{ height: `${(Number(x.bad) / maxD) * 100}%` }} /><i className="ok" style={{ height: `${(Number(x.ok) / maxD) * 100}%` }} /></div><small>{x.d.slice(8)}/{x.d.slice(5, 7)}</small><b>{Number(x.ok)}/{Number(x.bad)}</b></div>))}</div>
                    )}
                </Card>
                <Card title="IP đăng nhập sai nhiều nhất" sub="7 ngày qua">
                    {!d.ips.length ? <Empty title="Không có IP đáng ngờ" /> : <HBars tone="red" items={d.ips.map((i: any) => ({ label: i.ip, value: Number(i.n), sub: `${i.users} tài khoản bị thử · gần nhất ${ago(i.last_at)}` }))} />}
                </Card>
            </div>

            <Card title="Tài khoản có đăng nhập sai / đang bị khóa" flush>
                {!d.accounts.length ? <Empty title="Không có tài khoản nào" text="Mọi tài khoản đều đăng nhập bình thường." /> : (
                    <div className="hl-tw"><table className="hl-table">
                        <thead><tr><th>Tài khoản</th><th>Loại</th><th className="r">Số lần sai</th><th>Trạng thái</th><th>Đăng nhập cuối</th><th />{canWrite && <th />}</tr></thead>
                        <tbody>{d.accounts.map((a: any) => (
                            <tr key={a.type + a.id}><td><b>{a.name}</b><small>{a.username}</small></td><td>{a.type === 'staff' ? 'Nhân viên' : 'Học sinh'}</td><td className="r"><b>{a.failed_attempts}</b></td>
                                <td>{a.locked ? <Pill tone="red" dot>Khóa đến {dt(a.locked_until)}</Pill> : <Pill tone="amber" dot>Đang theo dõi</Pill>}</td><td>{dt(a.last_login_at)}</td>
                                <td className="r"><Link className="hl-link" href={`/admin/health/nhat-ky?actor=${encodeURIComponent(a.username)}`}>Hoạt động</Link></td>{canWrite && <td className="r"><button className="hl-btn sm" onClick={() => unlock(a)}>Mở khóa / đặt lại</button></td>}</tr>))}</tbody>
                    </table></div>
                )}
            </Card>

            <Card title="Sự kiện bảo mật gần đây" right={<Link className="hl-link" href="/admin/health/nhat-ky?source=audit">Nhật ký thao tác →</Link>}>
                {!d.events.length ? <Empty title="Chưa có sự kiện bảo mật" /> : <ul className="hl-feed">{d.events.map((l: any) => (
                    <li key={l.id}><Pill tone={LEVEL[l.level]?.tone}>{LEVEL[l.level]?.label}</Pill><div><span>{l.message}</span><small>{ago(l.created_at)}{l.ip ? ` · ${l.ip}` : ''}</small></div></li>))}</ul>}
            </Card>
        </>
    );
}