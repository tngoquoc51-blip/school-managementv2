'use client';

import { useCallback, useEffect, useState } from 'react';
import { MiniBars } from '../charts';
import Icon from '../Icon';
import { logsApi } from '../logsApi';
import { useToast } from '../ToastProvider';
import { Chip, ConfirmDialog, Empty, ErrorState, Panel, Skeleton } from '../ui';
import type { EventFilters, MiniEvent, Security } from '../types';
import { ACTOR_TYPE, fmtFull, fmtNum, relativeBucketLabel, timeAgo } from '../utils';

interface Props {
    canManage: boolean;
    refreshKey: number;
    onOpenEvent: (id: number) => void;
    onGoEvents: (patch: Partial<EventFilters>) => void;
}

export default function SecurityTab({ canManage, refreshKey, onOpenEvent, onGoEvents }: Props) {
    const toast = useToast();
    const [d, setD] = useState<Security | null>(null);
    const [error, setError] = useState('');
    const [unlock, setUnlock] = useState<Security['locked_accounts'][number] | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setError('');
        try { setD(await logsApi.security()); } catch (e) { setError((e as Error).message); }
    }, []);
    useEffect(() => { load(); }, [load, refreshKey]);

    const doUnlock = async () => {
        if (!unlock) return;
        setBusy(true);
        try {
            await logsApi.unlock(unlock.id);
            toast.success('Đã mở khóa tài khoản', `${unlock.full_name} (${unlock.username}) có thể đăng nhập lại.`);
            setUnlock(null);
            load();
        } catch (e) { toast.error('Chưa mở khóa được', (e as Error).message); } finally { setBusy(false); }
    };

    if (error && !d) return <ErrorState message={error} onRetry={load} />;
    if (!d) return <div className="lg-stack"><div className="lg-kpis lg-kpis--4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="lg-kpi"><Skeleton h={14} w="60%" /><Skeleton h={30} w="40%" /></div>)}</div><Panel><Skeleton h={160} /></Panel></div>;

    const s = d.summary;
    const failRate = s.failed_24h + s.success_24h > 0 ? Math.round((s.failed_24h / (s.failed_24h + s.success_24h)) * 100) : 0;

    return (
        <div className="lg-stack">
            <section className="lg-kpis lg-kpis--4" aria-label="Tóm tắt bảo mật">
                <button type="button" className="lg-kpi lg-kpi--coral" onClick={() => onGoEvents({ range: '24h', action: 'auth.login_failed' })}><span className="lg-kpi__icon"><Icon name="lock" size={18} /></span><span className="lg-kpi__label">Đăng nhập sai (24h)</span><strong>{fmtNum(s.failed_24h)}</strong><span className="lg-kpi__foot"><small>{failRate}% tổng lượt đăng nhập</small></span></button>
                <button type="button" className="lg-kpi lg-kpi--teal" onClick={() => onGoEvents({ range: '24h', action: 'auth.login' })}><span className="lg-kpi__icon"><Icon name="check" size={18} /></span><span className="lg-kpi__label">Đăng nhập thành công (24h)</span><strong>{fmtNum(s.success_24h)}</strong><span className="lg-kpi__foot"><small>&nbsp;</small></span></button>
                <button type="button" className="lg-kpi lg-kpi--warning" onClick={() => onGoEvents({ range: '24h', action: 'security.access_denied' })}><span className="lg-kpi__icon"><Icon name="shield" size={18} /></span><span className="lg-kpi__label">Truy cập bị từ chối (24h)</span><strong>{fmtNum(s.denied_24h)}</strong><span className="lg-kpi__foot"><small>Sai quyền / chưa đăng nhập</small></span></button>
                <button type="button" className="lg-kpi lg-kpi--violet" onClick={() => onGoEvents({ range: '7d', action: 'export*' })}><span className="lg-kpi__icon"><Icon name="download" size={18} /></span><span className="lg-kpi__label">Xuất dữ liệu (7 ngày)</span><strong>{fmtNum(s.exports_7d)}</strong><span className="lg-kpi__foot"><small>Danh sách học sinh, báo cáo…</small></span></button>
            </section>

            <Panel title="Đăng nhập thất bại theo giờ" desc="24 giờ gần nhất. Cột cao bất thường thường là dấu hiệu dò mật khẩu.">
                <MiniBars data={d.failed_timeline} labelFn={(t) => relativeBucketLabel(t, '24h')} />
            </Panel>

            <div className="lg-grid lg-grid--two">
                <Panel title="IP đáng ngờ" desc="Từ 3 lần đăng nhập sai trở lên trong 24 giờ.">
                    {d.suspicious_ips.length === 0 ? <Empty icon="shield" title="Không có IP đáng ngờ" text="Chưa ghi nhận IP nào đăng nhập sai nhiều lần." /> : (
                        <div className="lg-tablewrap"><table className="lg-table lg-table--plain">
                            <thead><tr><th>IP</th><th>Sai</th><th>Đúng</th><th>Tài khoản bị thử</th><th>Gần nhất</th><th /></tr></thead>
                            <tbody>{d.suspicious_ips.map((ip) => (
                                <tr key={ip.ip}>
                                    <td className="lg-mono">{ip.ip}{ip.ok_after_fail && <Chip tone="coral">Đã vào được!</Chip>}</td>
                                    <td><b className="lg-bad">{ip.failed}</b></td><td>{ip.success}</td><td>{ip.targets}</td><td className="lg-nowrap">{timeAgo(ip.last_at)}</td>
                                    <td><button type="button" className="lg-link" onClick={() => onGoEvents({ range: '24h', ip: ip.ip })}>Xem</button></td>
                                </tr>))}</tbody>
                        </table></div>
                    )}
                    {d.suspicious_ips.some((i) => i.ok_after_fail) && <div className="lg-banner lg-banner--bad"><Icon name="alert" size={18} /><span><strong>Nghi ngờ bị dò mật khẩu thành công:</strong> có IP đăng nhập đúng ngay sau nhiều lần sai. Hãy đổi mật khẩu tài khoản liên quan.</span></div>}
                </Panel>

                <Panel title="Tài khoản cán bộ bị khóa / sai nhiều" desc="Lấy từ bảng tài khoản nhân sự.">
                    {d.locked_accounts.length === 0 ? <Empty icon="unlock" title="Không có tài khoản nào bị khóa" /> : (
                        <ul className="lg-accounts">
                            {d.locked_accounts.map((a) => (
                                <li key={a.id}>
                                    <span className={`lg-accounts__icon${a.is_locked ? ' is-locked' : ''}`}><Icon name={a.is_locked ? 'lock' : 'alert'} size={18} /></span>
                                    <div><strong>{a.full_name}</strong><small>{a.username}{a.role ? ` · ${a.role}` : ''} · {a.failed_attempts} lần sai{a.is_locked && a.locked_until ? ` · khóa đến ${fmtFull(a.locked_until)}` : ''}</small></div>
                                    <button type="button" className="lg-btn lg-btn--soft" disabled={!canManage} title={canManage ? undefined : 'Cần quyền quản trị'} onClick={() => setUnlock(a)}><Icon name="unlock" size={15} /> {a.is_locked ? 'Mở khóa' : 'Đặt lại'}</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>

            <div className="lg-grid lg-grid--two">
                <Panel title="Đăng nhập ngoài giờ" desc="Từ 22h đến 5h sáng, 7 ngày gần nhất."><LoginList items={d.off_hours_logins} empty="Không có đăng nhập ngoài giờ." onOpen={onOpenEvent} /></Panel>
                <Panel title="Đăng nhập từ IP mới" desc="Người dùng quen thuộc nhưng dùng IP chưa từng thấy trong 30 ngày."><LoginList items={d.new_ip_logins} empty="Không có đăng nhập từ IP lạ." onOpen={onOpenEvent} /></Panel>
            </div>

            <ConfirmDialog open={!!unlock} tone="brand" title="Mở khóa tài khoản?" message={`Đặt lại số lần đăng nhập sai và bỏ thời gian khóa của ${unlock?.full_name} (${unlock?.username}). Thao tác được ghi vào nhật ký.`} confirmLabel="Mở khóa" loading={busy} onConfirm={doUnlock} onCancel={() => setUnlock(null)} />
        </div>
    );
}

function LoginList({ items, empty, onOpen }: { items: MiniEvent[]; empty: string; onOpen: (id: number) => void }) {
    if (!items.length) return <Empty icon="check" title={empty} />;
    return (
        <ul className="lg-feed lg-feed--compact">
            {items.map((e) => (
                <li key={e.id}><button type="button" onClick={() => onOpen(e.id)}>
                    <Icon name="user" size={16} /><span><strong>{e.actor_name ?? 'Không rõ'}</strong><small>{ACTOR_TYPE[e.actor_type ?? ''] ?? e.actor_type} · <span className="lg-mono">{e.ip}</span></small></span><time>{fmtFull(e.occurred_at)}</time>
                </button></li>
            ))}
        </ul>
    );
}