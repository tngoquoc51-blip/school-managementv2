'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Ctx } from '../SubjectsPage';
import Icon from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/Confirm';
import { errMsg, subjectApi, usageOf } from '../api';
import { CAT_LABEL, KIND_LABEL, tcls } from '../theme';
import { download, toCsv } from '../csv';
import type { Subject, SubjectDetail } from '../types';
import { Empty, ErrorBox, Loading, useDebounced, useLoad } from './shared';
import SubjectForm from './SubjectForm';
import SubjectDrawer from './SubjectDrawer';
import ImportModal from './ImportModal';

type SortKey = 'sort_order' | 'code' | 'name' | 'periods_per_week' | 'classes_count' | 'teachers_count';

export default function ListTab({ ctx, pendingCreate, onConsumed }: { ctx: Ctx; pendingCreate: boolean; onConsumed: () => void }) {
    const toast = useToast();
    const confirm = useConfirm();
    const [search, setSearch] = useState('');
    const q = useDebounced(search);
    const [flt, setFlt] = useState({ kind: '', category: '', status: '', group_id: '', grade: '' });
    const [sort, setSort] = useState<SortKey>('sort_order');
    const [dir, setDir] = useState<'asc' | 'desc'>('asc');
    const [page, setPage] = useState(1);
    const [per, setPer] = useState(12);
    const [view, setView] = useState<'table' | 'cards'>('table');
    const [sel, setSel] = useState<Set<number>>(new Set());
    const [form, setForm] = useState<{ subject: Subject | null } | null>(null);
    const [drawer, setDrawer] = useState<number | null>(null);
    const [imp, setImp] = useState(false);

    useEffect(() => { try { const v = localStorage.getItem('sj-view'); if (v === 'cards' || v === 'table') setView(v); } catch { /* */ } }, []);
    useEffect(() => { try { localStorage.setItem('sj-view', view); } catch { /* */ } }, [view]);
    useEffect(() => { if (pendingCreate) { setForm({ subject: null }); onConsumed(); } }, [pendingCreate, onConsumed]);
    useEffect(() => { setPage(1); setSel(new Set()); }, [q, flt, per, sort, dir]);

    const list = useLoad(() => subjectApi.list({ search: q, ...flt, sort, dir, page, per_page: per, school_year_id: ctx.yearId }), [q, flt, sort, dir, page, per, ctx.yearId]);
    const items = list.data?.items ?? [];
    const meta = list.data?.meta;
    const allSel = items.length > 0 && items.every((s) => sel.has(s.id));
    const active = useMemo(() => Object.values(flt).filter(Boolean).length + (q ? 1 : 0), [flt, q]);

    const head = (k: SortKey, label: string) => (
        <th className="sortable" onClick={() => { if (sort === k) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(k); setDir('asc'); } }}>
            {label} {sort === k && <Icon name={dir === 'asc' ? 'up' : 'down'} size={12} />}
        </th>);
    const toggle = (id: number) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const refresh = () => { list.reload(true); ctx.refreshMeta(); };

    const remove = async (s: Subject) => {
        const ok = await confirm({ title: `Xóa môn “${s.name}”?`, tone: 'danger', confirmText: 'Xóa môn học', typeToConfirm: s.code, message: 'Thao tác không thể hoàn tác. Chỉ xóa được khi môn chưa phát sinh phân công, thời khóa biểu hay điểm.' });
        if (!ok) return;
        try { await subjectApi.remove(s.id); toast.success('Đã xóa môn học', s.name); refresh(); }
        catch (e) {
            const u = usageOf(e);
            if (u) {
                const dis = await confirm({ title: 'Không thể xóa môn đang sử dụng', tone: 'warning', confirmText: 'Ngừng sử dụng môn này', cancelText: 'Giữ nguyên',
                    message: <>Môn <b>{s.name}</b> đang liên kết với: <b>{u.class_subjects}</b> phân công lớp, <b>{u.timetable}</b> tiết TKB, <b>{u.grades}</b> bản ghi điểm. Bạn có muốn chuyển sang “Ngừng sử dụng” thay thế?</> });
                if (dis) { await subjectApi.bulk('deactivate', [s.id]); toast.success('Đã ngừng sử dụng', s.name); refresh(); }
            } else toast.error('Không xóa được', errMsg(e));
        }
    };
    const flip = async (s: Subject) => {
        try { await subjectApi.bulk(s.status === 'active' ? 'deactivate' : 'activate', [s.id]); toast.success(s.status === 'active' ? 'Đã ngừng sử dụng' : 'Đã kích hoạt lại', s.name); refresh(); }
        catch (e) { toast.error('Không đổi được trạng thái', errMsg(e)); }
    };
    const dup = async (s: { id: number; name: string }) => {
        try { const n = await subjectApi.duplicate(s.id); toast.success('Đã nhân bản', `${n.code} (đang ở trạng thái Ngừng sử dụng — hãy chỉnh sửa rồi kích hoạt)`); setDrawer(null); refresh(); }
        catch (e) { toast.error('Không nhân bản được', errMsg(e)); }
    };
    const bulk = async (action: 'activate' | 'deactivate' | 'delete') => {
        const ids = [...sel];
        const label = { activate: 'kích hoạt', deactivate: 'ngừng sử dụng', delete: 'xóa' }[action];
        if (!(await confirm({ title: `${label[0].toUpperCase() + label.slice(1)} ${ids.length} môn đã chọn?`, tone: action === 'delete' ? 'danger' : 'primary', confirmText: 'Đồng ý', message: action === 'delete' ? 'Các môn đang được sử dụng sẽ tự động bị bỏ qua.' : undefined }))) return;
        try {
            const r = await subjectApi.bulk(action, ids);
            if (r.skipped.length) toast.warning(`Đã ${label} ${r.done} môn`, `Bỏ qua ${r.skipped.length} môn đang được sử dụng.`); else toast.success(`Đã ${label} ${r.done} môn`);
            setSel(new Set()); refresh();
        } catch (e) { toast.error('Thao tác thất bại', errMsg(e)); }
    };
    const exportCsv = async () => {
        try {
            const rows = await subjectApi.exportRows();
            download(`mon-hoc-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, ['code', 'name', 'kind', 'category', 'periods_per_week', 'group_code', 'grades', 'status', 'description']));
            toast.success('Đã xuất danh sách môn học', `${rows.length} môn (CSV UTF-8, mở được bằng Excel)`);
        } catch (e) { toast.error('Không xuất được', errMsg(e)); }
    };
    const saved = (s: SubjectDetail) => { setForm(null); setDrawer((d) => (d ? s.id : d)); refresh(); };

    return (
        <>
            <div className="sj-bar">
                <div className="sj-search"><Icon name="search" size={16} /><input className="sj-input" placeholder="Tìm theo mã hoặc tên môn…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                <select className="sj-select" value={flt.kind} onChange={(e) => setFlt({ ...flt, kind: e.target.value })}><option value="">Mọi hình thức</option><option value="score">Tính điểm</option><option value="pass">Đạt/Chưa đạt</option></select>
                <select className="sj-select" value={flt.category} onChange={(e) => setFlt({ ...flt, category: e.target.value })}><option value="">Mọi nhóm</option>{Object.entries(CAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <select className="sj-select" value={flt.group_id} onChange={(e) => setFlt({ ...flt, group_id: e.target.value })}><option value="">Mọi tổ</option><option value="none">Chưa phân tổ</option>{ctx.meta.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
                <select className="sj-select" value={flt.grade} onChange={(e) => setFlt({ ...flt, grade: e.target.value })}><option value="">Mọi khối</option>{[10, 11, 12].map((g) => <option key={g} value={g}>Khối {g}</option>)}</select>
                <select className="sj-select" value={flt.status} onChange={(e) => setFlt({ ...flt, status: e.target.value })}><option value="">Mọi trạng thái</option><option value="active">Đang dạy</option><option value="inactive">Ngừng sử dụng</option></select>
                {active > 0 && <button className="sj-btn sm ghost" onClick={() => { setSearch(''); setFlt({ kind: '', category: '', status: '', group_id: '', grade: '' }); }}><Icon name="x" size={14} /> Xóa lọc ({active})</button>}
                <span className="sj-spacer" />
                <div className="sj-seg"><button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')} title="Dạng bảng"><Icon name="list" size={16} /></button><button className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')} title="Dạng thẻ"><Icon name="grid" size={16} /></button></div>
                <button className="sj-btn" onClick={() => setImp(true)}><Icon name="upload" size={16} /> Nhập CSV</button>
                <button className="sj-btn" onClick={exportCsv}><Icon name="download" size={16} /> Xuất CSV</button>
            </div>

            {sel.size > 0 && (
                <div className="sj-bulk"><b>Đã chọn {sel.size} môn</b><span className="sj-spacer" />
                    <button className="sj-btn sm" onClick={() => bulk('activate')}><Icon name="check" size={14} /> Kích hoạt</button>
                    <button className="sj-btn sm" onClick={() => bulk('deactivate')}><Icon name="lock" size={14} /> Ngừng sử dụng</button>
                    <button className="sj-btn sm" onClick={() => bulk('delete')}><Icon name="trash" size={14} /> Xóa</button>
                    <button className="sj-btn sm" onClick={() => setSel(new Set())}>Bỏ chọn</button></div>)}

            {list.loading && !list.data ? <Loading rows={4} /> : list.error ? <ErrorBox msg={list.error} retry={list.reload} /> : items.length === 0 ? (
                <div className="sj-card"><Empty icon="book" title="Không có môn học phù hợp">
                    <p>Thử thay đổi bộ lọc hoặc thêm môn học mới.</p><button className="sj-btn primary" onClick={() => setForm({ subject: null })}><Icon name="plus" size={16} /> Thêm môn học</button></Empty></div>
            ) : view === 'table' ? (
                <div className="sj-tablewrap" style={{ opacity: list.loading ? 0.6 : 1, transition: '.2s' }}>
                    <table className="sj-table">
                        <thead><tr>
                            <th style={{ width: 36 }}><input type="checkbox" className="sj-check" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(items.map((s) => s.id)))} aria-label="Chọn tất cả" /></th>
                            {head('code', 'Môn học')}<th>Tổ bộ môn</th><th>Hình thức</th>{head('periods_per_week', 'Tiết/tuần')}{head('classes_count', 'Số lớp')}{head('teachers_count', 'Giáo viên')}<th>Trạng thái</th><th />
                        </tr></thead>
                        <tbody>{items.map((s) => (
                            <tr key={s.id} className={`${sel.has(s.id) ? 'sel' : ''} ${s.status === 'inactive' ? 'dim' : ''} ${tcls(s.color)}`}>
                                <td><input type="checkbox" className="sj-check" checked={sel.has(s.id)} onChange={() => toggle(s.id)} aria-label={`Chọn ${s.name}`} /></td>
                                <td><div className="sj-cell-main" style={{ cursor: 'pointer' }} onClick={() => setDrawer(s.id)}><span className="sj-avatar">{s.code.slice(0, 3)}</span><div><b>{s.name}</b><small>{s.code} • {CAT_LABEL[s.category]} • Khối {s.grades.join('/')}</small></div></div></td>
                                <td>{s.group_name ?? <span className="sj-muted">—</span>}</td>
                                <td><span className="sj-tag">{KIND_LABEL[s.kind]}</span></td>
                                <td><b>{s.periods_per_week}</b></td><td>{s.classes_count}</td>
                                <td title={`${s.specialist_count} GV có chuyên môn môn này`}>{s.teachers_count} <small className="sj-muted">/ {s.specialist_count}</small></td>
                                <td><span className={`sj-badge ${s.status === 'active' ? 'ok' : 'warn'}`}>{s.status === 'active' ? 'Đang dạy' : 'Ngừng'}</span></td>
                                <td><div className="sj-acts">
                                    <button className="sj-btn icon" title="Xem chi tiết" onClick={() => setDrawer(s.id)}><Icon name="eye" size={15} /></button>
                                    <button className="sj-btn icon" title="Sửa" onClick={() => setForm({ subject: s })}><Icon name="edit" size={15} /></button>
                                    <button className="sj-btn icon" title="Nhân bản" onClick={() => dup(s)}><Icon name="copy" size={15} /></button>
                                    <button className="sj-btn icon" title={s.status === 'active' ? 'Ngừng sử dụng' : 'Kích hoạt'} onClick={() => flip(s)}><Icon name={s.status === 'active' ? 'lock' : 'check'} size={15} /></button>
                                    <button className="sj-btn icon danger-h" title="Xóa" onClick={() => remove(s)}><Icon name="trash" size={15} /></button></div></td>
                            </tr>))}</tbody>
                    </table>
                </div>
            ) : (
                <div className="sj-cards">{items.map((s) => (
                    <div key={s.id} className={`sj-scard ${tcls(s.color)}`} style={{ opacity: s.status === 'inactive' ? 0.6 : 1 }} onClick={() => setDrawer(s.id)}>
                        <div className="sj-scard-h"><div><span className="sj-tag">{s.code}</span><h4 style={{ marginTop: 8 }}>{s.name}</h4><small className="sj-muted">{s.group_name ?? 'Chưa phân tổ'}</small></div>
                            <input type="checkbox" className="sj-check" checked={sel.has(s.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(s.id)} aria-label={`Chọn ${s.name}`} /></div>
                        <div className="sj-chips"><span className="sj-badge">{KIND_LABEL[s.kind]}</span><span className="sj-badge">{CAT_LABEL[s.category]}</span></div>
                        <dl><div><dt>Tiết/tuần</dt><dd>{s.periods_per_week}</dd></div><div><dt>Số lớp</dt><dd>{s.classes_count}</dd></div><div><dt>Giáo viên</dt><dd>{s.teachers_count}</dd></div><div><dt>Khối</dt><dd>{s.grades.join('/')}</dd></div></dl>
                    </div>))}</div>
            )}

            {meta && items.length > 0 && (
                <div className="sj-pager">
                    <span>Hiển thị {(meta.page - 1) * meta.per_page + 1}–{Math.min(meta.page * meta.per_page, meta.total)} / {meta.total} môn</span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="sj-select" style={{ width: 'auto' }} value={per} onChange={(e) => setPer(Number(e.target.value))}>{[12, 24, 50].map((n) => <option key={n} value={n}>{n} / trang</option>)}</select>
            <button className="sj-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}><Icon name="left" size={15} /></button>
            <b>{meta.page} / {meta.last_page}</b>
            <button className="sj-btn" disabled={page >= meta.last_page} onClick={() => setPage(page + 1)}><Icon name="right" size={15} /></button></span>
                </div>)}

            {form && <SubjectForm subject={form.subject} groups={ctx.meta.groups} onClose={() => setForm(null)} onSaved={saved} />}
            {drawer !== null && <SubjectDrawer id={drawer} yearId={ctx.yearId} onClose={() => setDrawer(null)} go={ctx.go}
                                               onEdit={(s) => setForm({ subject: s })} onDuplicate={dup} />}
            {imp && <ImportModal onClose={() => setImp(false)} onDone={() => { setImp(false); refresh(); }} />}
        </>
    );
}