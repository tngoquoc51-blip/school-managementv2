'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../components/ui/Icons';
import { ConfirmDialog } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { useDebounce } from '../components/ui/useDebounce';
import { ClassFormModal } from '../components/classes/ClassFormModal';
import { BulkCreateModal, CloneYearModal, HomeroomModal } from '../components/classes/ClassToolModals';
import { FillBar, StatusBadge } from '../components/classes/shared';
import { classService, getErrorMessage } from '../services/classService';
import type { ClassMeta, ClassStats, Paginated, SchoolClass } from '../types/classes';

type View = 'grid' | 'table';

export default function ClassesPage() {
  const router = useRouter();
  const toast = useToast();

  const [meta, setMeta] = useState<ClassMeta | null>(null);
  const [yearId, setYearId] = useState<number>(0);
  const [stats, setStats] = useState<ClassStats | null>(null);
  const [data, setData] = useState<Paginated<SchoolClass> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [grade, setGrade] = useState<number | ''>('');
  const [status, setStatus] = useState('');
  const [homeroom, setHomeroom] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'grade', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>('grid');
  const dq = useDebounce(q);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [hrTarget, setHrTarget] = useState<SchoolClass | null>(null);
  const [delTarget, setDelTarget] = useState<SchoolClass | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [menuId, setMenuId] = useState<number | null>(null);
  const reqId = useRef(0);

  // Nạp danh mục (năm học, giáo viên, môn học...) một lần
  useEffect(() => {
    classService.meta().then((m) => { setMeta(m); setYearId(m.current_year_id); })
      .catch((e) => { setError(getErrorMessage(e)); setLoading(false); });
    const saved = localStorage.getItem('classes-view') as View | null;
    if (saved) setView(saved);
  }, []);

  const loadStats = useCallback(() => {
    if (yearId) classService.stats(yearId).then(setStats).catch(() => setStats(null));
  }, [yearId]);

  const load = useCallback(async () => {
    if (!yearId) return;
    const id = ++reqId.current;
    setLoading(true); setError('');
    try {
      const res = await classService.list({
        school_year_id: yearId, grade, status, homeroom, q: dq, sort: sort.key, dir: sort.dir, page, per_page: view === 'grid' ? 12 : 15,
      });
      if (id === reqId.current) setData(res);
    } catch (e) {
      if (id === reqId.current) setError(getErrorMessage(e, 'Không tải được danh sách lớp học.'));
    } finally { if (id === reqId.current) setLoading(false); }
  }, [yearId, grade, status, homeroom, dq, sort, page, view]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { setPage(1); }, [yearId, grade, status, homeroom, dq, view]);
  useEffect(() => {
    const close = () => setMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const refresh = () => { load(); loadStats(); classService.meta(yearId).then(setMeta).catch(() => {}); };
  const open = (c: SchoolClass) => router.push(`/admin/classes/${c.id}`);

  const doDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    try {
      await classService.remove(delTarget.id);
      toast.success('Đã xóa lớp học', `Lớp ${delTarget.name} đã được xóa.`);
      setDelTarget(null); refresh();
    } catch (e) { toast.error('Không thể xóa lớp', getErrorMessage(e)); setDelTarget(null); } finally { setDeleting(false); }
  };

  const exportCsv = async () => {
    try { await classService.exportCsv(yearId); toast.success('Đã xuất danh sách lớp', 'File CSV đã được tải xuống.'); }
    catch (e) { toast.error('Xuất file thất bại', getErrorMessage(e)); }
  };

  const toggleSort = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const yearLabel = meta?.school_years.find((y) => y.id === yearId)?.label ?? '';
  const filtersActive = !!(grade || status || homeroom || q);

  const menu = (c: SchoolClass) => (
    <div className="a-menu" onClick={(e) => e.stopPropagation()}>
      <button className="a-icon-btn" onClick={() => setMenuId(menuId === c.id ? null : c.id)} aria-label="Thao tác"><Icon name="more" /></button>
      {menuId === c.id && (
        <div className="a-pop">
          <button onClick={() => open(c)}><Icon name="users" size={16} /> Xem chi tiết</button>
          <button onClick={() => router.push(`/admin/classes/${c.id}#students`)}><Icon name="users" size={16} /> Danh sách học sinh</button>
          <button onClick={() => router.push(`/admin/classes/${c.id}#timetable`)}><Icon name="calendar" size={16} /> Xếp thời khóa biểu</button>
          <button onClick={() => { setEditing(c); setFormOpen(true); setMenuId(null); }}><Icon name="edit" size={16} /> Chỉnh sửa</button>
          <button onClick={() => { setHrTarget(c); setMenuId(null); }}><Icon name="user" size={16} /> Phân công GVCN</button>
          <button className="d" onClick={() => { setDelTarget(c); setMenuId(null); }}><Icon name="trash" size={16} /> Xóa lớp</button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <section className="a-hero">
        <div className="a-row a-wrap">
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="a-crumb">Học vụ <span>›</span> Lớp học</div>
            <h1>Quản lý lớp học</h1>
            <p>Theo dõi sĩ số, giáo viên chủ nhiệm, phân công môn học và thời khóa biểu của toàn bộ các lớp trong năm học {yearLabel}.</p>
          </div>
          <div className="a-row a-wrap">
            <button className="a-btn" onClick={exportCsv}><Icon name="download" size={16} /> Xuất CSV</button>
            <button className="a-btn" onClick={() => setCloneOpen(true)}><Icon name="copy" size={16} /> Sang năm học mới</button>
            <button className="a-btn" onClick={() => setBulkOpen(true)}><Icon name="layers" size={16} /> Tạo hàng loạt</button>
            <button className="a-btn white" onClick={() => { setEditing(null); setFormOpen(true); }}><Icon name="plus" size={16} /> Thêm lớp</button>
          </div>
        </div>
      </section>


      {/* Thống kê */}
      <div className="a-stats">
        {[
          { l: 'Tổng số lớp', v: stats?.total_classes, i: 'school', bg: 'var(--primary-soft)', c: 'var(--primary)' },
          { l: 'Tổng học sinh', v: stats?.total_students, i: 'users', bg: 'var(--accent-soft)', c: 'var(--accent)' },
          { l: 'Sĩ số trung bình', v: stats?.avg_per_class, i: 'chart', bg: 'var(--info-soft)', c: 'var(--info)' },
          { l: 'Lớp chưa có GVCN', v: stats?.no_homeroom, i: 'user', bg: 'var(--warn-soft)', c: 'var(--warn)' },
          { l: 'Lớp đã đầy', v: stats?.full_classes, i: 'door', bg: 'var(--danger-soft)', c: 'var(--danger)' },
          { l: 'HS chưa xếp lớp', v: stats?.unassigned_students, i: 'alert', bg: 'var(--ok-soft)', c: 'var(--ok)' },
        ].map((s) => (
          <div key={s.l} className="a-card a-stat" style={{ ['--sc' as any]: s.c }}>
            <div className="ic" style={{ background: s.bg, color: s.c }}><Icon name={s.i} size={22} /></div>
            <div>{s.v === undefined ? <div className="a-skel" style={{ width: 60, height: 28 }} /> : <b>{s.v}</b>}<small>{s.l}</small></div>
          </div>
        ))}
      </div>

      {stats && stats.by_grade.length > 0 && (
        <div className="a-card" style={{ marginBottom: 22 }}>
          <div className="a-card-h"><h3>Phân bố theo khối</h3>
            <span className="a-muted">Nam {stats.male} · Nữ {stats.female}</span></div>
          <div className="a-card-b" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 22 }}>
            {stats.by_grade.map((g) => {
              const max = Math.max(...stats.by_grade.map((x) => x.students), 1);
              return (
                <div key={g.grade} className={`g${g.grade}`}>
                  <div className="a-row" style={{ marginBottom: 8 }}>
                    <b style={{ color: 'var(--gc)' }}>Khối {g.grade}</b><span className="a-sp" />
                    <span className="a-muted">{g.classes} lớp · {g.students} HS</span>
                  </div>
                  <div className="a-bar"><i style={{ width: `${(g.students / max) * 100}%`, background: 'var(--gc)' }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bộ lọc */}
      <div className="a-card a-toolbar">
        <select className="a-select" style={{ width: 170 }} value={yearId} onChange={(e) => setYearId(+e.target.value)} aria-label="Năm học">
          {meta?.school_years.map((y) => <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' ★' : ''}</option>)}
        </select>
        <div className="a-chips">
          {[{ v: '', l: 'Tất cả' }, { v: 10, l: 'Khối 10' }, { v: 11, l: 'Khối 11' }, { v: 12, l: 'Khối 12' }].map((g) => (
            <button key={g.l} className={`a-chip ${grade === g.v ? 'on' : ''}`} onClick={() => setGrade(g.v as any)}>{g.l}</button>
          ))}
        </div>
        <div className="a-search">
          <Icon name="search" size={16} />
          <input className="a-input" placeholder="Tìm tên lớp, giáo viên, phòng…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="a-select" style={{ width: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Mọi trạng thái</option>
          {meta?.statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="a-select" style={{ width: 160 }} value={homeroom} onChange={(e) => setHomeroom(e.target.value)}>
          <option value="">Mọi GVCN</option><option value="has">Đã có GVCN</option><option value="none">Chưa có GVCN</option>
        </select>
        {filtersActive && <button className="a-btn ghost sm" onClick={() => { setGrade(''); setStatus(''); setHomeroom(''); setQ(''); }}>Xóa lọc</button>}
        <div className="a-seg">
          {(['grid', 'table'] as View[]).map((v) => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => { setView(v); localStorage.setItem('classes-view', v); }}
                    aria-label={v === 'grid' ? 'Dạng thẻ' : 'Dạng bảng'}><Icon name={v === 'grid' ? 'grid' : 'list'} size={16} /></button>
          ))}
        </div>
      </div>

      {/* Nội dung */}
      {error ? (
        <div className="a-card a-empty">
          <div className="ill" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><Icon name="alert" size={36} /></div>
          <h3 style={{ color: 'var(--ink)', margin: '0 0 6px' }}>Không tải được dữ liệu</h3><p>{error}</p>
          <button className="a-btn pri" onClick={refresh}>Thử lại</button>
        </div>
      ) : loading && !data ? (
        <div className="a-cards">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="a-skel" style={{ height: 210 }} />)}</div>
      ) : data && data.items.length === 0 ? (
        <div className="a-card a-empty">
          <div className="ill"><Icon name="school" size={38} /></div>
          <h3 style={{ color: 'var(--ink)', margin: '0 0 6px' }}>{filtersActive ? 'Không có lớp phù hợp bộ lọc' : `Năm học ${yearLabel} chưa có lớp nào`}</h3>
          <p>{filtersActive ? 'Hãy thử thay đổi hoặc xóa bộ lọc.' : 'Tạo lớp mới, tạo hàng loạt hoặc sao chép từ năm học trước.'}</p>
          {!filtersActive && <div className="a-row" style={{ justifyContent: 'center' }}>
            <button className="a-btn" onClick={() => setCloneOpen(true)}>Sao chép từ năm trước</button>
            <button className="a-btn pri" onClick={() => setBulkOpen(true)}>Tạo hàng loạt</button></div>}
        </div>
      ) : view === 'grid' ? (
        <div className="a-cards" style={{ opacity: loading ? .6 : 1, transition: 'opacity .2s' }}>
          {data?.items.map((c) => (
            <div key={c.id} className={`a-card a-class g${c.grade}`} onClick={() => open(c)}>
              <div className="top-line" />
              <div className="a-row" style={{ alignItems: 'flex-start' }}>
                <div className="name">{c.name}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4>Lớp {c.name}</h4>
                  <div className="a-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.homeroom_teacher ? `GVCN: ${c.homeroom_teacher.full_name}` : 'Chưa có GVCN'}
                  </div>
                </div>
                {menu(c)}
              </div>
              <div className="meta">
                <div><b>{c.student_count}</b><small>Sĩ số</small></div>
                <div><b>{c.male_count}/{c.female_count}</b><small>Nam/Nữ</small></div>
                <div><b>{c.room || '—'}</b><small>Phòng</small></div>
              </div>
              <div className="a-row" style={{ marginBottom: 6 }}>
                <span className="a-muted" style={{ fontSize: 12 }}>Lấp đầy {c.student_count}/{c.capacity}</span><span className="a-sp" />
                <StatusBadge status={c.status} />
              </div>
              <FillBar percent={c.fill_percent} />
            </div>
          ))}
        </div>
      ) : (
        <div className="a-card" style={{ opacity: loading ? .6 : 1 }}>
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr>
                <th className="s" onClick={() => toggleSort('name')}>Lớp {sort.key === 'name' && (sort.dir === 'asc' ? '↑' : '↓')}</th>
                <th className="s" onClick={() => toggleSort('grade')}>Khối {sort.key === 'grade' && (sort.dir === 'asc' ? '↑' : '↓')}</th>
                <th>GVCN</th><th>Phòng</th>
                <th className="s" onClick={() => toggleSort('student_count')}>Sĩ số {sort.key === 'student_count' && (sort.dir === 'asc' ? '↑' : '↓')}</th>
                <th style={{ width: 160 }}>Lấp đầy</th><th>Trạng thái</th><th />
              </tr></thead>
              <tbody>
                {data?.items.map((c) => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => open(c)}>
                    <td><b>{c.name}</b></td><td><span className="a-badge pri">Khối {c.grade}</span></td>
                    <td>{c.homeroom_teacher?.full_name ?? <span className="a-muted">Chưa phân công</span>}</td>
                    <td>{c.room || '—'}</td><td><b>{c.student_count}</b>/{c.capacity}</td>
                    <td><FillBar percent={c.fill_percent} /></td><td><StatusBadge status={c.status} /></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="a-row" style={{ gap: 6 }}>
                        <button className="a-icon-btn" title="Chỉnh sửa" onClick={() => { setEditing(c); setFormOpen(true); }}><Icon name="edit" size={16} /></button>
                        <button className="a-icon-btn" title="Phân công GVCN" onClick={() => setHrTarget(c)}><Icon name="user" size={16} /></button>
                        <button className="a-icon-btn" title="Xóa lớp" style={{ color: 'var(--danger)' }} onClick={() => setDelTarget(c)}><Icon name="trash" size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && data.meta.last_page > 1 && (
        <div className="a-pager">
          <span className="a-muted">Hiển thị {data.items.length} / {data.meta.total} lớp</span>
          <div className="pg">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
            {Array.from({ length: data.meta.last_page }, (_, i) => i + 1).map((n) => (
              <button key={n} className={n === page ? 'on' : ''} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button disabled={page >= data.meta.last_page} onClick={() => setPage(page + 1)}>›</button>
          </div>
        </div>
      )}

      {meta && (
        <>
          <ClassFormModal open={formOpen} onClose={() => setFormOpen(false)} meta={meta} yearId={yearId} editing={editing} onSaved={refresh} />
          <BulkCreateModal open={bulkOpen} onClose={() => setBulkOpen(false)} meta={meta} yearId={yearId} onDone={refresh} />
          <CloneYearModal open={cloneOpen} onClose={() => setCloneOpen(false)} meta={meta} yearId={yearId} onDone={(y) => { setYearId(y); }} />
          <HomeroomModal open={!!hrTarget} onClose={() => setHrTarget(null)} meta={meta} target={hrTarget} onSaved={refresh} />
        </>
      )}
      <ConfirmDialog open={!!delTarget} danger loading={deleting} title={`Xóa lớp ${delTarget?.name ?? ''}?`} confirmText="Xóa lớp"
        message={<>Thao tác này không thể hoàn tác. Chỉ xóa được lớp chưa có học sinh và chưa có dữ liệu điểm.</>}
        onConfirm={doDelete} onClose={() => setDelTarget(null)} />
    </>
  );
}

