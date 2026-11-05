'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { useDebounce } from '../ui/useDebounce';
import { classService, getErrorMessage } from '../../services/classService';
import type { SchoolClass, Student } from '../../types/classes';
import { fmtDate } from './shared';

/* ---------- Thêm học sinh vào lớp ---------- */
export function AddStudentsModal({ open, onClose, cls, onDone }: {
  open: boolean; onClose: () => void; cls: SchoolClass; onDone: () => void;
}) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [list, setList] = useState<Student[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const remaining = cls.capacity - cls.student_count;

  useEffect(() => { if (open) { setSel(new Set()); setQ(''); } }, [open]);
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    classService.availableStudents(cls.id, dq).then(setList).catch((e) => toast.error('Không tải được danh sách', getErrorMessage(e))).finally(() => setLoading(false));
  }, [open, dq, cls.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: number) => setSel((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else if (n.size >= remaining) toast.warning('Đã đạt sĩ số tối đa', `Lớp chỉ còn ${remaining} chỗ trống.`);
    else n.add(id);
    return n;
  });

  const submit = async () => {
    setBusy(true);
    try {
      const r = await classService.addStudents(cls.id, [...sel]);
      toast.success(`Đã thêm ${r.added} học sinh`, `Vào lớp ${cls.name}`);
      onDone(); onClose();
    } catch (e) { toast.error('Không thể thêm học sinh', getErrorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title={`Thêm học sinh vào lớp ${cls.name}`}
           subtitle={`Học sinh chưa xếp lớp trong năm học ${cls.school_year_label} · còn ${remaining} chỗ trống`} footer={
      <><span className="a-muted a-sp" style={{ alignSelf: 'center' }}>Đã chọn {sel.size}</span>
        <button className="a-btn" onClick={onClose}>Hủy</button>
        <button className="a-btn pri" onClick={submit} disabled={busy || sel.size === 0}>{busy && <span className="a-spin" />} Thêm vào lớp</button></>
    }>
      <input className="a-input" style={{ margin: '8px 0 12px' }} placeholder="Tìm theo tên hoặc mã học sinh…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div style={{ display: 'grid', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
        {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="a-skel" style={{ height: 52 }} />)
          : list.length === 0 ? <div className="a-empty">Không còn học sinh nào chưa xếp lớp phù hợp.</div>
          : list.map((s) => (
            <label key={s.id} className={`a-sel-row ${sel.has(s.id) ? 'on' : ''}`}>
              <input type="checkbox" className="a-check" checked={sel.has(s.id)} onChange={() => toggle(s.id)} />
              <div className="a-ava" style={{ width: 34, height: 34, color: '#fff' }}>{s.full_name.trim().split(' ').pop()?.[0]}</div>
              <div style={{ flex: 1 }}><b>{s.full_name}</b><div className="a-muted" style={{ fontSize: 12 }}>{s.code} · {fmtDate(s.birth_date)}</div></div>
              <span className={`a-badge ${s.gender === 'Nam' ? 'info' : 'pri'}`}>{s.gender}</span>
            </label>
          ))}
      </div>
    </Modal>
  );
}

/* ---------- Chuyển lớp ---------- */
export function TransferModal({ open, onClose, cls, studentIds, onDone }: {
  open: boolean; onClose: () => void; cls: SchoolClass; studentIds: number[]; onDone: () => void;
}) {
  const toast = useToast();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [target, setTarget] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTarget('');
    classService.list({ school_year_id: cls.school_year_id, per_page: 100 })
      .then((r) => setClasses(r.items.filter((c) => c.id !== cls.id && c.status === 'active')))
      .catch((e) => toast.error('Không tải được danh sách lớp', getErrorMessage(e)));
  }, [open, cls.id, cls.school_year_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const r = await classService.transfer(cls.id, studentIds, target);
      toast.success(`Đã chuyển ${r.moved} học sinh`, 'Điểm số của học sinh được chuyển theo lớp mới.');
      onDone(); onClose();
    } catch (e) { toast.error('Không thể chuyển lớp', getErrorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} size="sm" title="Chuyển lớp" subtitle={`${studentIds.length} học sinh từ lớp ${cls.name}`} footer={
      <><button className="a-btn" onClick={onClose}>Hủy</button>
        <button className="a-btn pri" onClick={submit} disabled={busy || !target}>{busy && <span className="a-spin" />} Chuyển lớp</button></>
    }>
      <div className="a-field" style={{ paddingTop: 8 }}>
        <label>Lớp đích</label>
        <select className="a-select" value={target} onChange={(e) => setTarget(e.target.value ? +e.target.value : '')}>
          <option value="">— Chọn lớp —</option>
          {classes.map((c) => {
            const left = c.capacity - c.student_count;
            return <option key={c.id} value={c.id} disabled={left < studentIds.length}>{c.name} · còn {left} chỗ</option>;
          })}
        </select>
        <span className="hint">Chỉ hiển thị lớp đang hoạt động cùng năm học và đủ chỗ trống.</span>
      </div>
    </Modal>
  );
}
