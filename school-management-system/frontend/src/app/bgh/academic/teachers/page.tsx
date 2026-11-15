'use client';

import { useEffect, useMemo, useState } from 'react';
import { Avatar, Badge, Card, Drawer, Empty, ErrorBox, Field, Icon, Kpi, Modal, PageHeader, Seg, Skeleton, useToast } from '@/components/bgh-academic/ui';
import { useAcademic } from '@/components/bgh-academic/Shell';
import { TimetableMini } from '@/components/bgh-academic/TimetableMini';
import { TeacherRow, apiSend, errMsg, fixed, fmtDate, num, useApi } from '@/lib/bgh-academic';

export default function TeachersPage() {
  const { yearId } = useAcademic();
  const res = useApi<{ quota: number; items: TeacherRow[] }>('/teachers', { year_id: yearId });
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const [view, setView] = useState<'all' | 'over' | 'home'>('all');
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get('open'));
    if (id) setOpenId(id);
  }, []);

  const quota = res.data?.quota || 17;
  const items = res.data?.items || [];
  const groups = useMemo(() => Array.from(new Map(items.filter((t) => t.group_id).map((t) => [String(t.group_id), t.group_name as string])).entries()), [items]);
  const rows = items.filter((t) =>
    (!q.trim() || t.full_name.toLowerCase().includes(q.toLowerCase()) || t.code.toLowerCase().includes(q.toLowerCase())) &&
    (group === 'all' || String(t.group_id) === group) &&
    (view === 'all' || (view === 'over' ? num(t.periods_per_week) > quota : !!t.homeroom_class)));
  const over = items.filter((t) => num(t.periods_per_week) > quota).length;
  const avgPeriods = items.length ? items.reduce((s, t) => s + num(t.periods_per_week), 0) / items.length : 0;

  return (
    <>
      <PageHeader title="Giáo viên & phân công giảng dạy" desc={`Theo dõi tải giảng dạy (định mức ${quota} tiết/tuần), hồ sơ chuyên môn và điều chỉnh phân công.`} />
      <div className="ac-grid ac-g4" style={{ marginBottom: 16 }}>
        <Kpi icon="users" tone="primary" label="Tổng giáo viên" value={items.length} />
        <Kpi icon="clock" tone="info" label="Trung bình tiết/tuần" value={fixed(avgPeriods)} />
        <Kpi icon="alert" tone={over ? 'bad' : 'ok'} label="Vượt định mức" value={over} sub={<span className="ac-muted">&gt; {quota} tiết/tuần</span>} />
        <Kpi icon="award" tone="ok" label="Giáo viên chủ nhiệm" value={items.filter((t) => t.homeroom_class).length} />
      </div>

      <div className="ac-row ac-wrap" style={{ marginBottom: 16 }}>
        <input className="ac-input" style={{ maxWidth: 320 }} placeholder="Tìm tên hoặc mã giáo viên…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="ac-select inline" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Tổ chuyên môn">
          <option value="all">Tất cả tổ chuyên môn</option>{groups.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <Seg value={view} onChange={setView} options={[{ value: 'all', label: 'Tất cả' }, { value: 'over', label: 'Vượt định mức', count: over }, { value: 'home', label: 'Chủ nhiệm' }]} />
        <span className="ac-muted ac-small ac-right">{rows.length} giáo viên</span>
      </div>

      {res.error ? <ErrorBox error={res.error} onRetry={res.reload} /> : res.loading && !res.data ? <Skeleton h={56} n={8} /> : rows.length === 0 ? <Empty title="Không có giáo viên phù hợp" /> : (
        <Card flush>
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead><tr><th>Giáo viên</th><th>Môn chính</th><th>Tổ</th><th>Lớp dạy</th><th style={{ minWidth: 180 }}>Tiết / tuần</th><th>Chủ nhiệm</th><th>Điểm TB</th><th>Dự giờ</th></tr></thead>
              <tbody>
                {rows.map((t) => {
                  const p = num(t.periods_per_week);
                  const bad = p > quota;
                  return (
                    <tr key={t.id} className="click" onClick={() => setOpenId(t.id)}>
                      <td><div className="ac-row"><Avatar name={t.full_name} /><div><div className="ac-b">{t.full_name}</div><div className="ac-small ac-muted">{t.code}</div></div></div></td>
                      <td>{t.main_subject}</td>
                      <td>{t.group_name ? <Badge tone="muted"><i style={{ width: 8, height: 8, borderRadius: 4, background: t.group_color || '#999', display: 'inline-block' }} />{t.group_name.replace('Tổ ', '')}</Badge> : '–'}</td>
                      <td className="ac-num">{t.class_count}</td>
                      <td>
                        <div className="ac-row"><b className="ac-num" style={{ width: 24, color: bad ? 'var(--bad-text)' : undefined }}>{p}</b>
                          <div className="ac-bar" style={{ flex: 1 }}><i style={{ width: `${Math.min(100, (p / (quota + 3)) * 100)}%`, background: bad ? 'var(--bad)' : p >= quota - 2 ? 'var(--warn)' : 'var(--ok)' }} /></div>
                          {bad && <Badge tone="bad">+{p - quota}</Badge>}</div>
                      </td>
                      <td>{t.homeroom_class ? <Badge tone="primary">{t.homeroom_class}</Badge> : <span className="ac-muted">–</span>}</td>
                      <td className="ac-b ac-num">{fixed(t.avg_score, 2)}</td>
                      <td>{t.obs_score ? <Badge tone={num(t.obs_score) >= 8 ? 'ok' : 'info'}>{fixed(t.obs_score)}</Badge> : <span className="ac-muted">–</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {openId && <TeacherDrawer id={openId} onClose={() => setOpenId(null)} onChanged={res.reload} />}
    </>
  );
}

function TeacherDrawer({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const { yearId } = useAcademic();
  const d = useApi<any>(`/teachers/${id}`, { year_id: yearId });
  const [change, setChange] = useState<any | null>(null);
  const statusTone: Record<string, string> = { pending: 'warn', approved: 'ok', rejected: 'bad', revision: 'info' };
  const statusLabel: Record<string, string> = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', revision: 'Cần chỉnh sửa' };
  const t = d.data?.teacher;
  return (
    <Drawer open onClose={onClose} title={t?.full_name || 'Hồ sơ giáo viên'} subtitle={t ? `${t.code} · ${t.main_subject}` : undefined}>
      {d.error ? <ErrorBox error={d.error} onRetry={d.reload} /> : !d.data ? <Skeleton h={110} n={4} /> : (
        <div className="ac-grid" style={{ gap: 20 }}>
          <Card title={`Phân công giảng dạy (${d.data.assignments.length} lớp)`} flush>
            <div className="ac-table-wrap"><table className="ac-table"><thead><tr><th>Lớp</th><th>Môn</th><th>Tiết/tuần</th><th /></tr></thead>
              <tbody>{d.data.assignments.map((a: any) => (
                <tr key={a.id}><td className="ac-b">{a.class_name}</td><td>{a.subject}</td><td className="ac-num">{a.periods}</td>
                  <td style={{ textAlign: 'right' }}><button className="ac-btn sm" onClick={() => setChange(a)}><Icon name="swap" size={14} /> Đổi GV</button></td></tr>
              ))}</tbody></table></div>
          </Card>
          <Card title="Lịch dạy trong tuần"><TimetableMini slots={d.data.schedule} /></Card>
          <div className="ac-grid ac-g2">
            <Card title="Giáo án gần đây">
              {d.data.lesson_plans.length === 0 ? <Empty title="Chưa có giáo án" /> : d.data.lesson_plans.map((p: any) => (
                <div key={p.id} className="ac-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}><div style={{ flex: 1 }} className="ac-small ac-b">{p.title}</div><Badge tone={statusTone[p.status]}>{statusLabel[p.status]}</Badge></div>
              ))}
            </Card>
            <Card title="Dự giờ gần đây">
              {d.data.observations.length === 0 ? <Empty title="Chưa có dự giờ" /> : d.data.observations.map((o: any) => (
                <div key={o.id} className="ac-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}><div style={{ flex: 1 }}><div className="ac-small ac-b">{o.lesson_title}</div><div className="ac-small ac-muted">Lớp {o.class_name} · {fmtDate(o.observed_on)}</div></div><Badge tone={num(o.score) >= 8 ? 'ok' : 'info'}>{fixed(o.score)}</Badge></div>
              ))}
            </Card>
          </div>
        </div>
      )}
      {change && <ReassignModal assignment={change} currentTeacherId={id} onClose={() => setChange(null)} onDone={() => { setChange(null); d.reload(); onChanged(); }} />}
    </Drawer>
  );
}

function ReassignModal({ assignment, currentTeacherId, onClose, onDone }: { assignment: any; currentTeacherId: number; onClose: () => void; onDone: () => void }) {
  const { meta, reloadOverview } = useAcademic();
  const toast = useToast();
  const sameSubject = meta.teachers.filter((t) => t.id !== currentTeacherId && t.main_subject_id === assignment.subject_id);
  const others = meta.teachers.filter((t) => t.id !== currentTeacherId && t.main_subject_id !== assignment.subject_id);
  const [teacherId, setTeacherId] = useState<number>(sameSubject[0]?.id || 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try {
      const r = await apiSend<any>('put', `/assignments/${assignment.id}`, { teacher_id: teacherId });
      toast.success('Đã đổi giáo viên phụ trách', `${r.data.subject} lớp ${r.data.class_name}: ${r.data.from} → ${r.data.to}`);
      reloadOverview(); onDone();
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Đổi giáo viên – ${assignment.subject} lớp ${assignment.class_name}`}
      footer={<><button className="ac-btn" onClick={onClose}>Hủy</button><button className="ac-btn primary" disabled={busy || !teacherId} onClick={save}>{busy ? 'Đang kiểm tra…' : 'Xác nhận đổi'}</button></>}>
      <Field label="Giáo viên mới">
        <select className="ac-select" value={teacherId} onChange={(e) => { setTeacherId(Number(e.target.value)); setErr(''); }}>
          <optgroup label="Cùng chuyên môn">{sameSubject.map((t) => <option key={t.id} value={t.id}>{t.full_name} ({t.code})</option>)}</optgroup>
          <optgroup label="Môn khác">{others.map((t) => <option key={t.id} value={t.id}>{t.full_name} ({t.code})</option>)}</optgroup>
        </select>
      </Field>
      {err && <div className="ac-alert tone-bad"><Icon name="alert" /><div><b>Không thể đổi</b><div>{err}</div></div></div>}
      <p className="ac-small ac-muted">Hệ thống tự kiểm tra giáo viên mới có bị trùng tiết với lớp khác hay không trước khi lưu.</p>
    </Modal>
  );
}
