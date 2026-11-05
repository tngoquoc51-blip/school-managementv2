'use client';

import { useEffect, useState } from 'react';
import { classService } from '../../services/classService';
import type { Activity } from '../../types/classes';
import { fmtDateTime } from './shared';

export function ActivityTab({ classId }: { classId: number }) {
  const [rows, setRows] = useState<Activity[] | null>(null);
  useEffect(() => { classService.activity(classId).then(setRows).catch(() => setRows([])); }, [classId]);

  return (
    <div className="a-card"><div className="a-card-b">
      <h3 style={{ marginTop: 0 }}>Nhật ký thao tác</h3>
      {rows === null ? <div className="a-skel" style={{ height: 200 }} />
        : rows.length === 0 ? <div className="a-empty">Chưa có hoạt động nào được ghi nhận.</div>
        : rows.map((a) => (
          <div key={a.id} className="a-act"><i />
            <div style={{ flex: 1 }}><b>{a.detail ?? a.action}</b>
              <div className="a-muted" style={{ fontSize: 12 }}>{a.user_name ?? 'Hệ thống'} · {fmtDateTime(a.created_at)}</div></div>
          </div>
        ))}
    </div></div>
  );
}
