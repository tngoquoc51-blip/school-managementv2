'use client';

import { CSSProperties, useEffect, useState } from 'react';
import { Avatar, Badge, Card, Empty, ErrorBox, Icon, Modal, PageHeader, Seg, Skeleton, useToast } from '@/components/bgh-academic/ui';
import { useAcademic } from '@/components/bgh-academic/Shell';
import { WEEKDAYS, apiSend, errMsg, hueOf, useApi } from '@/lib/bgh-academic';

type Pos = { weekday: number; period: number };
const DAYS = [2, 3, 4, 5, 6, 7];
const PERIODS = [1, 2, 3, 4, 5];

export default function TimetablePage() {
  const { yearId, meta, reloadOverview } = useAcademic();
  const toast = useToast();
  const classes = meta.classes.filter((c) => c.school_year_id === yearId);
  const [mode, setMode] = useState<'class' | 'teacher'>('class');
  const [classId, setClassId] = useState<number | null>(null);
  const [teacherId, setTeacherId] = useState<number>(meta.teachers[0]?.id || 0);
  const [swapMode, setSwapMode] = useState(false);
  const [first, setFirst] = useState<Pos | null>(null);
  const [confirm, setConfirm] = useState<{ a: Pos; b: Pos } | null>(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);

  // Chọn lớp mặc định (ưu tiên ?class= từ tìm kiếm nhanh), đổi khi đổi năm học
  useEffect(() => {
    const want = Number(new URLSearchParams(window.location.search).get('class'));
    const ok = classes.find((c) => c.id === want) || classes[0];
    setClassId(ok ? ok.id : null);
    setFirst(null); setDetail(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearId]);

  const grid = useApi<any>(mode === 'class' && classId ? '/timetable' : null, { class_id: classId });
  const tdata = useApi<any>(mode === 'teacher' && teacherId ? `/teachers/${teacherId}` : null, { year_id: yearId });
  const conflicts = useApi<any[]>('/timetable/conflicts', { year_id: yearId });

  const slotMap = new Map<string, any>((grid.data?.slots || []).map((s: any) => [`${s.weekday}-${s.period}`, s]));
  const tMap = new Map<string, any>((tdata.data?.schedule || []).map((s: any) => [`${s.weekday}-${s.period}`, s]));
  const periods: any[] = grid.data?.periods || meta.periods;
  const hhmm = (t: string) => t?.slice(0, 5);

  const clickCell = (weekday: number, period: number) => {
    const s = slotMap.get(`${weekday}-${period}`);
    if (!swapMode) { setDetail(s ? { ...s, weekday, period } : null); return; }
    if (!first) { setFirst({ weekday, period }); return; }
    if (first.weekday === weekday && first.period === period) { setFirst(null); return; }
    setConfirm({ a: first, b: { weekday, period } });
  };
  const doSwap = async () => {
    if (!confirm || !classId) return;
    setBusy(true);
    try {
      const r = await apiSend<any>('post', '/timetable/swap', { class_id: classId, a: confirm.a, b: confirm.b });
      toast.success('Đã hoán đổi tiết học', 'Thời khóa biểu đã được cập nhật.');
      grid.setData(r.data); setConfirm(null); setFirst(null); conflicts.reload(); reloadOverview();
    } catch (e) { toast.error('Không thể hoán đổi', errMsg(e)); setConfirm(null); setFirst(null); }
    finally { setBusy(false); }
  };
  const lessonOf = (p: Pos) => slotMap.get(`${p.weekday}-${p.period}`);

  const cellStyle = (code: string): CSSProperties => ({ ['--h' as any]: hueOf(code) });

  return (
    <>
      <PageHeader title="Thời khóa biểu" desc="Xem theo lớp hoặc giáo viên, phát hiện trùng tiết và hoán đổi tiết có kiểm tra xung đột tự động.">
        <Seg value={mode} onChange={(m) => { setMode(m); setSwapMode(false); setFirst(null); }} options={[{ value: 'class', label: 'Theo lớp' }, { value: 'teacher', label: 'Theo giáo viên' }]} />
        {mode === 'class' && (
          <button className={`ac-btn ${swapMode ? 'primary' : ''}`} onClick={() => { setSwapMode(!swapMode); setFirst(null); setDetail(null); }}>
            <Icon name="swap" size={16} /> {swapMode ? 'Đang ở chế độ hoán đổi' : 'Hoán đổi tiết'}
          </button>
        )}
      </PageHeader>

      <div className="ac-grid ac-g-8-4">
        <div className="ac-grid" style={{ gap: 16 }}>
          <Card>
            <div className="ac-row ac-wrap" style={{ marginBottom: 14 }}>
              {mode === 'class' ? (
                <>
                  {[10, 11, 12].map((g) => {
                    const cs = classes.filter((c) => c.grade === g);
                    if (!cs.length) return null;
                    return <div key={g} className="ac-row" style={{ gap: 6 }}><span className="ac-small ac-muted ac-b">K{g}</span>
                      {cs.map((c) => <button key={c.id} className={`ac-btn sm ${classId === c.id ? 'primary' : ''}`} onClick={() => { setClassId(c.id); setFirst(null); setDetail(null); }}>{c.name}</button>)}</div>;
                  })}
                </>
              ) : (
                <select className="ac-select" style={{ maxWidth: 360 }} value={teacherId} onChange={(e) => setTeacherId(Number(e.target.value))} aria-label="Giáo viên">
                  {meta.teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name} ({t.code})</option>)}
                </select>
              )}
            </div>

            {swapMode && (
              <div className="ac-alert tone-info" style={{ marginBottom: 14 }}><Icon name="info" />
                <div>{first ? <>Đã chọn <b>{WEEKDAYS[first.weekday]} – tiết {first.period}</b>. Chọn tiết thứ hai để hoán đổi.</> : 'Chọn tiết thứ nhất cần hoán đổi.'}</div></div>
            )}

            {(mode === 'class' ? grid.error : tdata.error)
              ? <ErrorBox error={mode === 'class' ? grid.error : tdata.error} onRetry={mode === 'class' ? grid.reload : tdata.reload} />
              : (mode === 'class' ? grid.loading && !grid.data : tdata.loading && !tdata.data) ? <Skeleton h={80} n={5} />
              : mode === 'class' && grid.data && grid.data.slots.length === 0 ? <Empty icon="calendar" title="Lớp này chưa có thời khóa biểu" hint="Chọn lớp của năm học hiện tại để xem lịch." />
              : (
                <div style={{ overflowX: 'auto' }}>
                  <div className="ac-tt">
                    <div />
                    {DAYS.map((d) => <div key={d} className="hd">{WEEKDAYS[d]}</div>)}
                    {PERIODS.map((p) => {
                      const pt = periods.find((x: any) => x.id === p);
                      return (
                        <div key={p} style={{ display: 'contents' }}>
                          <div className="pd"><b>Tiết {p}</b>{pt && <span>{hhmm(pt.start_time)}–{hhmm(pt.end_time)}</span>}</div>
                          {DAYS.map((d) => {
                            if (mode === 'class') {
                              const s = slotMap.get(`${d}-${p}`);
                              const isSel = first?.weekday === d && first?.period === p;
                              return s ? (
                                <button key={d} className={`ac-cell ${isSel ? 'sel' : ''} ${s.conflict ? 'bad' : ''}`} style={cellStyle(s.code)} onClick={() => clickCell(d, p)} title={`${s.subject} – ${s.teacher}`}>
                                  <b>{s.subject}</b><small>{s.teacher}</small>{s.conflict && <Badge tone="bad">Trùng tiết</Badge>}
                                </button>
                              ) : <button key={d} className="ac-cell empty" onClick={() => clickCell(d, p)}>Trống</button>;
                            }
                            const s = tMap.get(`${d}-${p}`);
                            return s ? (
                              <div key={d} className="ac-cell" style={cellStyle(s.code)}><b>Lớp {s.class_name}</b><small>{s.subject}</small></div>
                            ) : <div key={d} className="ac-cell empty" style={{ cursor: 'default' }}>Trống</div>;
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          </Card>
        </div>

        <div className="ac-grid" style={{ gap: 16, alignContent: 'start' }}>
          <Card title="Kiểm tra xung đột">
            {conflicts.loading && !conflicts.data ? <Skeleton h={60} /> : (conflicts.data || []).length === 0
              ? <div className="ac-alert tone-ok"><Icon name="check" /><div><b>Không có xung đột</b><div>Không giáo viên nào bị xếp trùng tiết.</div></div></div>
              : (conflicts.data || []).map((c: any, i: number) => (
                <div key={i} className="ac-alert tone-bad" style={{ marginBottom: 8 }}><Icon name="alert" /><div><b>{c.teacher}</b><div>{WEEKDAYS[c.weekday]} tiết {c.period}: {c.classes}</div></div></div>
              ))}
          </Card>
          {mode === 'class' && !swapMode && (
            <Card title="Chi tiết tiết học">
              {!detail ? <Empty icon="calendar" title="Chọn một ô trong lịch" hint="Xem môn, giáo viên và vị trí tiết học." /> : (
                <div className="ac-grid" style={{ gap: 12 }}>
                  <div className="ac-row"><Avatar name={detail.teacher} /><div><div className="ac-b">{detail.teacher}</div><div className="ac-small ac-muted">Giáo viên phụ trách</div></div></div>
                  <div><div className="ac-small ac-muted">Môn học</div><div className="ac-b">{detail.subject}</div></div>
                  <div><div className="ac-small ac-muted">Thời gian</div><div className="ac-b">{WEEKDAYS[detail.weekday]} · tiết {detail.period}</div></div>
                  {detail.conflict && <Badge tone="bad">Giáo viên đang bị trùng tiết</Badge>}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Xác nhận hoán đổi tiết học"
        footer={<><button className="ac-btn" onClick={() => setConfirm(null)}>Hủy</button><button className="ac-btn primary" disabled={busy} onClick={doSwap}>{busy ? 'Đang kiểm tra…' : 'Hoán đổi'}</button></>}>
        {confirm && (
          <div className="ac-grid ac-g2" style={{ alignItems: 'center' }}>
            {[confirm.a, confirm.b].map((p, i) => { const l = lessonOf(p); return (
              <div key={i} className="ac-card ac-card-b" style={{ boxShadow: 'none' }}>
                <div className="ac-small ac-muted">{WEEKDAYS[p.weekday]} · tiết {p.period}</div>
                <div className="ac-b">{l ? l.subject : 'Trống'}</div><div className="ac-small ac-muted">{l?.teacher}</div>
              </div>); })}
          </div>
        )}
        <p className="ac-small ac-muted" style={{ marginTop: 14 }}>Hệ thống sẽ từ chối nếu việc hoán đổi khiến giáo viên bị trùng tiết với lớp khác.</p>
      </Modal>
    </>
  );
}
