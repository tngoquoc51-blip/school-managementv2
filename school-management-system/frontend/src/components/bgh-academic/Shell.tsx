'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiGet, Meta, Overview, useApi } from '@/lib/bgh-academic';
import { ALIASES } from '@/lib/bgh-academic-aliases';
import { ErrorBox, Icon, Skeleton, ToastProvider } from './ui';

interface AcCtx {
  yearId: number; yearLabel: string; semester: 1 | 2; meta: Meta;
  overview: Overview | null; reloadOverview: () => void;
}
const Ctx = createContext<AcCtx | null>(null);
export function useAcademic(): AcCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAcademic phải nằm trong AcademicShell');
  return c;
}

const BASE = '/bgh/academic';
const NAV: { key: string; label: string; icon: string; badge?: 'plans' | 'requests' }[] = [
  { key: 'overview', label: 'Tổng quan', icon: 'dashboard' },
  { key: 'subjects', label: 'Môn học & tổ', icon: 'book' },
  { key: 'teachers', label: 'Giáo viên', icon: 'users' },
  { key: 'timetable', label: 'Thời khóa biểu', icon: 'calendar' },
  { key: 'exams', label: 'Kỳ thi', icon: 'exam' },
  { key: 'results', label: 'Kết quả', icon: 'chart' },
  { key: 'lesson-plans', label: 'Giáo án', icon: 'clipboard', badge: 'plans' },
  { key: 'observations', label: 'Dự giờ', icon: 'eye' },
  { key: 'approvals', label: 'Phê duyệt', icon: 'shield', badge: 'requests' },
];
/** Địa chỉ của tab: dùng địa chỉ menu BGH có sẵn nếu có (để thanh bên sáng đúng mục), nếu không thì /bgh/academic/... */
const hrefOf = (key: string) => (key === 'overview' ? BASE : ALIASES[key] || `${BASE}/${key}`);

export default function AcademicShell({ children }: { children: ReactNode }) {
  return <ToastProvider><ShellInner>{children}</ShellInner></ToastProvider>;
}

/**
 * Bản "nhúng": nằm bên trong layout BGH có sẵn của trường (không vẽ thêm thanh bên / đầu trang),
 * chỉ thêm một thanh tab ngang để chuyển giữa các phân hệ chuyên môn.
 */
function ShellInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [yearId, setYearId] = useState<number | null>(null);
  const [semester, setSemester] = useState<1 | 2>(1);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaErr, setMetaErr] = useState<any>(null);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    const sem = Number(localStorage.getItem('ac_semester'));
    if (sem === 1 || sem === 2) setSemester(sem);
    apiGet<Meta>('/meta').then((m) => { setMeta(m); setYearId(m.current_year_id); }).catch((e) => {
      setMetaErr(e);
      if (e?.response?.status === 401) { localStorage.removeItem('token'); setTimeout(() => router.replace('/login'), 1200); }
    });
  }, [router]);

  const overviewState = useApi<Overview>(meta && yearId ? '/overview' : null, { year_id: yearId, semester });
  const reloadOverview = useCallback(() => { overviewState.reload(); }, [overviewState]);

  const ctx = useMemo<AcCtx | null>(() => {
    if (!meta || !yearId) return null;
    const y = meta.years.find((x) => x.id === yearId);
    return { yearId, yearLabel: y?.label || '', semester, meta, overview: overviewState.data, reloadOverview };
  }, [meta, yearId, semester, overviewState.data, reloadOverview]);

  const badge = (b?: 'plans' | 'requests') => {
    const k = overviewState.data?.kpi;
    return b === 'plans' ? k?.pending_plans : b === 'requests' ? k?.pending_requests : 0;
  };
  const isActive = (key: string) => {
    if (key === 'overview') return pathname === BASE;
    const h = hrefOf(key);
    return pathname === h || pathname.startsWith(h + '/') || pathname === `${BASE}/${key}` || pathname.startsWith(`${BASE}/${key}/`);
  };

  return (
    <div className="ac-root ac-embedded" data-theme="light">
      <div className="ac-toolbar">
        <div className="ac-tabs" role="navigation" aria-label="Phân hệ chuyên môn">
          {NAV.map((i) => {
            const n = badge(i.badge);
            return (
              <Link key={i.key} href={hrefOf(i.key)} className={`ac-tab ${isActive(i.key) ? 'active' : ''}`}>
                <Icon name={i.icon} size={16} /><span>{i.label}</span>{n ? <em className="ac-count">{n}</em> : null}
              </Link>
            );
          })}
        </div>
        {meta && yearId && (
          <div className="ac-toolbar-tools">
            <button className="ac-btn sm" onClick={() => setPalette(true)} aria-label="Tìm nhanh giáo viên, môn, lớp"><Icon name="search" size={15} /> Tìm nhanh</button>
            <select className="ac-select inline" value={yearId} onChange={(e) => setYearId(Number(e.target.value))} aria-label="Năm học">
              {meta.years.map((y) => <option key={y.id} value={y.id}>Năm học {y.label}</option>)}
            </select>
            <select className="ac-select inline" value={semester} onChange={(e) => { const s = Number(e.target.value) as 1 | 2; setSemester(s); localStorage.setItem('ac_semester', String(s)); }} aria-label="Học kỳ">
              <option value={1}>Học kỳ 1</option><option value={2}>Học kỳ 2</option>
            </select>
          </div>
        )}
      </div>

      <div className="ac-content">
        {metaErr ? <ErrorBox error={metaErr} /> : !ctx ? <Skeleton h={110} n={4} /> : <Ctx.Provider value={ctx}>{children}</Ctx.Provider>}
      </div>
      {palette && meta && <Palette meta={meta} yearId={yearId || 0} onClose={() => setPalette(false)} onGo={(href) => { setPalette(false); router.push(href); }} />}
    </div>
  );
}

/* ---------------- Tìm nhanh ---------------- */
function Palette({ meta, yearId, onClose, onGo }: { meta: Meta; yearId: number; onClose: () => void; onGo: (href: string) => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  const all = useMemo(() => [
    ...NAV.map((i) => ({ key: 'p' + i.key, icon: i.icon, label: i.label, hint: 'Phân hệ', href: hrefOf(i.key) })),
    ...meta.teachers.map((t) => ({ key: 't' + t.id, icon: 'users', label: t.full_name, hint: `Giáo viên · ${t.code}`, href: `${hrefOf('teachers')}?open=${t.id}` })),
    ...meta.subjects.map((s) => ({ key: 's' + s.id, icon: 'book', label: s.name, hint: 'Môn học', href: `${hrefOf('subjects')}?open=${s.id}` })),
    ...meta.classes.filter((c) => c.school_year_id === yearId).map((c) => ({ key: 'c' + c.id, icon: 'calendar', label: `Lớp ${c.name}`, hint: 'Thời khóa biểu', href: `${hrefOf('timetable')}?class=${c.id}` })),
  ], [meta, yearId]);
  const list = useMemo(() => {
    const n = norm(q.trim());
    return (n ? all.filter((x) => norm(x.label).includes(n) || norm(x.hint).includes(n)) : all.slice(0, 9)).slice(0, 9);
  }, [q, all]);
  useEffect(() => setSel(0), [q]);
  return (
    <div className="ac-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ac-palette" role="dialog" aria-label="Tìm nhanh">
        <input autoFocus placeholder="Gõ tên giáo viên, môn học, lớp…" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, list.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === 'Enter' && list[sel]) onGo(list[sel].href);
          }} />
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {list.length === 0 && <div className="ac-pal-i ac-muted">Không tìm thấy kết quả.</div>}
          {list.map((x, i) => (
            <div key={x.key} className={`ac-pal-i ${i === sel ? 'on' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => onGo(x.href)}>
              <Icon name={x.icon} /><span className="ac-b">{x.label}</span><span className="ac-small ac-muted ac-right">{x.hint}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
