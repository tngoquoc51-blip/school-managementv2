'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../ui/Icons';
import { L } from '../../../config/links';
import { Related, WsHead } from '../TileGrid';
import type { SchoolClass } from '../../../types/classes';

/** Chọn lớp rồi mở thẳng tab "Phân công môn học" hoặc "Thời khóa biểu" của lớp đó. */
export function ClassPickView({ classes, mode }: { classes: SchoolClass[]; mode: 'subjects' | 'timetable' }) {
  const [grade, setGrade] = useState<number | ''>('');
  const [q, setQ] = useState('');
  const cfg = mode === 'subjects'
    ? { title: 'Phân công môn học', sub: 'Chọn lớp để gán môn học và giáo viên bộ môn', cta: 'Phân công môn', icon: 'book', related: [L.subjects, L.teachers, L.assignment] }
    : { title: 'Thời khóa biểu lớp', sub: 'Chọn lớp để xếp lịch học theo tiết', cta: 'Xếp thời khóa biểu', icon: 'calendar', related: [L.timetable, L.assignment, L.teachers] };
  const list = classes.filter((c) => (!grade || c.grade === grade) && (!q || c.name.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="a-card a-ws">
      <WsHead title={cfg.title} sub={cfg.sub}>
        <div className="a-chips">
          {[{ v: '', l: 'Tất cả' }, { v: 10, l: 'Khối 10' }, { v: 11, l: 'Khối 11' }, { v: 12, l: 'Khối 12' }].map((g) => (
            <button key={g.l} className={`a-chip ${grade === g.v ? 'on' : ''}`} onClick={() => setGrade(g.v as any)}>{g.l}</button>
          ))}
        </div>
        <div className="a-search" style={{ flex: 'none', width: 220 }}>
          <Icon name="search" size={16} /><input className="a-input" placeholder="Tìm lớp…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </WsHead>
      <div className="a-ws-b">
        {list.length === 0 && <div className="a-empty">Không có lớp phù hợp.</div>}
        {[10, 11, 12].map((g) => {
          const cs = list.filter((c) => c.grade === g);
          if (!cs.length) return null;
          return (
            <div key={g} className={`g${g}`}>
              <div className="a-grp">Khối {g} <span className="a-badge mut">{cs.length} lớp</span></div>
              <div className="a-pickgrid">
                {cs.map((c) => (
                  <div key={c.id} className={`a-pickc g${c.grade}`}>
                    <div className="a-row">
                      <span className="nm">{c.name}</span>
                      <span style={{ minWidth: 0 }}>
                        <b style={{ display: 'block' }}>Lớp {c.name}</b>
                        <small className="a-muted">{c.student_count} HS · {c.homeroom_teacher?.full_name ?? 'Chưa có GVCN'}</small>
                      </span>
                    </div>
                    <div className="a-row">
                      <Link href={`/admin/classes/${c.id}#${mode}`} className="a-btn pri sm"><Icon name={cfg.icon} size={14} /> {cfg.cta}</Link>
                      <Link href={`/admin/classes/${c.id}`} className="a-btn sm">Xem lớp</Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <Related items={cfg.related} />
    </div>
  );
}
