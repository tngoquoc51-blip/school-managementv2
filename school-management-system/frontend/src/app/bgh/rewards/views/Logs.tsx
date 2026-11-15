'use client';

import { useEffect, useState } from 'react';
import { errMsg, rewardsApi } from '@/modules/bgh/rewards/rewardsService';
import type { LogRow, Mode, Paged, ViewProps } from '@/modules/bgh/rewards/types';
import { Empty, ftime, Icon, Skeleton } from '../ui';

const ACTIONS: Record<string, string> = {
    score: 'Chấm điểm', delete: 'Xóa điểm', award: 'Đề xuất', approve: 'Phê duyệt', reject: 'Từ chối', criteria: 'Tiêu chí', award_type: 'Danh hiệu',
    dis_award: 'Đề xuất', dis_approve: 'Phê duyệt', dis_reject: 'Từ chối', setup: 'Hệ thống', init: 'Hệ thống',
};
const ICON: Record<string, string> = { score: 'edit', delete: 'trash', award: 'award', approve: 'check', reject: 'x', criteria: 'list', award_type: 'list', setup: 'info', init: 'info' };
const OPTIONS: Record<Mode, string[]> = {
    reward: ['award', 'approve', 'reject', 'award_type'], discipline: ['dis_award', 'dis_approve', 'dis_reject'], emulation: ['score', 'delete', 'criteria'],
};
const HINT: Record<Mode, string> = {
    reward: 'Ai đã làm gì, vào lúc nào trong mục Khen thưởng', discipline: 'Ai đã làm gì, vào lúc nào trong mục Kỷ luật', emulation: 'Ai đã làm gì, vào lúc nào trong mục Thi đua',
};

export default function Logs({ rev, mode }: ViewProps) {
    const [action, setAction] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<Paged<LogRow> | null>(null);
    const [err, setErr] = useState('');

    useEffect(() => {
        setErr('');
        rewardsApi.logs({ scope: mode, action, page }).then(setData).catch((e) => setErr(errMsg(e)));
    }, [action, page, rev, mode]);

    if (err) return <div className="rw-err"><Icon n="alert" />{err}</div>;

    return (
        <div className="rw-stack">
            <div className="row">
                <div><b style={{ fontSize: 15 }}>Nhật ký hoạt động</b><div className="hint">{HINT[mode]}</div></div>
                <span className="spacer" />
                <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} aria-label="Loại hoạt động">
                    <option value="">Mọi hoạt động</option>
                    {OPTIONS[mode].map((k) => <option key={k} value={k}>{ACTIONS[k]}</option>)}
                </select>
            </div>

            {!data ? <Skeleton h={300} /> : (
                <div className="panel">
                    <div className="pb">
                        {!data.data.length && <Empty icon="log" text="Chưa có hoạt động nào." />}
                        {data.data.map((l) => (
                            <div className="tl-i" key={l.id}>
                                <span className={`dot ${l.action.replace(/^dis_/, '')}`}><Icon n={ICON[l.action.replace(/^dis_/, '')] || 'info'} s={15} /></span>
                                <div style={{ flex: 1 }}><p>{l.description}</p><small>{l.user_name} · {ftime(l.created_at)}</small></div>
                                <span className="badge info" style={{ alignSelf: 'flex-start' }}>{ACTIONS[l.action] || l.action}</span>
                            </div>
                        ))}
                    </div>
                    <div className="pager">
                        <button className="btn ghost sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button>
                        <span>Trang {data.current_page}/{data.last_page || 1} · {data.total} dòng</span>
                        <button className="btn ghost sm" disabled={page >= data.last_page} onClick={() => setPage(page + 1)}>Sau</button>
                    </div>
                </div>
            )}
        </div>
    );
}