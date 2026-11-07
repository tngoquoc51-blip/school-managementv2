'use client';

import { Icon } from '../ui/Icons';
import type { SchoolClass } from '../../types/classes';
import { FillBar, StatusBadge } from './shared';

export function OverviewTab({ cls, onEdit, onHomeroom, goTab }: {
  cls: SchoolClass; onEdit: () => void; onHomeroom: () => void; goTab: (t: string) => void;
}) {
  const malePct = cls.student_count ? Math.round((cls.male_count / cls.student_count) * 100) : 0;
  const left = cls.capacity - cls.student_count;

  return (
    <div className="a-two">
      <div className="a-card">
        <div className="a-card-h"><h3>Thông tin lớp</h3><button className="a-btn sm" onClick={onEdit}><Icon name="edit" size={14} /> Chỉnh sửa</button></div>
        <div className="a-card-b">
          <dl className="a-kv" style={{ margin: 0 }}>
            <dt>Tên lớp</dt><dd>{cls.name}</dd>
            <dt>Khối</dt><dd>Khối {cls.grade}</dd>
            <dt>Năm học</dt><dd>{cls.school_year_label}</dd>
            <dt>Phòng học</dt><dd>{cls.room || '—'}</dd>
            <dt>Trạng thái</dt><dd><StatusBadge status={cls.status} /></dd>
            <dt>GVCN</dt>
            <dd>{cls.homeroom_teacher ? `${cls.homeroom_teacher.full_name} (${cls.homeroom_teacher.code})` : <span className="a-muted">Chưa phân công</span>}{' '}
              <button className="a-btn sm ghost" onClick={onHomeroom}>{cls.homeroom_teacher ? 'Đổi' : 'Phân công'}</button></dd>
            <dt>Ghi chú</dt><dd style={{ fontWeight: 500 }}>{cls.note || '—'}</dd>
          </dl>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
        <div className="a-card"><div className="a-card-b">
          <div className="a-row"><h3 style={{ margin: 0 }}>Sĩ số</h3><span className="a-sp" /><b style={{ fontSize: 22 }}>{cls.student_count}<span className="a-muted" style={{ fontSize: 14 }}>/{cls.capacity}</span></b></div>
          <div style={{ margin: '12px 0 8px' }}><FillBar percent={cls.fill_percent} /></div>
          <span className="a-muted">{left > 0 ? `Còn ${left} chỗ trống` : 'Lớp đã đủ sĩ số'}</span>
        </div></div>

        <div className="a-card"><div className="a-card-b">
          <h3 style={{ margin: '0 0 12px' }}>Cơ cấu giới tính</h3>
          <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', background: 'var(--line)' }}>
            <i style={{ width: `${malePct}%`, background: 'var(--info)' }} /><i style={{ width: `${cls.student_count ? 100 - malePct : 0}%`, background: '#ec4899' }} />
          </div>
          <div className="a-row" style={{ marginTop: 10 }}>
            <span className="a-badge info">Nam {cls.male_count}</span><span className="a-sp" /><span className="a-badge pri" style={{ background: '#fce7f3', color: '#be185d' }}>Nữ {cls.female_count}</span>
          </div>
        </div></div>

        <div className="a-card"><div className="a-card-b" style={{ display: 'grid', gap: 8 }}>
          <h3 style={{ margin: '0 0 4px' }}>Lối tắt</h3>
          <button className="a-btn" onClick={() => goTab('students')}><Icon name="users" size={16} /> Quản lý học sinh</button>
          <button className="a-btn" onClick={() => goTab('subjects')}><Icon name="book" size={16} /> Phân công môn học</button>
          <button className="a-btn" onClick={() => goTab('timetable')}><Icon name="calendar" size={16} /> Xếp thời khóa biểu</button>
        </div></div>
      </div>
    </div>
  );
}
