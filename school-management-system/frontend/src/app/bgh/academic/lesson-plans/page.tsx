'use client';

import { useState } from 'react';
import { Avatar, Badge, Card, Empty, ErrorBox, Field, Icon, Modal, PageHeader, Seg, Skeleton, useToast } from '@/components/bgh-academic/ui';
import { useAcademic } from '@/components/bgh-academic/Shell';
import { apiSend, errMsg, fmtDate, timeAgo, useApi } from '@/lib/bgh-academic';

const STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: 'Chờ duyệt', tone: 'warn' }, approved: { label: 'Đã duyệt', tone: 'ok' },
  rejected: { label: 'Từ chối', tone: 'bad' }, revision: { label: 'Cần chỉnh sửa', tone: 'info' },
};
type Decision = 'approved' | 'rejected' | 'revision';

export default function LessonPlansPage() {
  const { reloadOverview } = useAcademic();
  const toast = useToast();
  const [tab, setTab] = useState<string>('pending');
  const res = useApi<{ items: any[]; counts: Record<string, number> }>('/lesson-plans', {});
  const [target, setTarget] = useState<{ plan: any; decision: Decision } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const counts = res.data?.counts || { pending: 0, approved: 0, rejected: 0, revision: 0 };
  const items = (res.data?.items || []).filter((p) => tab === 'all' || p.status === tab);

  const open = (plan: any, decision: Decision) => { setTarget({ plan, decision }); setNote(''); setErr(''); };
  const submit = async () => {
    if (!target) return;
    if (target.decision !== 'approved' && !note.trim()) { setErr('Vui lòng nhập nhận xét.'); return; }
    setBusy(true);
    try {
      await apiSend('post', `/lesson-plans/${target.plan.id}/review`, { decision: target.decision, note: note.trim() || null });
      toast.success(`${STATUS[target.decision].label}`, `${target.plan.teacher} – ${target.plan.title}`);
      setTarget(null); res.reload(); reloadOverview();
    } catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Duyệt giáo án" desc="Xem xét, góp ý và phê duyệt giáo án giáo viên nộp hằng tuần.">
        <Seg value={tab} onChange={setTab} options={[
          { value: 'pending', label: 'Chờ duyệt', count: counts.pending }, { value: 'revision', label: 'Cần chỉnh sửa' },
          { value: 'approved', label: 'Đã duyệt' }, { value: 'rejected', label: 'Từ chối' }, { value: 'all', label: 'Tất cả' }]} />
      </PageHeader>

      {res.error ? <ErrorBox error={res.error} onRetry={res.reload} /> : res.loading && !res.data ? <Skeleton h={110} n={4} /> : items.length === 0 ? <Empty icon="check" title="Không có giáo án trong mục này" hint="Tuyệt vời, bạn đã xử lý hết!" /> : (
        <div className="ac-grid ac-g2">
          {items.map((p) => (
            <Card key={p.id}>
              <div className="ac-row" style={{ alignItems: 'flex-start' }}>
                <Avatar name={p.teacher} size={42} />
                <div style={{ flex: 1 }}>
                  <div className="ac-row"><b>{p.title}</b></div>
                  <div className="ac-small ac-muted">{p.teacher} · {p.subject} · Khối {p.grade} · Tuần {p.week_no}</div>
                </div>
                <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
              </div>
              {p.note && <p className="ac-small" style={{ margin: '12px 0 0', color: 'var(--text-2)' }}>{p.note}</p>}
              {p.review_note && <div className="ac-alert tone-muted ac-small" style={{ marginTop: 12 }}><Icon name="info" size={16} /><div><b>{p.reviewer_name}:</b> {p.review_note}</div></div>}
              <div className="ac-row" style={{ marginTop: 14 }}>
                <span className="ac-small ac-muted"><Icon name="clock" size={13} /> Nộp {timeAgo(p.submitted_at)}{p.reviewed_at ? ` · duyệt ${fmtDate(p.reviewed_at)}` : ''}</span>
                <div className="ac-right ac-row">
                  {p.status !== 'approved' && <button className="ac-btn sm ok" onClick={() => open(p, 'approved')}><Icon name="check" size={14} /> Duyệt</button>}
                  {p.status === 'pending' && <button className="ac-btn sm" onClick={() => open(p, 'revision')}>Yêu cầu sửa</button>}
                  {p.status !== 'rejected' && p.status !== 'approved' && <button className="ac-btn sm bad" onClick={() => open(p, 'rejected')}>Từ chối</button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!target} onClose={() => setTarget(null)} title={target ? `${STATUS[target.decision].label} giáo án` : ''}
        footer={<><button className="ac-btn" onClick={() => setTarget(null)}>Hủy</button><button className={`ac-btn ${target?.decision === 'rejected' ? 'bad' : 'primary'}`} disabled={busy} onClick={submit}>{busy ? 'Đang gửi…' : 'Xác nhận'}</button></>}>
        {target && <>
          <p><b>{target.plan.title}</b><br /><span className="ac-muted ac-small">{target.plan.teacher} · {target.plan.subject}</span></p>
          <Field label={target.decision === 'approved' ? 'Nhận xét (không bắt buộc)' : 'Nhận xét gửi giáo viên (bắt buộc)'}>
            <textarea className="ac-textarea" value={note} onChange={(e) => { setNote(e.target.value); setErr(''); }} placeholder="Ví dụ: Bổ sung hoạt động vận dụng và phân hóa học sinh…" />
          </Field>
          {err && <div className="ac-alert tone-bad"><Icon name="alert" /><div>{err}</div></div>}
        </>}
      </Modal>
    </>
  );
}
