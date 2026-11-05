'use client';

import { useEffect } from 'react';
import s from '../logs.module.css';
import { logsApi } from '../api';
import { Bars, Donut, Legend } from '../components/Charts';
import { Card, Empty, ErrorBox, Kpi, SevChip, Skeleton, StatusChip, Who, useAsync } from '../components/ui';
import { fmtTime, money, nf, roleLabel } from '../format';
import type { FinanceData } from '../types';
import type { TabProps } from './tabProps';

const ACTION_LABEL: Record<string, string> = {
    'payment.confirm': 'Xác nhận thu', 'payment.collect': 'Thu tiền', 'payment.reject': 'Từ chối', 'payment.void': 'Huỷ phiếu',
    'period.create': 'Tạo đợt thu', 'period.issue': 'Phát hành đợt', 'period.close': 'Đóng đợt', 'period.extend': 'Gia hạn', 'fee.fee_create': 'Tạo khoản thu',
};

export default function FinanceTab({ tick, openLog, goActivity }: TabProps) {
    const { data, error, run } = useAsync<FinanceData>();
    useEffect(() => { run(() => logsApi.finance(), tick > 0); }, [tick, run]);

    if (error && !data) return <ErrorBox message={error} onRetry={() => run(() => logsApi.finance())} />;
    if (!data) return <Skeleton h={320} />;
    const p = data.payments;
    const parts = [
        { label: 'Đã xác nhận', value: Number(p.confirmed), color: '#34d399' }, { label: 'Chờ xác nhận', value: Number(p.pending), color: '#fbbf24' },
        { label: 'Từ chối', value: Number(p.rejected), color: '#fb4f72' }, { label: 'Đã huỷ', value: Number(p.cancelled), color: '#94a3b8' },
    ];

    return (
        <div className={s.stack}>
            <div className={`${s.grid} ${s.g4}`}>
                <Kpi icon="coin" label="Tổng tiền đã thu" value={money(p.amount_confirmed)} tone="#34d399" foot={`${nf(p.confirmed)} phiếu đã xác nhận`} />
                <Kpi icon="alert" label="Tiền phiếu bị huỷ / từ chối" value={money(p.amount_voided)} tone="#fb4f72" foot={`${nf(Number(p.rejected) + Number(p.cancelled))} phiếu`} />
                <Kpi icon="clock" label="Phiếu chờ xác nhận" value={nf(p.pending)} tone="#fbbf24" />
                <Kpi icon="list" label="Sự kiện tài chính (30 ngày)" value={nf(data.events_30d)} tone="#7b8bff"
                     foot={<button className={`${s.btn} ${s.sm}`} onClick={() => goActivity({ module: 'finance' })}>Xem toàn bộ</button>} />
            </div>

            <div className={`${s.grid} ${s.g3}`}>
                <Card title="Trạng thái phiếu thu" sub={`${nf(p.total)} phiếu`}>
                    <div className={s.donutWrap}><Donut parts={parts} size={150} center={{ top: nf(p.total), bottom: 'phiếu' }} />
                        <Legend items={parts.map((x) => ({ label: x.label, color: x.color, value: nf(x.value) }))} /></div>
                </Card>
                <Card title="Thao tác phổ biến (30 ngày)">
                    {data.by_action.length ? <Bars onPick={(a) => goActivity({ module: 'finance', action: a })} rows={data.by_action.map((a) => ({ label: ACTION_LABEL[a.action] || a.action, key: a.action, value: Number(a.c), color: '#fbbf24' }))} /> : <Empty title="Chưa có dữ liệu" hint="Nhập log cũ ở tab Cấu hình để thấy lịch sử tài chính." />}
                </Card>
                <Card title="Người thao tác nhiều nhất">
                    {data.by_actor.length ? <Bars rows={data.by_actor.map((a) => ({ label: a.actor_name || 'Hệ thống', value: Number(a.c), color: '#7b8bff' }))} /> : <Empty title="Chưa có dữ liệu" />}
                </Card>
            </div>

            <Card title="Nhật ký tài chính gần đây" sub="30 sự kiện mới nhất — bấm để xem chi tiết và lịch sử thay đổi">
                {data.recent.length ? (
                    <div className={s.tableWrap}>
                        <table className={s.table} style={{ minWidth: 760 }}>
                            <thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Đối tượng</th><th>Mức độ</th><th>Trạng thái</th></tr></thead>
                            <tbody>{data.recent.map((r) => (
                                <tr key={r.id} className={r.severity === 'critical' ? s.sevCritical : r.severity === 'warning' ? s.sevWarning : ''} onClick={() => openLog(r.id)}>
                                    <td className={`${s.mono} ${s.muted}`}>{fmtTime(r.occurred_at)}</td>
                                    <td><Who name={r.actor_name} sub={roleLabel(r.actor_role)} /></td>
                                    <td>{ACTION_LABEL[r.action] || r.action}</td>
                                    <td><div className={s.ellipsis}>{r.entity_label || r.summary}</div></td>
                                    <td><SevChip v={r.severity} /></td><td><StatusChip v={r.status} /></td>
                                </tr>))}</tbody>
                        </table>
                    </div>
                ) : <Empty icon="coin" title="Chưa có nhật ký tài chính" hint="Vào tab Cấu hình → “Nhập log cũ” để đưa lịch sử phiếu thu / đợt thu vào đây." />}
            </Card>
        </div>
    );
}