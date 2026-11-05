'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../ui/Icons';
import { ConfirmDialog } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { classService, getErrorMessage } from '../../services/classService';
import type { SchoolClass, Student } from '../../types/classes';
import { AddStudentsModal, TransferModal } from './StudentModals';
import { fmtDate } from './shared';

const CONDUCT_CLS: Record<string, string> = { 'Tốt': 'ok', 'Khá': 'info', 'Đạt': 'warn', 'Chưa đạt': 'dng' };

export function StudentsTab({ cls, onChanged }: { cls: SchoolClass; onChanged: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<Student[] | null>(null);
  const [q, setQ] = useState('');
  const [gender, setGender] = useState('');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [removing, setRemoving] = useState<Student | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    classService.students(cls.id).then(setRows).catch((e) => { setRows([]); toast.error('Không tải được học sinh', getErrorMessage(e)); });
  }, [cls.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (rows ?? []).filter((s) =>
    (!gender || s.gender === gender) &&
    (!q || s.full_name.toLowerCase().includes(q.toLowerCase()) || s.code.toLowerCase().includes(q.toLowerCase()))), [rows, q, gender]);

  const allSel = filtered.length > 0 && filtered.every((s) => sel.has(s.id));
  const toggleAll = () => setSel(allSel ? new Set() : new Set(filtered.map((s) => s.id)));
  const toggle = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const done = () => { setSel(new Set()); load(); onChanged(); };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await classService.removeStudent(cls.id, removing.id);
      toast.success('Đã xóa học sinh khỏi lớp', removing.full_name);
      setRemoving(null); done();
    } catch (e) { toast.error('Không thể xóa khỏi lớp', getErrorMessage(e)); setRemoving(null); } finally { setBusy(false); }
  };

  return (
    <div className="a-card">
      <div className="a-toolbar" style={{ margin: 0 }}>
        <div className="a-search"><Icon name="search" size={16} />
          <input className="a-input" placeholder="Tìm theo tên hoặc mã học sinh…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="a-select" style={{ width: 130 }} value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">Giới tính</option><option>Nam</option><option>Nữ</option></select>
        {sel.size > 0 && <button className="a-btn" onClick={() => setMoveOpen(true)}><Icon name="swap" size={16} /> Chuyển lớp ({sel.size})</button>}
        <button className="a-btn pri" onClick={() => setAddOpen(true)} disabled={cls.student_count >= cls.capacity}><Icon name="plus" size={16} /> Thêm học sinh</button>
      </div>
      <div className="a-table-wrap">
        <table className="a-table">
          <thead><tr>
            <th style={{ width: 40 }}><input type="checkbox" className="a-check" checked={allSel} onChange={toggleAll} aria-label="Chọn tất cả" /></th>
            <th>STT</th><th>Mã HS</th><th>Họ và tên</th><th>Giới tính</th><th>Ngày sinh</th><th>Hạnh kiểm</th><th />
          </tr></thead>
          <tbody>
            {rows === null ? Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={8}><div className="a-skel" style={{ height: 24 }} /></td></tr>)
              : filtered.length === 0 ? <tr><td colSpan={8}><div className="a-empty">Chưa có học sinh nào trong lớp.</div></td></tr>
              : filtered.map((s, i) => (
                <tr key={s.id}>
                  <td><input type="checkbox" className="a-check" checked={sel.has(s.id)} onChange={() => toggle(s.id)} /></td>
                  <td className="a-muted">{i + 1}</td><td>{s.code}</td>
                  <td><div className="a-row"><div className="a-ava" style={{ width: 32, height: 32, color: '#fff', fontSize: 12 }}>{s.full_name.trim().split(' ').pop()?.[0]}</div><b>{s.full_name}</b></div></td>
                  <td><span className={`a-badge ${s.gender === 'Nam' ? 'info' : 'pri'}`}>{s.gender}</span></td>
                  <td>{fmtDate(s.birth_date)}</td>
                  <td>{s.conduct ? <span className={`a-badge ${CONDUCT_CLS[s.conduct] ?? 'mut'}`}>{s.conduct}</span> : <span className="a-muted">—</span>}</td>
                  <td><button className="a-icon-btn" title="Xóa khỏi lớp" style={{ color: 'var(--danger)' }} onClick={() => setRemoving(s)}><Icon name="trash" size={16} /></button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <AddStudentsModal open={addOpen} onClose={() => setAddOpen(false)} cls={cls} onDone={done} />
      <TransferModal open={moveOpen} onClose={() => setMoveOpen(false)} cls={cls} studentIds={[...sel]} onDone={done} />
      <ConfirmDialog open={!!removing} danger loading={busy} title="Xóa học sinh khỏi lớp?" confirmText="Xóa khỏi lớp"
        message={<><b>{removing?.full_name}</b> sẽ không còn thuộc lớp {cls.name}. Học sinh đã có điểm sẽ không thể xóa, hãy dùng chức năng chuyển lớp.</>}
        onConfirm={remove} onClose={() => setRemoving(null)} />
    </div>
  );
}
