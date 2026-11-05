'use client';

import { useEffect, useState } from 'react';
import s from '../logs.module.css';
import { errorMessage, logsApi } from '../api';
import { Icon } from '../components/Icons';
import { Card, Confirm, Empty, ErrorBox, Kpi, Skeleton, Who, useAsync, useToast } from '../components/ui';
import { ago, fmtTime, nf, roleLabel, until } from '../format';
import type { SessionRow, SessionsData } from '../types';
import type { TabProps } from './tabProps';

export default function SessionsTab({ me, tick }: TabProps) {
    const { data, error, run } = useAsync<SessionsData>();
    const [target, setTarget] = useState<SessionRow | null>(null);
    const [purge, setPurge] = useState(false);
    const toast = useToast();
    useEffect(() => { run(() => logsApi.sessions(), tick > 0); }, [tick, run]);

    if (error && !data) return <ErrorBox message={error} onRetry={() => run(() => logsApi.sessions())} />;
    if (!data) return <Skeleton h={300} />;

    const reload = () => run(() => logsApi.sessions(), true);
    const revoke = async () => {
        if (!target) return;
        try { await logsApi.revokeSession(target.account_type, target.id); toast('ok', `Đã buộc đăng xuất ${target.full_name}`); reload(); }
        catch (e) { toast('err', errorMessage(e)); }
        setTarget(null);
    };
    const doPurge = async () => {
        try { const r = await logsApi.purgeExpired(); toast('ok', `Đã dọn ${r.deleted} phiên hết hạn`); reload(); }
        catch (e) { toast('err', errorMessage(e)); }
        setPurge(false);
    };

    const Table = ({ rows, empty }: { rows: SessionRow[]; empty: string }) => rows.length ? (
        <div className={s.tableWrap}>
            <table className={s.table} style={{ minWidth: 700 }}>
                <thead><tr><th>Người dùng</th><th>Tài khoản</th><th>Đăng nhập lúc</th><th>Hết hạn</th>{me.can_admin && <th />}</tr></thead>
                <tbody>{rows.map((r) => (
                    <tr key={r.account_type + r.id} style={{ cursor: 'default' }}>
                        <td><Who name={r.full_name} sub={roleLabel(r.role)} /></td>
                        <td className={s.mono}>{r.username}</td>
                        <td><div>{fmtTime(r.created_at)}</div><div className={`${s.small} ${s.muted}`}>{ago(r.created_at)}</div></td>
                        <td>{r.expires_at ? <><div>{fmtTime(r.expires_at)}</div><div className={`${s.small} ${s.muted}`}>{until(r.expires_at)}</div></> : <div className={s.muted}>Không giới hạn</div>}</td>
                        {me.can_admin && <td style={{ textAlign: 'right' }}><button className={`${s.btn} ${s.sm} ${s.danger}`} onClick={() => setTarget(r)}><Icon name="logout" size={14} /> Buộc đăng xuất</button></td>}
                    </tr>))}</tbody>
            </table>
        </div>
    ) : <div className={s.tableWrap}><Empty icon="users" title={empty} /></div>;

    return (
        <div className={s.stack}>
            <div className={`${s.grid} ${s.g4}`}>
                <Kpi icon="users" label="Cán bộ đang đăng nhập" value={nf(data.totals.staff)} tone="#7b8bff" />
                <Kpi icon="globe" label="Học sinh đang đăng nhập" value={nf(data.totals.students)} tone="#22d3ee" />
                <Kpi icon="clock" label="Phiên cán bộ đã hết hạn" value={nf(data.totals.expired_staff)} tone="#fbbf24" />
                <Kpi icon="db" label="Phiên học sinh đã hết hạn" value={nf(data.totals.expired_students)} tone="#94a3b8"
                     foot={me.can_admin ? <button className={`${s.btn} ${s.sm}`} onClick={() => setPurge(true)}><Icon name="trash" size={13} /> Dọn phiên hết hạn</button> : undefined} />
            </div>
            <Card title="Phiên đăng nhập của cán bộ & tài khoản hệ thống" sub="Token còn hiệu lực — buộc đăng xuất sẽ vô hiệu hoá ngay token đó"><Table rows={data.staff} empty="Không có phiên cán bộ nào" /></Card>
            <Card title="Phiên đăng nhập của học sinh" sub="Hiển thị tối đa 200 phiên mới nhất"><Table rows={data.students} empty="Không có phiên học sinh nào" /></Card>

            {target && <Confirm danger title="Buộc đăng xuất" confirmText="Buộc đăng xuất" onCancel={() => setTarget(null)} onOk={revoke}
                                body={<>Phiên của <b>{target.full_name}</b> ({target.username}) sẽ bị vô hiệu hoá ngay lập tức. Người dùng phải đăng nhập lại.</>} />}
            {purge && <Confirm title="Dọn phiên hết hạn" confirmText="Dọn dẹp" onCancel={() => setPurge(false)} onOk={doPurge}
                               body="Xoá toàn bộ token đã hết hạn của cán bộ và học sinh. Không ảnh hưởng người đang đăng nhập." />}
        </div>
    );
}