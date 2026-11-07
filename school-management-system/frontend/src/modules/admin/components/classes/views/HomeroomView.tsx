'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../ui/Icons';
import { L } from '../../../config/links';
import { Related, WsHead } from '../TileGrid';
import type { ClassMeta, SchoolClass } from '../../../types/classes';

/** Phân công giáo viên chủ nhiệm: lọc lớp chưa có GVCN, mở hộp thoại phân công. */
export function HomeroomView({ classes, meta, onAssign }: { classes: SchoolClass[]; meta: ClassMeta | null; onAssign: (c: SchoolClass) => void }) {
  const [onlyMissing, setOnlyMissing] = useState(false);
  const missing = classes.filter((c) => !c.homeroom_teacher).length;
  const taken = useMemo(() => new Set(classes.filter((c) => c.homeroom_teacher).map((c) => c.homeroom_teacher!.id)), [classes]);
  const free = meta ? meta.teachers.filter((t) => !taken.has(t.id)).length : '…';
  const rows = classes.filter((c) => !onlyMissing || !c.homeroom_teacher);

  return (
    <div className="a-card a-ws">
      <WsHead title="Giáo viên chủ nhiệm" sub="Phân công, đổi hoặc gỡ GVCN cho từng lớp">
        <button className={`a-btn sm ${onlyMissing ? 'pri' : ''}`} onClick={() => setOnlyMissing(!onlyMissing)}>Chỉ lớp chưa có GVCN</button>
      </WsHead>
      <div className="a-kpis">
        <div className="a-kpi"><b>{classes.length - missing}/{classes.length}</b><small>Lớp đã có GVCN</small></div>
        <div className="a-kpi"><b>{missing}</b><small>Lớp chưa phân công</small></div>
        <div className="a-kpi"><b>{free}</b><small>Giáo viên chưa chủ nhiệm</small></div>
      </div>
      <div className="a-table-wrap">
        <table className="a-table">
          <thead><tr><th>Lớp</th><th>Sĩ số</th><th>Giáo viên chủ nhiệm</th><th /></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><span className={`a-badge g${c.grade}`} style={{ background: 'var(--gs)', color: 'var(--gc)' }}>{c.name}</span> <span className="a-muted">Khối {c.grade}</span></td>
                <td><b>{c.student_count}</b>/{c.capacity}</td>
                <td>{c.homeroom_teacher ? <b>{c.homeroom_teacher.full_name}</b> : <span className="a-badge warn">Chưa phân công</span>}</td>
                <td>
                  <div className="a-row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                    <button className="a-btn sm pri" onClick={() => onAssign(c)}><Icon name="user" size={14} /> {c.homeroom_teacher ? 'Đổi GVCN' : 'Phân công'}</button>
                    <Link href={`/admin/classes/${c.id}`} className="a-btn sm">Mở lớp</Link>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="a-empty">Tất cả lớp đều đã có GVCN.</td></tr>}
          </tbody>
        </table>
      </div>
      <Related items={[L.teachers, L.users, L.roles]} />
    </div>
  );
}
