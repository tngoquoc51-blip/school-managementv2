'use client';

import { useEffect, useState } from 'react';
import s from '../logs.module.css';
import { errorMessage, logsApi } from '../api';
import { AreaChart } from '../components/Charts';
import { Icon } from '../components/Icons';
import { Card, Confirm, Empty, ErrorBox, Kpi, ModTag, SevChip, Skeleton, StatusChip, Who, useAsync, useToast } from '../components/ui';
import { ago, fmtTime, nf, roleLabel, until } from '../format';
import type { SecurityData } from '../types';
import type { TabProps } from './tabProps';

export default function SecurityTab({ me, tick, openLog, goActivity }: TabProps) {
    const { data, error, run } = useAsync<SecurityData>();
    const [unlock, setUnlock] = useState<SecurityData['locked_accounts'][number] | null>(null);
    const toast = useToast();
    useEffect(() => { run(() => logsApi.security(), tick > 0); }, [tick, run]);

    if (error && !data) return <ErrorBox message={error} onRetry={() => run(() => logsApi.security())} />;
    if (!data) return <div className={`${s.grid} ${s.g4}`}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={130} />)}</div>;

    const doUnlock = async () => {
        if (!unlock) return;
        try { await logsApi.unlock(unlock.account_type, unlock.id); toast('ok', `Đã mở khoá ${unlock.username}`); setUnlock(null); run(() => logsApi.security(), true); }
        catch (e) { toast('err', errorMessage(e)); setUnlock(null); }
    };

    return (
        <div className={s.stack}>
            <div className={`${s.grid} ${s.g4}`}>
                <Kpi icon="lock" label="Đăng nhập sai (24 giờ)" value={nf(data.summary.failed_24h)} tone="#fbbf24" />
                <Kpi icon="shield" label="Bị từ chối quyền (7 ngày)" value={nf(data.summary.denied_7d)} tone="#fb4f72" />
                <Kpi icon="eye" label="Truy cập dữ liệu cá nhân (7 ngày)" value={nf(data.summary.pii_access_7d)} tone="#22d3ee" foot="Xuất file, xem hồ sơ, mã hoá PII" />
                <Kpi icon="key" label="Tài khoản đang bị khoá" value={nf(data.summary.locked)} tone="#7b8bff" />
            </div>

            <div className={`${s.grid} ${s.g21}`}>
                <Card title="Đăng nhập thất bại 14 ngày qua"><AreaChart height={220} data={data.failed_series} series={[{ key: 'count', label: 'Lần đăng nhập sai', color: '#fbbf24', fill: true }]} /></Card>
                <Card title="IP đáng ngờ (7 ngày)" sub="Đăng nhập sai hoặc bị từ chối">
                    {data.suspicious_ips.length ? (
                        <div className={s.list}>{data.suspicious_ips.map((i) => (
                            <div key={i.ip} className={`${s.li} ${s.clickable}`} onClick={() => goActivity({ ip: i.ip })}>
                                <div className={s.liBody}><span className={s.mono}>{i.ip}</span><div className={`${s.small} ${s.muted}`}>{i.accounts} tài khoản · {ago(i.last_seen)}</div></div>
                                <span className={`${s.chip} ${s.st_failed}`}>{i.c} lần</span>
                            </div>))}</div>
                    ) : <Empty icon="shield" title="Không có IP đáng ngờ" />}
                </Card>
            </div>

            <div className={`${s.grid} ${s.g2}`}>
                <Card title="Tài khoản bị khoá / nhập sai nhiều lần">
                    {data.locked_accounts.length ? (
                        <div className={s.list}>{data.locked_accounts.map((a) => (
                            <div key={a.account_type + a.id} className={s.li}>
                                <div className={s.liBody}><Who name={a.full_name} sub={`${a.username} · ${roleLabel(a.role)}`} />
                                    <div className={`${s.small} ${s.muted}`} style={{ marginTop: 4 }}>Sai {a.failed_attempts} lần{a.locked_until ? ` · khoá đến ${fmtTime(a.locked_until)} (${until(a.locked_until)})` : ''}</div></div>
                                {me.can_admin && <button className={`${s.btn} ${s.sm}`} onClick={() => setUnlock(a)}><Icon name="unlock" size={14} /> Mở khoá</button>}
                            </div>))}</div>
                    ) : <Empty icon="check" title="Không có tài khoản nào bị khoá" />}
                </Card>
                <Card title="Sự kiện bảo mật gần đây">
                    {data.recent_events.length ? (
                        <div className={s.list}>{data.recent_events.map((m) => (
                            <div key={m.id} className={`${s.li} ${s.clickable}`} onClick={() => openLog(m.id)}>
                                <SevChip v={m.severity} />
                                <div className={s.liBody}><div className={s.liTitle}>{m.summary}</div>
                                    <div className={`${s.small} ${s.muted}`}>{m.actor_name || 'Hệ thống'} · <ModTag m={m.module} /> · {m.ip || '—'}</div></div>
                                <StatusChip v={m.status} /><span className={`${s.small} ${s.muted}`}>{ago(m.occurred_at)}</span>
                            </div>))}</div>
                    ) : <Empty title="Chưa có sự kiện" />}
                </Card>
            </div>

            {unlock && <Confirm title="Mở khoá tài khoản" confirmText="Mở khoá" onCancel={() => setUnlock(null)} onOk={doUnlock}
                                body={<>Đặt lại số lần nhập sai và gỡ khoá cho <b>{unlock.full_name}</b> ({unlock.username}). Việc này sẽ được ghi vào nhật ký.</>} />}
        </div>
    );
}