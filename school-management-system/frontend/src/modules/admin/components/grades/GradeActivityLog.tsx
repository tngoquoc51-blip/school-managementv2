'use client';

import { useEffect, useState } from 'react';
import { gradeService } from '../../services/gradeService';
import type { GradeActivity } from '../../types/grades';
import { fmtDateTime } from '../classes/shared';

const ACTION_LABEL: Record<string, string> = {
    open_window: 'Mở kỳ nhập điểm', close_window: 'Khóa kỳ nhập điểm',
    add_exception: 'Thêm ngoại lệ', remove_exception: 'Gỡ ngoại lệ',
};

export function GradeActivityLog({ yearId, reloadKey }: { yearId: number; reloadKey: number }) {
    const [rows, setRows] = useState<GradeActivity[] | null>(null);

    useEffect(() => {
        gradeService.activity(yearId).then(setRows).catch(() => setRows([]));
    }, [yearId, reloadKey]);

    return (
        <div className="a-card"><div className="a-card-b">
            <h3 style={{ marginTop: 0 }}>Nhật ký khóa/mở điểm</h3>
            {rows === null ? <div className="a-skel" style={{ height: 160 }} />
                : rows.length === 0 ? <div className="a-empty">Chưa có thao tác nào được ghi nhận.</div>
                    : rows.map((a) => (
                        <div key={a.id} className="a-act"><i />
                            <div style={{ flex: 1 }}>
                                <b>{ACTION_LABEL[a.action] ?? a.action} · Học kỳ {a.semester}</b>
                                {a.detail && <div className="a-muted" style={{ fontSize: 12.5 }}>{a.detail}</div>}
                                <div className="a-muted" style={{ fontSize: 12 }}>{a.user_name ?? 'Hệ thống'} · {fmtDateTime(a.created_at)}</div>
                            </div>
                        </div>
                    ))}
        </div></div>
    );
}