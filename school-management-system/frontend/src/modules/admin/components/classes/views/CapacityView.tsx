'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '../../ui/Icons';
import { L } from '../../../config/links';
import { FillBar, StatusBadge } from '../shared';
import { Related, WsHead } from '../TileGrid';
import type { SchoolClass } from '../../../types/classes';

/** Sĩ số & xếp lớp: chỗ trống từng lớp, thêm học sinh, mở danh sách / chuyển lớp. */
export function CapacityView({ classes, unassigned, onAdd }: { classes: SchoolClass[]; unassigned?: number; onAdd: (c: SchoolClass) => void }) {
  const rows = useMemo(() => [...classes].sort((a, b) => (a.capacity - a.student_count) - (b.capacity - b.student_count)), [classes]);
  const seats = classes.reduce((n, c) => n + Math.max(0, c.capacity - c.student_count), 0);
  const full = classes.filter((c) => c.student_count >= c.capacity).length;

  return (
    <div className="a-card a-ws">
      <WsHead title="Sĩ số & xếp lớp" sub="Lớp sắp đầy nằm ở trên cùng" />
      <div className="a-kpis">
        <div className="a-kpi"><b>{seats}</b><small>Chỗ trống toàn trường</small></div>
        <div className="a-kpi"><b>{full}</b><small>Lớp đã đầy</small></div>
        <div className="a-kpi"><b>{unassigned ?? '…'}</b><small>Học sinh chưa xếp lớp</small></div>
      </div>
      <div className="a-table-wrap">
        <table className="a-table">
          <thead><tr><th>Lớp</th><th>Sĩ số</th><th style={{ width: 170 }}>Lấp đầy</th><th>Còn trống</th><th>Nam / Nữ</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>
            {rows.map((c) => {
              const left = c.capacity - c.student_count;
              return (
                <tr key={c.id}>
                  <td><b>{c.name}</b> <span className="a-muted">· Khối {c.grade}</span></td>
                  <td><b>{c.student_count}</b>/{c.capacity}</td>
                  <td><FillBar percent={c.fill_percent} /></td>
                  <td><span className={`a-badge ${left <= 0 ? 'dng' : left <= 3 ? 'warn' : 'ok'}`}>{left} chỗ</span></td>
                  <td>{c.male_count} / {c.female_count}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>
                    <div className="a-row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button className="a-btn sm pri" disabled={left <= 0} onClick={() => onAdd(c)}><Icon name="plus" size={14} /> Thêm HS</button>
                      <Link href={`/admin/classes/${c.id}#students`} className="a-btn sm"><Icon name="swap" size={14} /> Danh sách / chuyển lớp</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Related items={[L.students, L.acStudents, L.promotion]} />
    </div>
  );
}
