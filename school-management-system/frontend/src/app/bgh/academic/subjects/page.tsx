'use client';

import { useEffect, useState } from 'react';
import { Avatar, Badge, Card, Drawer, Empty, ErrorBox, Field, HBar, Icon, Modal, PageHeader, Seg, Skeleton, useToast } from '@/components/bgh-academic/ui';
import { useAcademic } from '@/components/bgh-academic/Shell';
import { apiSend, errMsg, fixed, num, useApi } from '@/lib/bgh-academic';

export default function SubjectsPage() {
  const { yearId, semester } = useAcademic();
  const [tab, setTab] = useState<'subjects' | 'groups'>('subjects');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [headFor, setHeadFor] = useState<any | null>(null);
  const subjects = useApi<any[]>('/subjects', { year_id: yearId, semester });
  const groups = useApi<any[]>('/groups', { year_id: yearId, semester });

  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get('open'));
    if (id) setOpenId(id);
  }, []);

  const list = (subjects.data || []).filter((s) => !q.trim() || s.name.toLowerCase().includes(q.toLowerCase()) || s.code.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title="Môn học & tổ chuyên môn" desc="Chất lượng từng môn, đội ngũ giảng dạy và tổ chuyên môn phụ trách.">
        <Seg value={tab} onChange={setTab} options={[{ value: 'subjects', label: 'Môn học' }, { value: 'groups', label: 'Tổ chuyên môn' }]} />
      </PageHeader>

      {tab === 'subjects' && (
        <>
          <div className="ac-row" style={{ marginBottom: 16, maxWidth: 420 }}>
            <input className="ac-input" placeholder="Tìm môn học…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {subjects.error ? <ErrorBox error={subjects.error} onRetry={subjects.reload} /> : subjects.loading && !subjects.data ? <Skeleton h={170} n={3} /> : list.length === 0 ? <Empty title="Không có môn học phù hợp" /> : (
            <div className="ac-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))' }}>
              {list.map((s) => {
                const color = s.group_color || '#2563eb';
                const avg = s.avg_score === null ? null : num(s.avg_score);
                return (
                  <button key={s.id} className="ac-card ac-tile" style={{ textAlign: 'left', font: 'inherit', color: 'inherit', background: 'var(--surface)' }} onClick={() => setOpenId(s.id)}>
                    <div className="ac-row">
                      <div className="ac-avatar" style={{ width: 42, height: 42, background: color, color: '#fff' }}>{s.code.slice(0, 2)}</div>
                      <div style={{ flex: 1 }}><h4>{s.name}</h4><div className="ac-small ac-muted">{s.group_name || 'Chưa thuộc tổ'}</div></div>
                      <Badge tone={s.kind === 'pass' ? 'info' : 'primary'}>{s.kind === 'pass' ? 'Nhận xét' : 'Tính điểm'}</Badge>
                    </div>
                    {avg !== null ? (
                      <>
                        <div className="ac-row" style={{ alignItems: 'baseline' }}><span style={{ fontSize: 26, fontWeight: 800 }}>{fixed(avg, 2)}</span><span className="ac-muted ac-small">điểm TB</span><span className="ac-right ac-b" style={{ color: 'var(--ok-text)' }}>{fixed(s.pass_rate)}% đạt</span></div>
                        <div className="ac-bar"><i style={{ width: `${avg * 10}%`, background: color }} /></div>
                      </>
                    ) : <div className="ac-small ac-muted" style={{ padding: '10px 0' }}>Môn đánh giá bằng nhận xét (Đạt/Chưa đạt)</div>}
                    <div className="ac-row ac-small ac-muted"><Icon name="users" size={14} /> {s.teacher_count} giáo viên <span>·</span> {s.class_count} lớp <span>·</span> {s.periods_per_week} tiết/tuần</div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'groups' && (groups.error ? <ErrorBox error={groups.error} onRetry={groups.reload} /> : groups.loading && !groups.data ? <Skeleton h={190} n={3} /> : (
        <div className="ac-grid ac-g3">
          {(groups.data || []).map((g) => (
            <section key={g.id} className="ac-card" style={{ borderTop: `4px solid ${g.color}` }}>
              <div className="ac-card-b">
                <div className="ac-row"><h3 style={{ margin: 0 }}>{g.name}</h3><span className="ac-right"><Badge tone="primary">{g.teacher_count} GV</Badge></span></div>
                <p className="ac-muted ac-small" style={{ margin: '6px 0 14px' }}>{g.subjects}</p>
                <div className="ac-row" style={{ padding: 12, borderRadius: 12, background: 'var(--surface-2)' }}>
                  {g.head_name ? <Avatar name={g.head_name} /> : <div className="ac-avatar tone-muted"><Icon name="users" size={16} /></div>}
                  <div style={{ flex: 1 }}><div className="ac-small ac-muted">Tổ trưởng</div><div className="ac-b">{g.head_name || 'Chưa bổ nhiệm'}</div></div>
                  <button className="ac-btn sm" onClick={() => setHeadFor(g)}><Icon name="edit" size={14} /> Đổi</button>
                </div>
                <div style={{ marginTop: 14 }}><HBar label="Điểm TB tổ" value={num(g.avg_score)} max={10} color={g.color} text={fixed(g.avg_score, 2)} /></div>
              </div>
            </section>
          ))}
        </div>
      ))}

      {openId && <SubjectDrawer id={openId} onClose={() => setOpenId(null)} />}
      {headFor && <HeadModal group={headFor} onClose={() => setHeadFor(null)} onSaved={() => { setHeadFor(null); groups.reload(); }} />}
    </>
  );
}

function SubjectDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const { yearId, semester } = useAcademic();
  const d = useApi<any>(`/subjects/${id}`, { year_id: yearId, semester });
  const maxH = Math.max(1, ...((d.data?.histogram || []).map((h: any) => h.n)));
  const colors = ['var(--bad)', 'var(--warn)', 'var(--info)', 'var(--ok)'];
  return (
    <Drawer open onClose={onClose} title={d.data?.subject?.name || 'Chi tiết môn học'} subtitle={d.data ? `Mã môn ${d.data.subject.code} · ${d.data.subject.periods_per_week} tiết/tuần` : undefined}>
      {d.error ? <ErrorBox error={d.error} onRetry={d.reload} /> : !d.data ? <Skeleton h={120} n={3} /> : (
        <div className="ac-grid" style={{ gap: 20 }}>
          <Card title="Phân bố điểm tổng kết">
            {d.data.histogram.map((h: any, i: number) => <HBar key={h.label} label={h.label} value={h.n} max={maxH} color={colors[i]} text={String(h.n)} />)}
          </Card>
          <Card title="Kết quả theo khối">
            {d.data.by_grade.length === 0 ? <Empty title="Chưa có điểm" /> : d.data.by_grade.map((g: any) => <HBar key={g.grade} label={`Khối ${g.grade}`} value={num(g.avg_score)} max={10} text={`${fixed(g.avg_score, 2)} · ${fixed(g.pass_rate)}%`} />)}
          </Card>
          <Card title={`Giáo viên giảng dạy (${d.data.teachers.length})`} flush>
            <div className="ac-table-wrap"><table className="ac-table"><thead><tr><th>Giáo viên</th><th>Số lớp</th><th>Lớp phụ trách</th><th>Điểm TB</th></tr></thead>
              <tbody>{d.data.teachers.map((t: any) => (
                <tr key={t.id}><td><div className="ac-row"><Avatar name={t.full_name} size={32} /><div><div className="ac-b">{t.full_name}</div><div className="ac-small ac-muted">{t.code}</div></div></div></td>
                  <td className="ac-num">{t.class_count}</td><td className="ac-small">{t.classes}</td><td className="ac-b ac-num">{fixed(t.avg_score, 2)}</td></tr>
              ))}</tbody></table></div>
          </Card>
        </div>
      )}
    </Drawer>
  );
}

function HeadModal({ group, onClose, onSaved }: { group: any; onClose: () => void; onSaved: () => void }) {
  const { meta, reloadOverview } = useAcademic();
  const toast = useToast();
  const ids = String(group.subject_ids || '').split(',').map(Number);
  const candidates = meta.teachers.filter((t) => ids.includes(t.main_subject_id));
  const [teacherId, setTeacherId] = useState<number>(group.head_teacher_id || candidates[0]?.id || 0);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { const r = await apiSend('put', `/groups/${group.id}/head`, { teacher_id: teacherId }); toast.success(r.message, group.name); reloadOverview(); onSaved(); }
    catch (e) { toast.error('Không thể cập nhật', errMsg(e)); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Đổi tổ trưởng – ${group.name}`}
      footer={<><button className="ac-btn" onClick={onClose}>Hủy</button><button className="ac-btn primary" disabled={busy || !teacherId} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button></>}>
      <Field label="Chọn giáo viên trong tổ">
        <select className="ac-select" value={teacherId} onChange={(e) => setTeacherId(Number(e.target.value))}>
          {candidates.map((t) => <option key={t.id} value={t.id}>{t.full_name} ({t.code})</option>)}
        </select>
      </Field>
      <p className="ac-small ac-muted">Hệ thống sẽ ghi nhật ký thao tác và gửi thông báo cho cán bộ liên quan.</p>
    </Modal>
  );
}
