'use client';

import { Icon } from '../../ui/Icons';
import { L } from '../../../config/links';
import { Related, WsHead } from '../TileGrid';
import type { ClassMeta } from '../../../types/classes';

/** Công cụ năm học: thêm lớp, tạo hàng loạt, sao chép sang năm học mới. */
export function YearToolsView({ meta, yearId, onNew, onBulk, onClone }: { meta: ClassMeta | null; yearId: number; onNew: () => void; onBulk: () => void; onClone: () => void }) {
  const year = meta?.school_years.find((y) => y.id === yearId);
  return (
    <div className="a-card a-ws">
      <WsHead title="Tạo lớp & năm học mới" sub={year ? `Đang làm việc với năm học ${year.label}${year.is_current ? ' (hiện tại)' : ''}` : ''} />
      <div className="a-ws-b">
        <div className="a-yearcards">
          <div className="a-yearcard"><h4>Thêm một lớp</h4><p>Nhập tên lớp, khối, phòng học, sĩ số tối đa.</p>
            <div><button className="a-btn pri" onClick={onNew}><Icon name="plus" size={16} /> Thêm lớp</button></div></div>
          <div className="a-yearcard"><h4>Tạo lớp hàng loạt</h4><p>Sinh nhanh 10A1 … 10A8 cho một khối chỉ trong vài giây.</p>
            <div><button className="a-btn pri" onClick={onBulk}><Icon name="layers" size={16} /> Tạo hàng loạt</button></div></div>
          <div className="a-yearcard"><h4>Sang năm học mới</h4><p>Sao chép danh sách lớp và cho học sinh lên lớp.</p>
            <div><button className="a-btn pri" onClick={onClone}><Icon name="copy" size={16} /> Sao chép lớp</button></div></div>
        </div>
        {meta && (
          <div style={{ marginTop: 20 }}>
            <b>Các năm học trong hệ thống</b>
            <div className="a-row a-wrap" style={{ marginTop: 10 }}>
              {meta.school_years.map((y) => <span key={y.id} className={`a-badge ${y.id === yearId ? 'pri' : 'mut'}`}>{y.label}{y.is_current ? ' ★' : ''}</span>)}
            </div>
          </div>
        )}
      </div>
      <Related items={[L.schoolYear, L.promotion, L.roles]} />
    </div>
  );
}
