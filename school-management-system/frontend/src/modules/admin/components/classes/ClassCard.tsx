'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '../ui/Icons';
import { FillBar, StatusBadge } from './shared';
import type { SchoolClass } from '../../types/classes';

const initials = (name: string) => {
  const w = name.trim().split(/\s+/);
  return ((w[0]?.[0] ?? '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
};

/** Thẻ lớp học: banner màu theo khối, avatar GVCN, thống kê có icon, lối tắt vào từng tab. */
export function ClassCard({ c, onOpen, menu }: { c: SchoolClass; onOpen: () => void; menu: ReactNode }) {
  const t = c.homeroom_teacher;
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <div className={`a-card a-class cc g${c.grade}`} onClick={onOpen}>
      <div className="cc-top">
        <div className="cc-deco"><i className="c1" /><i className="c2" /><span className="ic"><Icon name="school" size={84} /></span></div>
        <div className="cc-head">
          <div><small>Khối {c.grade}</small><h4>{c.name}</h4></div>
          <div className="a-row" style={{ gap: 8 }}>{menu}</div>
        </div>
        <div className="cc-status"><StatusBadge status={c.status} /></div>
      </div>

      <div className="cc-body">
        <div className="cc-teacher">
          <span className={`cc-ava ${t ? '' : 'none'}`}>{t ? initials(t.full_name) : <Icon name="user" size={18} />}</span>
          <span style={{ minWidth: 0 }}><small>Giáo viên chủ nhiệm</small><b>{t ? t.full_name : 'Chưa phân công'}</b></span>
        </div>
        <div className="cc-stats">
          <div><Icon name="users" size={16} /><b>{c.student_count}</b><small>Sĩ số</small></div>
          <div><Icon name="user" size={16} /><b>{c.male_count}/{c.female_count}</b><small>Nam/Nữ</small></div>
          <div><Icon name="door" size={16} /><b>{c.room || '—'}</b><small>Phòng</small></div>
        </div>
        <div className="a-row" style={{ marginBottom: 6 }}>
          <span className="a-muted" style={{ fontSize: 12 }}>Lấp đầy {c.student_count}/{c.capacity}</span><span className="a-sp" />
          <b style={{ fontSize: 12, color: 'var(--gc)' }}>{Math.round(Number(c.fill_percent) || 0)}%</b>
        </div>
        <FillBar percent={c.fill_percent} />
      </div>

      <div className="cc-foot" onClick={stop}>
        <Link href={`/admin/classes/${c.id}#students`}><Icon name="users" size={15} /> Học sinh</Link>
        <Link href={`/admin/classes/${c.id}#subjects`}><Icon name="book" size={15} /> Môn học</Link>
        <Link href={`/admin/classes/${c.id}#timetable`}><Icon name="calendar" size={15} /> TKB</Link>
      </div>
    </div>
  );
}
