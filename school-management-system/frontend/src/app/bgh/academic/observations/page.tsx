'use client';

import { useState } from 'react';
import { Avatar, Badge, Card, Empty, ErrorBox, Field, HBar, Icon, Kpi, Modal, PageHeader, Skeleton, useToast } from '@/components/bgh-academic/ui';
import { useAcademic } from '@/components/bgh-academic/Shell';
import { LEVEL_COLOR, LEVEL_TONE, apiSend, errMsg, fixed, fmtDate, num, useApi } from '@/lib/bgh-academic';

const ratingOf = (s: number) => (s >= 8 ? 'Tốt' : s >= 6.5 ? 'Khá' : s >= 5 ? 'Đạt' : 'Chưa đạt');

export default function ObservationsPage() {
  const { reloadOverview } = useAcademic();
  const toast = useToast();
  const res = useApi<{ items: any[]; stats: any }>('/observations', {});
  const [form, setForm] = useState(false);
  const [sel, setSel] = useState<any | null>(null);
  const s = res.data?.stats;
  const total = num(s?.total);

  return (
    <>
      <PageHeader title="Dự giờ & đánh giá giờ dạy" desc="Ghi nhận phiếu dự giờ, theo dõi chất lượng giờ dạy của giáo viên.">
        <button className="ac-btn primary" onClick={() => setForm(true)}><Icon name="plus" size={16} /> Thêm phiếu dự giờ</button>
      </PageHeader>

      <div className="ac-grid ac-g4" style={{ marginBottom: 16 }}>
        <Kpi icon="eye" tone="primary" label="Tổng lượt dự giờ" value={total} />
        <Kpi icon="clock" tone="info" label="Trong 30 ngày qua" value={num(s?.last30)} />
        <Kpi icon="star" tone="ok" label="Điểm trung bình" value={fixed(s?.avg_score)} />
        <Card><div style={{ padding: 2 }}>{(['Tốt', 'Khá', 'Đạt', 'Chưa đạt'] as const).map((l, i) => <HBar key={l} label={l} value={num([s?.tot, s?.kha, s?.dat, s?.chua][i])} max={total || 1} color={LEVEL_COLOR[l]} text={String(num([s?.tot, s?.kha, s?.dat, s?.chua][i]))} />)}</div></Card>
      </div>

      {res.error ? <ErrorBox error={res.error} onRetry={res.reload} /> : res.loading && !res.data ? <Skeleton h={60} n={6} /> : (res.data?.items.length || 0) === 0 ? <Empty icon="eye" title="Chưa có phiếu dự giờ" /> : (
        <Card flush>
          <div className="ac-table-wrap"><table className="ac-table">
            <thead><tr><th>Ngày</th><th>Giáo viên</th><th>Lớp · Môn</th><th>Bài giảng</th><th>Điểm</th><th>Xếp loại</th></tr></thead>
            <tbody>{res.data!.items.map((o) => (
              <tr key={o.id} className="click" onClick={() => setSel(o)}>
                <td className="ac-num">{fmtDate(o.observed_on)}<div className="ac-small ac-muted">Tiết {o.period}</div></td>
                <td><div className="ac-row"><Avatar name={o.teacher} size={32} /><span className="ac-b">{o.teacher}</span></div></td>
                <td>{o.class_name} · {o.subject}</td><td className="ac-small">{o.lesson_title}</td>
                <td className="ac-b ac-num">{fixed(o.score)}</td><td><Badge tone={LEVEL_TONE[o.rating]}>{o.rating}</Badge></td>
              </tr>))}</tbody></table></div>
        </Card>
      )}

      {form && <ObservationForm onClose={() => setForm(false)} onSaved={() => { setForm(false); res.reload(); reloadOverview(); toast.success('Đã lưu phiếu dự giờ', 'Giáo viên sẽ nhận được thông báo kết quả.'); }} />}
      <Modal open={!!sel} onClose={() => setSel(null)} title="Phiếu dự giờ">
        {sel && <div className="ac-grid" style={{ gap: 12 }}>
          <div className="ac-row"><Avatar name={sel.teacher} size={44} /><div><div className="ac-b">{sel.teacher}</div><div className="ac-small ac-muted">Lớp {sel.class_name} · {sel.subject} · {fmtDate(sel.observed_on)} · tiết {sel.period}</div></div><span className="ac-right"><Badge tone={LEVEL_TONE[sel.rating]}>{fixed(sel.score)} · {sel.rating}</Badge></span></div>
          <div><div className="ac-small ac-muted">Bài giảng</div><div className="ac-b">{sel.lesson_title}</div></div>
          <div className="ac-alert tone-ok"><Icon name="check" /><div><b>Ưu điểm</b><div>{sel.strengths || '–'}</div></div></div>
          <div className="ac-alert tone-warn"><Icon name="info" /><div><b>Cần cải thiện</b><div>{sel.improvements || '–'}</div></div></div>
          <div className="ac-small ac-muted">Người dự giờ: {sel.observer_name}</div>
        </div>}
      </Modal>
    </>
  );
}

function ObservationForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { meta, yearId } = useAcademic();
  const classes = meta.classes.filter((c) => c.school_year_id === yearId);
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<any>({ teacher_id: meta.teachers[0]?.id, class_id: classes[0]?.id, observed_on: today, period: 1, lesson_title: '', score: 8, strengths: '', improvements: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: any) => { setF((s: any) => ({ ...s, [k]: v })); setErr(''); };
  const teacher = meta.teachers.find((t) => t.id === Number(f.teacher_id));
  const subject = meta.subjects.find((x) => x.id === teacher?.main_subject_id);

  const save = async () => {
    if (!f.lesson_title.trim()) { setErr('Vui lòng nhập tên bài giảng.'); return; }
    setBusy(true);
    try {
      await apiSend('post', '/observations', { ...f, teacher_id: Number(f.teacher_id), class_id: Number(f.class_id), subject_id: teacher?.main_subject_id, period: Number(f.period), score: Number(f.score) });
      onSaved();
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Thêm phiếu dự giờ" width={680}
      footer={<><button className="ac-btn" onClick={onClose}>Hủy</button><button className="ac-btn primary" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu phiếu'}</button></>}>
      <div className="ac-grid ac-g2">
        <Field label="Giáo viên được dự giờ"><select className="ac-select" value={f.teacher_id} onChange={(e) => set('teacher_id', e.target.value)}>{meta.teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name} ({t.code})</option>)}</select></Field>
        <Field label="Môn học"><input className="ac-input" value={subject?.name || ''} disabled /></Field>
        <Field label="Lớp"><select className="ac-select" value={f.class_id} onChange={(e) => set('class_id', e.target.value)}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <div className="ac-grid ac-g2" style={{ gap: 10 }}>
          <Field label="Ngày dự giờ"><input type="date" className="ac-input" value={f.observed_on} onChange={(e) => set('observed_on', e.target.value)} /></Field>
          <Field label="Tiết"><select className="ac-select" value={f.period} onChange={(e) => set('period', e.target.value)}>{[1, 2, 3, 4, 5].map((p) => <option key={p}>{p}</option>)}</select></Field>
        </div>
      </div>
      <Field label="Tên bài giảng"><input className="ac-input" value={f.lesson_title} onChange={(e) => set('lesson_title', e.target.value)} placeholder="Ví dụ: Hàm số bậc hai" /></Field>
      <Field label={`Điểm đánh giá: ${fixed(f.score)} – ${ratingOf(Number(f.score))}`}>
        <input type="range" min={0} max={10} step={0.5} value={f.score} onChange={(e) => set('score', e.target.value)} style={{ width: '100%' }} />
      </Field>
      <div className="ac-grid ac-g2">
        <Field label="Ưu điểm"><textarea className="ac-textarea" value={f.strengths} onChange={(e) => set('strengths', e.target.value)} /></Field>
        <Field label="Cần cải thiện"><textarea className="ac-textarea" value={f.improvements} onChange={(e) => set('improvements', e.target.value)} /></Field>
      </div>
      {err && <div className="ac-alert tone-bad"><Icon name="alert" /><div>{err}</div></div>}
    </Modal>
  );
}
