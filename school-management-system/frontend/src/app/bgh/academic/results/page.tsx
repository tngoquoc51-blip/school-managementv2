'use client';

import { useState } from 'react';
import { Avatar, Badge, Card, Donut, Drawer, Empty, ErrorBox, HBar, Icon, Kpi, Legend, PageHeader, Seg, Skeleton, StackBar } from '@/components/bgh-academic/ui';
import { useAcademic } from '@/components/bgh-academic/Shell';
import { LEVELS, LEVEL_COLOR, LEVEL_TONE, fixed, num, useApi } from '@/lib/bgh-academic';

const nf = new Intl.NumberFormat('vi-VN');

export default function ResultsPage() {
  const { yearId, semester } = useAcademic();
  const res = useApi<any>('/results', { year_id: yearId, semester });
  const [grade, setGrade] = useState<'all' | 10 | 11 | 12>('all');
  const [classId, setClassId] = useState<number | null>(null);

  if (res.error) return <ErrorBox error={res.error} onRetry={res.reload} />;
  if (!res.data) return <Skeleton h={120} n={4} />;
  const d = res.data;

  const gradeRow = grade === 'all' ? null : d.by_grade.find((g: any) => g.grade === grade);
  const dist = grade === 'all'
    ? LEVELS.map((l) => ({ label: l, value: num(d.distribution[l]), color: LEVEL_COLOR[l] }))
    : [{ label: 'Tốt', value: num(gradeRow?.tot) }, { label: 'Khá', value: num(gradeRow?.kha) }, { label: 'Đạt', value: num(gradeRow?.dat) }, { label: 'Chưa đạt', value: num(gradeRow?.chua) }].map((x) => ({ ...x, color: LEVEL_COLOR[x.label] }));
  const total = dist.reduce((s, x) => s + x.value, 0);
  const good = total ? ((dist[0].value + dist[1].value) / total) * 100 : 0;
  const weak = total ? (dist[3].value / total) * 100 : 0;
  const avg = grade === 'all'
    ? (d.by_grade.reduce((s: number, g: any) => s + num(g.avg_score) * num(g.students), 0) / Math.max(1, d.by_grade.reduce((s: number, g: any) => s + num(g.students), 0)))
    : num(gradeRow?.avg_score);
  const classes = d.by_class.filter((c: any) => grade === 'all' || c.grade === grade);
  const conduct: Record<number, Record<string, number>> = {};
  d.conduct.forEach((c: any) => { conduct[c.grade] = { ...(conduct[c.grade] || {}), [c.lv]: num(c.n) }; });

  return (
    <>
      <PageHeader title="Kết quả học tập" desc="Học lực, hạnh kiểm, so sánh lớp – môn và học sinh cần hỗ trợ.">
        <Seg value={grade} onChange={setGrade} options={[{ value: 'all', label: 'Toàn trường' }, { value: 10, label: 'Khối 10' }, { value: 11, label: 'Khối 11' }, { value: 12, label: 'Khối 12' }]} />
      </PageHeader>

      <div className="ac-grid ac-g4" style={{ marginBottom: 16 }}>
        <Kpi icon="grad" tone="primary" label="Học sinh có điểm" value={nf.format(total)} />
        <Kpi icon="star" tone="info" label="Điểm trung bình" value={fixed(avg, 2)} />
        <Kpi icon="award" tone="ok" label="Tốt + Khá" value={`${good.toFixed(1)}%`} />
        <Kpi icon="alert" tone={weak > 3 ? 'bad' : 'warn'} label="Chưa đạt" value={`${weak.toFixed(1)}%`} sub={<span className="ac-muted">{dist[3].value} học sinh</span>} />
      </div>

      <div className="ac-grid ac-g-7-5">
        <Card title="Phân bố học lực">
          <div className="ac-row ac-wrap" style={{ gap: 32 }}>
            <Donut data={dist} center={nf.format(total)} sub="học sinh" />
            <div style={{ flex: 1, minWidth: 220 }}>
              {dist.map((x) => <HBar key={x.label} label={x.label} value={x.value} max={total || 1} color={x.color} text={`${x.value} · ${total ? ((x.value / total) * 100).toFixed(1) : 0}%`} />)}
            </div>
          </div>
          <p className="ac-small ac-muted" style={{ marginTop: 14 }}>{d.note}</p>
        </Card>
        <Card title="Hạnh kiểm theo khối">
          <div className="ac-grid" style={{ gap: 14 }}>
            {[10, 11, 12].filter((g) => grade === 'all' || g === grade).map((g) => {
              const c = conduct[g] || {};
              return (<div key={g}><div className="ac-row ac-small" style={{ marginBottom: 6 }}><b>Khối {g}</b><span className="ac-muted ac-right">{LEVELS.map((l) => `${l}: ${c[l] || 0}`).join(' · ')}</span></div>
                <StackBar parts={LEVELS.map((l) => ({ label: l, value: c[l] || 0, color: LEVEL_COLOR[l] }))} /></div>);
            })}
            <Legend items={LEVELS.map((l) => ({ label: l, color: LEVEL_COLOR[l] }))} />
          </div>
        </Card>
      </div>

      <div className="ac-grid ac-g-7-5 ac-mt">
        <Card title={`Kết quả theo lớp (${classes.length})`} flush>
          <div className="ac-table-wrap"><table className="ac-table">
            <thead><tr><th>Lớp</th><th>GVCN</th><th>Sĩ số</th><th>Điểm TB</th><th style={{ minWidth: 160 }}>Học lực</th><th /></tr></thead>
            <tbody>{classes.map((c: any) => (
              <tr key={c.id} className="click" onClick={() => setClassId(c.id)}>
                <td className="ac-b">{c.name}</td><td className="ac-small">{c.homeroom || '–'}</td><td className="ac-num">{c.students}</td>
                <td className="ac-b ac-num">{fixed(c.avg_score, 2)}</td>
                <td><StackBar parts={[{ label: 'Tốt', value: num(c.tot), color: LEVEL_COLOR['Tốt'] }, { label: 'Khá', value: num(c.kha), color: LEVEL_COLOR['Khá'] }, { label: 'Đạt', value: num(c.dat), color: LEVEL_COLOR['Đạt'] }, { label: 'Chưa đạt', value: num(c.chua), color: LEVEL_COLOR['Chưa đạt'] }]} /></td>
                <td><Icon name="arrow" size={15} /></td>
              </tr>))}</tbody></table></div>
        </Card>
        <Card title="Điểm trung bình theo môn">
          {d.subjects.filter((s: any) => s.avg_score !== null).map((s: any) => <HBar key={s.id} label={s.name} value={num(s.avg_score)} max={10} color={num(s.avg_score) >= 7.5 ? 'var(--ok)' : 'var(--primary)'} text={`${fixed(s.avg_score, 2)}`} />)}
        </Card>
      </div>

      <div className="ac-grid ac-g2 ac-mt">
        <Card title="Học sinh tiêu biểu (Top 10)">
          {d.top_students.map((s: any, i: number) => (
            <div key={s.id} className="ac-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <b style={{ width: 22, color: i < 3 ? 'var(--warn-text)' : 'var(--muted)' }}>{i + 1}</b><Avatar name={s.full_name} size={32} />
              <div style={{ flex: 1 }}><div className="ac-b">{s.full_name}</div><div className="ac-small ac-muted">{s.code} · lớp {s.class_name}</div></div>
              <Badge tone="ok">{fixed(s.avg_score, 2)}</Badge>
            </div>))}
        </Card>
        <Card title="Học sinh cần hỗ trợ">
          {d.at_risk.length === 0 ? <Empty icon="check" title="Không có học sinh cần hỗ trợ" /> : d.at_risk.map((s: any) => (
            <div key={s.id} className="ac-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <Avatar name={s.full_name} size={32} />
              <div style={{ flex: 1 }}><div className="ac-b">{s.full_name}</div><div className="ac-small ac-muted">{s.code} · lớp {s.class_name} · môn thấp nhất {fixed(s.min_score)}</div></div>
              <Badge tone="bad">{fixed(s.avg_score, 2)}</Badge>
            </div>))}
        </Card>
      </div>
      {classId && <ClassDrawer id={classId} onClose={() => setClassId(null)} />}
    </>
  );
}

function ClassDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const { semester } = useAcademic();
  const d = useApi<any>(`/results/class/${id}`, { semester });
  return (
    <Drawer open onClose={onClose} title={d.data ? `Lớp ${d.data.class.name}` : 'Chi tiết lớp'} subtitle={d.data ? `GVCN: ${d.data.class.homeroom || '–'} · ${d.data.students.length} học sinh` : undefined}>
      {d.error ? <ErrorBox error={d.error} onRetry={d.reload} /> : !d.data ? <Skeleton h={50} n={8} /> : (
        <div className="ac-grid" style={{ gap: 20 }}>
          <Card title="Điểm trung bình các môn">
            {d.data.subjects.map((s: any) => <HBar key={s.id} label={s.name} value={num(s.avg_score)} max={10} text={s.avg_score === null ? 'NX' : fixed(s.avg_score, 2)} />)}
          </Card>
          <Card title="Danh sách học sinh" flush>
            <div className="ac-table-wrap"><table className="ac-table"><thead><tr><th>#</th><th>Học sinh</th><th>Điểm TB</th><th>Học lực</th><th>Hạnh kiểm</th></tr></thead>
              <tbody>{d.data.students.map((s: any) => (
                <tr key={s.id}><td className="ac-num">{s.rank}</td><td><div className="ac-b">{s.full_name}</div><div className="ac-small ac-muted">{s.code}</div></td>
                  <td className="ac-b ac-num">{fixed(s.avg_score, 2)}</td>
                  <td>{s.lv ? <Badge tone={LEVEL_TONE[s.lv]}>{s.lv}</Badge> : '–'}</td>
                  <td>{s.conduct ? <Badge tone={LEVEL_TONE[s.conduct] || 'muted'}>{s.conduct}</Badge> : '–'}</td></tr>
              ))}</tbody></table></div>
          </Card>
        </div>
      )}
    </Drawer>
  );
}
