'use client';

import { Icon } from '../../ui/Icons';
import { L } from '../../../config/links';
import { Related, WsHead } from '../TileGrid';
import type { SchoolClass } from '../../../types/classes';

/** Báo cáo & thống kê theo khối. */
export function ReportView({ classes, yearLabel, onExport }: { classes: SchoolClass[]; yearLabel: string; onExport: () => void }) {
  const sum = (cs: SchoolClass[], f: (c: SchoolClass) => number) => cs.reduce((n, c) => n + f(c), 0);
  const rows = [10, 11, 12].map((g) => {
    const cs = classes.filter((c) => c.grade === g);
    const st = sum(cs, (c) => c.student_count);
    return { g, classes: cs.length, students: st, male: sum(cs, (c) => c.male_count), female: sum(cs, (c) => c.female_count),
      avg: cs.length ? (st / cs.length).toFixed(1) : '0', full: cs.filter((c) => c.student_count >= c.capacity).length, noHr: cs.filter((c) => !c.homeroom_teacher).length };
  });
  const t = { classes: classes.length, students: sum(classes, (c) => c.student_count), male: sum(classes, (c) => c.male_count), female: sum(classes, (c) => c.female_count),
    full: sum(rows as any, (r: any) => r.full), noHr: sum(rows as any, (r: any) => r.noHr) };
  const sorted = [...classes].sort((a, b) => b.student_count - a.student_count);
  const big = sorted[0]; const small = sorted[sorted.length - 1];

  return (
    <div className="a-card a-ws">
      <WsHead title="Báo cáo & thống kê" sub={`Năm học ${yearLabel}`}>
        <button className="a-btn" onClick={() => window.print()}><Icon name="list" size={16} /> In báo cáo</button>
        <button className="a-btn pri" onClick={onExport}><Icon name="download" size={16} /> Xuất CSV</button>
      </WsHead>
      <div className="a-kpis">
        <div className="a-kpi"><b>{t.classes}</b><small>Tổng số lớp</small></div>
        <div className="a-kpi"><b>{t.students}</b><small>Tổng học sinh</small></div>
        <div className="a-kpi"><b>{big ? `${big.name} (${big.student_count})` : '—'}</b><small>Lớp đông nhất</small></div>
        <div className="a-kpi"><b>{small ? `${small.name} (${small.student_count})` : '—'}</b><small>Lớp ít nhất</small></div>
      </div>
      <div className="a-table-wrap">
        <table className="a-table">
          <thead><tr><th>Khối</th><th>Số lớp</th><th>Học sinh</th><th>Sĩ số TB</th><th>Nam</th><th>Nữ</th><th>Lớp đầy</th><th>Chưa có GVCN</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.g}><td><span className={`a-badge g${r.g}`} style={{ background: 'var(--gs)', color: 'var(--gc)' }}>Khối {r.g}</span></td>
                <td>{r.classes}</td><td><b>{r.students}</b></td><td>{r.avg}</td><td>{r.male}</td><td>{r.female}</td><td>{r.full}</td><td>{r.noHr}</td></tr>
            ))}
            <tr style={{ fontWeight: 800 }}><td>Toàn trường</td><td>{t.classes}</td><td>{t.students}</td><td>{t.classes ? (t.students / t.classes).toFixed(1) : 0}</td><td>{t.male}</td><td>{t.female}</td><td>{t.full}</td><td>{t.noHr}</td></tr>
          </tbody>
        </table>
      </div>
      <Related items={[L.grades, L.acStudents, L.schoolYear]} />
    </div>
  );
}
