'use client';

import { useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Field, Icon, Modal, PageHeader, Seg, Skeleton, useToast } from '@/components/bgh-academic/ui';
import { useAcademic } from '@/components/bgh-academic/Shell';
import { apiSend, errMsg, timeAgo, useApi } from '@/lib/bgh-academic';

const TYPES: Record<string, { label: string; icon: string; tone: string }> = {
  assignment_change: { label: 'Đổi phân công', icon: 'swap', tone: 'primary' }, timetable: { label: 'Thời khóa biểu', icon: 'calendar', tone: 'info' },
  exam_schedule: { label: 'Lịch thi', icon: 'exam', tone: 'warn' }, grade_edit: { label: 'Sửa điểm', icon: 'edit', tone: 'bad' }, other: { label: 'Khác', icon: 'info', tone: 'muted' },
};
const PRIORITY: Record<string, { label: string; tone: string }> = { high: { label: 'Ưu tiên cao', tone: 'bad' }, normal: { label: 'Bình thường', tone: 'muted' }, low: { label: 'Thấp', tone: 'muted' } };

export default function ApprovalsPage() {
  const { reloadOverview } = useAcademic();
  const toast = useToast();
  const [tab, setTab] = useState<string>('pending');
  const res = useApi<{ items: any[]; counts: Record<string, number> }>('/requests', {});
  const [target, setTarget] = useState<{ req: any; decision: 'approved' | 'rejected' } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const counts = res.data?.counts || { pending: 0, approved: 0, rejected: 0 };
  const items = (res.data?.items || []).filter((r) => tab === 'all' || r.status === tab);

  const submit = async () => {
    if (!target) return;
    if (target.decision === 'rejected' && !note.trim()) { setErr('Vui lòng nhập lý do từ chối.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await apiSend<{ applied: any }>('post', `/requests/${target.req.id}/decide`, { decision: target.decision, note: note.trim() || null });
      if (target.decision === 'approved') {
        const a = r.data?.applied;
        toast.success('Đã phê duyệt đề xuất', a ? `Đã áp dụng: ${a.subject} lớp ${a.class_name} – ${a.from} → ${a.to}` : target.req.title);
      } else toast.info('Đã từ chối đề xuất', target.req.title);
      setTarget(null); res.reload(); reloadOverview();
    } catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Phê duyệt đề xuất" desc="Quyết định các đề xuất từ tổ chuyên môn, giáo vụ và đoàn thể. Đề xuất đổi giáo viên sẽ được áp dụng tự động khi duyệt.">
        <Seg value={tab} onChange={setTab} options={[{ value: 'pending', label: 'Chờ duyệt', count: counts.pending }, { value: 'approved', label: 'Đã duyệt' }, { value: 'rejected', label: 'Đã từ chối' }, { value: 'all', label: 'Tất cả' }]} />
      </PageHeader>

      {res.error ? <ErrorBox error={res.error} onRetry={res.reload} /> : res.loading && !res.data ? <Skeleton h={100} n={4} /> : items.length === 0 ? <Empty icon="check" title="Không có đề xuất trong mục này" /> : (
        <div className="ac-grid" style={{ gap: 14 }}>
          {items.map((r) => {
            const t = TYPES[r.type] || TYPES.other;
            return (
              <Card key={r.id}>
                <div className="ac-row" style={{ alignItems: 'flex-start' }}>
                  <div className={`ac-avatar tone-${t.tone}`} style={{ width: 44, height: 44 }}><Icon name={t.icon} size={20} /></div>
                  <div style={{ flex: 1 }}>
                    <div className="ac-row ac-wrap"><b style={{ fontSize: 15 }}>{r.title}</b><Badge tone={t.tone}>{t.label}</Badge>
                      {r.priority === 'high' && <Badge tone="bad">{PRIORITY.high.label}</Badge>}
                      {r.auto_apply && <Badge tone="ok"><Icon name="check" size={12} /> Tự động áp dụng khi duyệt</Badge>}</div>
                    <p className="ac-muted" style={{ margin: '6px 0 0' }}>{r.detail}</p>
                    <div className="ac-small ac-muted" style={{ marginTop: 8 }}>Đề xuất bởi {r.requested_by} · {timeAgo(r.created_at)}</div>
                    {r.status !== 'pending' && <div className={`ac-alert tone-${r.status === 'approved' ? 'ok' : 'bad'}`} style={{ marginTop: 10 }}><Icon name={r.status === 'approved' ? 'check' : 'x'} size={16} />
                      <div><b>{r.status === 'approved' ? 'Đã phê duyệt' : 'Đã từ chối'}</b> bởi {r.decided_by_name} · {timeAgo(r.decided_at)}{r.decision_note ? ` — ${r.decision_note}` : ''}</div></div>}
                  </div>
                  {r.status === 'pending' && (
                    <div className="ac-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                      <button className="ac-btn ok sm" onClick={() => { setTarget({ req: r, decision: 'approved' }); setNote(''); setErr(''); }}><Icon name="check" size={14} /> Phê duyệt</button>
                      <button className="ac-btn bad sm" onClick={() => { setTarget({ req: r, decision: 'rejected' }); setNote(''); setErr(''); }}>Từ chối</button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!target} onClose={() => setTarget(null)} title={target?.decision === 'approved' ? 'Phê duyệt đề xuất' : 'Từ chối đề xuất'}
        footer={<><button className="ac-btn" onClick={() => setTarget(null)}>Hủy</button><button className={`ac-btn ${target?.decision === 'approved' ? 'ok' : 'bad'}`} disabled={busy} onClick={submit}>{busy ? 'Đang xử lý…' : 'Xác nhận'}</button></>}>
        {target && <>
          <p><b>{target.req.title}</b></p>
          {target.decision === 'approved' && target.req.auto_apply && <div className="ac-alert tone-info" style={{ marginBottom: 12 }}><Icon name="info" /><div>Khi phê duyệt, hệ thống sẽ đổi giáo viên phụ trách ngay (sau khi kiểm tra trùng lịch).</div></div>}
          <Field label={target.decision === 'approved' ? 'Ghi chú (không bắt buộc)' : 'Lý do từ chối (bắt buộc)'}>
            <textarea className="ac-textarea" value={note} onChange={(e) => { setNote(e.target.value); setErr(''); }} />
          </Field>
          {err && <div className="ac-alert tone-bad"><Icon name="alert" /><div>{err}</div></div>}
        </>}
      </Modal>
    </>
  );
}
