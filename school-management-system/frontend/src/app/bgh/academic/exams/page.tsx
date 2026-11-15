'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Field, Icon, Kpi, Modal, PageHeader, Seg, Skeleton, useToast } from '@/components/bgh-academic/ui';
import { useAcademic } from '@/components/bgh-academic/Shell';
import { apiSend, errMsg, fmtDate, useApi } from '@/lib/bgh-academic';

const FORMATS = ['Tự luận', 'Trắc nghiệm', 'Tự luận + Trắc nghiệm', 'Thực hành', 'Vấn đáp'];
const DOW = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export default function ExamsPage() {
  const { yearId, meta } = useAcademic();
  const toast = useToast();
  const periods = useApi<any[]>('/exams', { year_id: yearId });
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [grade, setGrade] = useState<'all' | 10 | 11 | 12>('all');
  const [form, setForm] = useState<any | null>(null);
  const [del, setDel] = useState<any | null>(null);

  useEffect(() => { setPeriodId(periods.data?.[0]?.id ?? null); }, [periods.data]);
  const sched = useApi<any>(periodId ? `/exams/${periodId}/schedule` : null);
  const period = sched.data?.period;
  const items: any[] = (sched.data?.items || []).filter((i: any) => grade === 'all' || i.grade === grade);

  const byDate = useMemo(() => {
    const m = new Map<string, any[]>();
    items.forEach((i) => m.set(i.exam_date, [...(m.get(i.exam_date) || []), i]));
    return Array.from(m.entries());
  }, [items]);

  const openForm = (row?: any) => setForm(row
    ? { grade: row.grade, subject_id: row.subject_id, exam_date: row.exam_date, start_time: row.start_time.slice(0, 5), duration_minutes: row.duration_minutes, exam_format: row.exam_format, edit: true }
    : { grade: 10, subject_id: meta.subjects[0]?.id, exam_date: period?.start_date, start_time: '07:30', duration_minutes: 90, exam_format: 'Tự luận' });

  return (
    <>
      <PageHeader title="Kỳ thi & lịch thi" desc="Lập lịch thi theo khối và môn, hệ thống tự kiểm tra ngày thi trong kỳ và trùng khung giờ.">
        <button className="ac-btn primary" disabled={!periodId} onClick={() => openForm()}><Icon name="plus" size={16} /> Thêm lịch thi</button>
      </PageHeader>

      {periods.error ? <ErrorBox error={periods.error} onRetry={periods.reload} /> : periods.loading && !periods.data ? <Skeleton h={90} n={3} /> : (periods.data || []).length === 0 ? <Empty icon="exam" title="Năm học này chưa có kỳ thi" /> : (
        <div className="ac-grid ac-g-3-9">
          <div className="ac-grid" style={{ gap: 10, alignContent: 'start' }}>
            {(periods.data || []).map((p) => (
              <button key={p.id} onClick={() => setPeriodId(p.id)} className={`ac-check ${periodId === p.id ? 'on' : ''}`} style={{ textAlign: 'left', font: 'inherit', color: 'inherit', background: periodId === p.id ? undefined : 'var(--surface)' }}>
                <div className="ac-avatar tone-primary" style={{ width: 38, height: 38 }}><Icon name="exam" size={18} /></div>
                <div style={{ flex: 1 }}><div className="ac-b">{p.name}</div><div className="ac-small ac-muted">{fmtDate(p.start_date)} – {fmtDate(p.end_date)}</div>
                  <div style={{ marginTop: 6 }}><Badge tone="muted">{p.schedule_count} môn thi</Badge> <Badge tone="info">HK{p.semester}</Badge></div></div>
              </button>
            ))}
          </div>

          <div className="ac-grid" style={{ gap: 16 }}>
            <div className="ac-grid ac-g3">
              <Kpi icon="exam" tone="primary" label="Tổng buổi thi" value={sched.data?.items?.length ?? '–'} />
              <Kpi icon="calendar" tone="info" label="Số ngày thi" value={new Set((sched.data?.items || []).map((i: any) => i.exam_date)).size} />
              <Kpi icon="alert" tone={sched.data?.conflicts?.length ? 'bad' : 'ok'} label="Trùng giờ" value={sched.data?.conflicts?.length ?? 0} />
            </div>
            {(sched.data?.conflicts || []).map((c: any, i: number) => <div key={i} className="ac-alert tone-bad"><Icon name="alert" /><div>{c.text}</div></div>)}

            <Card title={period?.name || 'Lịch thi'} extra={<Seg value={grade} onChange={setGrade} options={[{ value: 'all', label: 'Tất cả' }, { value: 10, label: 'Khối 10' }, { value: 11, label: 'Khối 11' }, { value: 12, label: 'Khối 12' }]} />} flush>
              {sched.error ? <div className="ac-card-b"><ErrorBox error={sched.error} onRetry={sched.reload} /></div> : sched.loading && !sched.data ? <div className="ac-card-b"><Skeleton h={50} n={4} /></div> : byDate.length === 0 ? <Empty icon="calendar" title="Chưa có lịch thi" hint="Bấm “Thêm lịch thi” để lập lịch cho kỳ này." /> : (
                <div className="ac-table-wrap">
                  <table className="ac-table">
                    <thead><tr><th>Ngày</th><th>Khối</th><th>Môn thi</th><th>Giờ</th><th>Thời lượng</th><th>Hình thức</th><th /></tr></thead>
                    <tbody>
                      {byDate.map(([date, rows]) => rows.map((r, idx) => (
                        <tr key={r.id}>
                          <td>{idx === 0 ? <><div className="ac-b">{DOW[new Date(date + 'T00:00:00').getDay()]}</div><div className="ac-small ac-muted">{fmtDate(date)}</div></> : null}</td>
                          <td><Badge tone="primary">Khối {r.grade}</Badge></td>
                          <td className="ac-b">{r.subject}</td>
                          <td className="ac-num">{r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}</td>
                          <td className="ac-num">{r.duration_minutes} phút</td>
                          <td><Badge tone={r.exam_format === 'Trắc nghiệm' ? 'info' : 'muted'}>{r.exam_format}</Badge></td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button className="ac-btn sm ghost" onClick={() => openForm(r)} aria-label="Sửa"><Icon name="edit" size={15} /></button>
                            <button className="ac-btn sm ghost" onClick={() => setDel(r)} aria-label="Xóa"><Icon name="trash" size={15} /></button>
                          </td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {form && periodId && <ExamForm initial={form} periodId={periodId} period={period} onClose={() => setForm(null)}
        onSaved={(d) => { sched.setData(d); periods.reload(); setForm(null); toast.success('Đã lưu lịch thi'); }} />}
      <Modal open={!!del} onClose={() => setDel(null)} title="Xóa lịch thi?"
        footer={<><button className="ac-btn" onClick={() => setDel(null)}>Hủy</button>
          <button className="ac-btn bad" onClick={async () => {
            try { const r = await apiSend<any>('delete', `/exams/schedule/${del.id}`); sched.setData(r.data); periods.reload(); toast.success('Đã xóa lịch thi', `${del.subject} – khối ${del.grade}`); }
            catch (e) { toast.error('Không thể xóa', errMsg(e)); }
            setDel(null);
          }}>Xóa lịch thi</button></>}>
        {del && <p>Bạn sắp xóa lịch thi <b>{del.subject}</b> của <b>khối {del.grade}</b> ngày {fmtDate(del.exam_date)}.</p>}
      </Modal>
    </>
  );
}

function ExamForm({ initial, periodId, period, onClose, onSaved }: { initial: any; periodId: number; period: any; onClose: () => void; onSaved: (d: any) => void }) {
  const { meta } = useAcademic();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: any) => { setF((s: any) => ({ ...s, [k]: v })); setErr(''); };
  const save = async () => {
    setBusy(true); setErr('');
    try {
      const r = await apiSend<any>('post', `/exams/${periodId}/schedule`, { grade: Number(f.grade), subject_id: Number(f.subject_id), exam_date: f.exam_date, start_time: `${f.start_time.slice(0, 5)}:00`, duration_minutes: Number(f.duration_minutes), exam_format: f.exam_format });
      onSaved(r.data);
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={f.edit ? 'Sửa lịch thi' : 'Thêm lịch thi'}
      footer={<><button className="ac-btn" onClick={onClose}>Hủy</button><button className="ac-btn primary" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu lịch thi'}</button></>}>
      <div className="ac-grid ac-g2">
        <Field label="Khối"><select className="ac-select" value={f.grade} disabled={f.edit} onChange={(e) => set('grade', e.target.value)}>{[10, 11, 12].map((g) => <option key={g} value={g}>Khối {g}</option>)}</select></Field>
        <Field label="Môn thi"><select className="ac-select" value={f.subject_id} disabled={f.edit} onChange={(e) => set('subject_id', e.target.value)}>{meta.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Ngày thi"><input type="date" className="ac-input" value={f.exam_date || ''} min={period?.start_date} max={period?.end_date} onChange={(e) => set('exam_date', e.target.value)} /></Field>
        <Field label="Giờ bắt đầu"><input type="time" className="ac-input" value={f.start_time} onChange={(e) => set('start_time', e.target.value)} /></Field>
        <Field label="Thời lượng (phút)"><input type="number" className="ac-input" min={15} max={240} step={5} value={f.duration_minutes} onChange={(e) => set('duration_minutes', e.target.value)} /></Field>
        <Field label="Hình thức"><select className="ac-select" value={f.exam_format} onChange={(e) => set('exam_format', e.target.value)}>{FORMATS.map((x) => <option key={x}>{x}</option>)}</select></Field>
      </div>
      {err && <div className="ac-alert tone-bad"><Icon name="alert" /><div>{err}</div></div>}
      {period && <p className="ac-small ac-muted">Ngày thi phải nằm trong kỳ: {fmtDate(period.start_date)} – {fmtDate(period.end_date)}.</p>}
    </Modal>
  );
}
