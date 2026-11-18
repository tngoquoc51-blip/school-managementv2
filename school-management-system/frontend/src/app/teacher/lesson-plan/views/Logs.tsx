'use client';

import { useEffect, useState } from 'react';
import { errMsg, logApi } from '@/modules/teacher/lessonlog/service';
import type { LogRow, Paged, ViewProps } from '@/modules/teacher/lessonlog/types';
import { Empty, Icon, Skeleton, ftime } from '@/app/bgh/rewards/ui';

const ACT: Record<string, { l: string; icon: string }> = {
    sign: { l: 'Ký sổ', icon: 'check' }, draft: { l: 'Lưu nháp', icon: 'edit' }, delete: { l: 'Xóa', icon: 'trash' }, note: { l: 'Nề nếp', icon: 'star' },
    week_sign: { l: 'Ký tuần', icon: 'award' }, week_reopen: { l: 'Mở lại', icon: 'refresh' }, week_approve: { l: 'BGH duyệt', icon: 'check' }, week_return: { l: 'BGH trả lại', icon: 'alert' },
};

export default function Logs({ classId, rev }: ViewProps) {
    const [page, setPage] = useState(1);
    const [d, setD] = useState<Paged<LogRow> | null>(null);
    const [err, setErr] = useState('');
    useEffect(() => { setPage(1); }, [classId]);
    useEffect(() => {
        setErr('');
        logApi.logs(classId, page).then(setD).catch((e) => setErr(errMsg(e)));
    }, [classId, page, rev]);

    if (err) return <div className="rw-err"><Icon n="alert" />{err}</div>;
    if (!d) return <Skeleton h={300} />;
    return (
        <div className="rw-stack">
            {!d.data.length ? <div className="panel"><Empty icon="log" text="Chưa có hoạt động nào." /></div> : (
                <div className="panel">
                    {d.data.map((l) => (
                        <div className="mini" key={l.id}>
                            <span className="ll-st info"><Icon n={ACT[l.action]?.icon || 'info'} s={14} />{ACT[l.action]?.l || l.action}</span>
                            <span className="n"><b>{l.description}</b><span>{l.user_name} · {ftime(l.created_at)}</span></span>
                        </div>
                    ))}
                </div>
            )}
            {d.last_page > 1 && (
                <div className="pager">
                    <button className="btn ghost sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button>
                    <span>Trang {d.current_page}/{d.last_page}</span>
                    <button className="btn ghost sm" disabled={page >= d.last_page} onClick={() => setPage(page + 1)}>Sau</button>
                </div>
            )}
        </div>
    );
}