'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Ctx } from '../TeachersPage';
import Icon from '../../subjects/ui/Icon';
import { useToast } from '../../subjects/ui/Toast';
import { useConfirm } from '../../subjects/ui/Confirm';
import { tcls } from '../../subjects/theme';
import { download, toCsv } from '../../subjects/csv';
import { Empty, ErrorBox, Loading, useDebounced, useLoad } from '../../subjects/tabs/shared';
import { errMsg, teacherApi } from '../api';
import type { Teacher, TeacherDetail, TStatus } from '../types';
import { Avatar, LoadBar, STATUS_TONE } from './bits';
import TeacherForm from './TeacherForm';
import TeacherDrawer from './TeacherDrawer';
import ImportModal, { COLS } from './ImportModal';

type SortKey = 'full_name' | 'code' | 'periods' | 'main_subject';

export default function ListTab({ ctx, pendingCreate, onConsumed, openId, onOpened }: { ctx: Ctx; pendingCreate: boolean; onConsumed: () => void; openId: number | null; onOpened: () => void }) {
    const toast = useToast();
    const confirm = useConfirm();
    const M = ctx.meta;
    const [search, setSearch] = useState('');
    const q = useDebounced(search);
    const empty = { status: '', subject_id: '', degree: '', contract: '', load: '', homeroom: '' };
    const [flt, setFlt] = useState(empty);
    const [sort, setSort] = useState<SortKey>('full_name');
    const [dir, setDir] = useState<'asc' | 'desc'>('asc');
    const [page, setPage] = useState(1);
    const [per, setPer] = useState(12);
    const [view, setView] = useState<'table' | 'cards'>('table');
    const [sel, setSel] = useState<Set<number>>(new Set());
    const [form, setForm] = useState<{ t: TeacherDetail | null } | null>(null);
    const [drawer, setDrawer] = useState<number | null>(null);
    const [imp, setImp] = useState(false);

    useEffect(() => { try { const v = localStorage.getItem('tc-view'); if (v === 'cards' || v === 'table') setView(v); } catch { /* */ } }, []);
    useEffect(() => { try { localStorage.setItem('tc-view', view); } catch { /* */ } }, [view]);
    useEffect(() => { if (pendingCreate) { setForm({ t: null }); onConsumed(); } }, [pendingCreate, onConsumed]);
    useEffect(() => { if (openId) { setDrawer(openId); onOpened(); } }, [openId, onOpened]);
    useEffect(() => { setPage(1); setSel(new Set()); }, [q, flt, per, sort, dir]);

    const list = useLoad(() => teacherApi.list({ q, ...flt, school_year_id: ctx.yearId }), [q, flt, ctx.yearId]);

    const sorted = useMemo(() => {
        const a = [...(list.data ?? [])];
        const k = sort;
        a.sort((x, y) => {
            const vx = k === 'periods' ? x.periods : String(x[k] ?? '');
            const vy = k === 'periods' ? y.periods : String(y[k] ?? '');
            const c = typeof vx === 'number' ? vx - (vy as number) : String(vx).localeCompare(String(vy), 'vi');
            return dir === 'asc' ? c : -c;
        });
        return a;
    }, [list.data, sort, dir]);
    const total = sorted.length;
    const last = Math.max(1, Math.ceil(total / per));
    const items = sorted.slice((page - 1) * per, page * per);
    const allSel = items.length > 0 && items.every((s) => sel.has(s.id));
    const active = Object.values(flt).filter(Boolean).length + (q ? 1 : 0);

    const head = (k: SortKey, label: string) => (
        <th className="sortable" onClick={() => { if (sort === k) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(k); setDir('asc'); } }}>{label} {sort === k && <Icon name={dir === 'asc' ? 'up' : 'down'} size={12} />}</th>);
    const toggle = (id: number) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const refresh = () => { list.reload(true); ctx.refreshMeta(); };

    const openEdit = async (id: number) => {
        try { setForm({ t: await teacherApi.detail(id, ctx.yearId) }); } catch (e) { toast.error('Không mở được hồ sơ', errMsg(e)); }
    };
    const remove = async (t: Teacher) => {
        if (!(await confirm({ title: `Xóa giáo viên “${t.full_name}”?`, tone: 'danger', confirmText: 'Xóa giáo viên', typeToConfirm: t.code, message: 'Chỉ xóa được khi giáo viên chưa có phân công, chủ nhiệm hay điểm đã nhập. Nếu đã nghỉ việc, nên đổi trạng thái thay vì xóa.' }))) return;
        try { await teacherApi.remove(t.id); toast.success('Đã xóa giáo viên', t.full_name); refresh(); }
        catch (e) {
            const m = errMsg(e);
            if (await confirm({ title: 'Không thể xóa giáo viên này', tone: 'warning', confirmText: 'Chuyển sang “Đã nghỉ hưu”', cancelText: 'Giữ nguyên', message: m })) {
                await teacherApi.bulk([t.id], 'status', 'retired'); toast.success('Đã đổi trạng thái', t.full_name); refresh();
            }
        }
    };
    const setStatus = async (ids: number[], status: TStatus) => {
        try { const r = await teacherApi.bulk(ids, 'status', status); toast.success(`Đã cập nhật ${r.affected} giáo viên`, M.statuses[status]); setSel(new Set()); refresh(); }
        catch (e) { toast.error('Thao tác thất bại', errMsg(e)); }
    };
    const bulkDelete = async () => {
        const ids = [...sel];
        if (!(await confirm({ title: `Xóa ${ids.length} giáo viên đã chọn?`, tone: 'danger', confirmText: 'Đồng ý xóa', message: 'Giáo viên đang có phân công/chủ nhiệm/điểm sẽ tự động bị bỏ qua.' }))) return;
        try { const r = await teacherApi.bulk(ids, 'delete'); toast[r.affected < r.total ? 'warning' : 'success'](`Đã xóa ${r.affected}/${r.total} giáo viên`, r.affected < r.total ? 'Một số giáo viên đang được sử dụng nên được giữ lại.' : undefined); setSel(new Set()); refresh(); }
        catch (e) { toast.error('Thao tác thất bại', errMsg(e)); }
    };
    const exportCsv = async () => {
        try { const rows = await teacherApi.exportRows(); download(`giao-vien-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, COLS)); toast.success('Đã xuất danh sách giáo viên', `${rows.length} giáo viên (CSV UTF-8)`); }
        catch (e) { toast.error('Không xuất được', errMsg(e)); }
    };

    return (
        <>
            <div className="sj-bar">
                <div className="sj-search"><Icon name="search" size={16} /><input className="sj-input" placeholder="Tìm theo tên, mã, điện thoại, email…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                <select className="sj-select" value={flt.subject_id} onChange={(e) => setFlt({ ...flt, subject_id: e.target.value })}><option value="">Mọi chuyên môn</option>{M.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <select className="sj-select" value={flt.status} onChange={(e) => setFlt({ ...flt, status: e.target.value })}><option value="">Mọi trạng thái</option>{Object.entries(M.statuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <select className="sj-select" value={flt.contract} onChange={(e) => setFlt({ ...flt, contract: e.target.value })}><option value="">Mọi hợp đồng</option>{Object.entries(M.contracts).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <select className="sj-select" value={flt.degree} onChange={(e) => setFlt({ ...flt, degree: e.target.value })}><option value="">Mọi trình độ</option>{Object.entries(M.degrees).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <select className="sj-select" value={flt.load} onChange={(e) => setFlt({ ...flt, load: e.target.value })}><option value="">Mọi tải dạy</option><option value="over">Quá tải</option><option value="ok">Hợp lý</option><option value="under">Thiếu tải</option></select>
                <select className="sj-select" value={flt.homeroom} onChange={(e) => setFlt({ ...flt, homeroom: e.target.value })}><option value="">Chủ nhiệm: tất cả</option><option value="1">Có chủ nhiệm</option><option value="0">Không chủ nhiệm</option></select>
                {active > 0 && <button className="sj-btn sm ghost" onClick={() => { setSearch(''); setFlt(empty); }}><Icon name="x" size={14} /> Xóa lọc ({active})</button>}
                <span className="sj-spacer" />
                <div className="sj-seg"><button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')} title="Dạng bảng"><Icon name="list" size={16} /></button><button className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')} title="Dạng thẻ"><Icon name="grid" size={16} /></button></div>
                <button className="sj-btn" onClick={() => setImp(true)}><Icon name="upload" size={16} /> Nhập CSV</button>
                <button className="sj-btn" onClick={exportCsv}><Icon name="download" size={16} /> Xuất CSV</button>
            </div>

            {sel.size > 0 && (
                <div className="sj-bulk"><b>Đã chọn {sel.size} giáo viên</b><span className="sj-spacer" />
                    <button className="sj-btn sm" onClick={() => setStatus([...sel], 'active')}><Icon name="check" size={14} /> Đang công tác</button>
                    <button className="sj-btn sm" onClick={() => setStatus([...sel], 'leave')}><Icon name="clock" size={14} /> Nghỉ dài hạn</button>
                    <button className="sj-btn sm" onClick={() => setStatus([...sel], 'retired')}><Icon name="lock" size={14} /> Nghỉ hưu</button>
                    <button className="sj-btn sm" onClick={bulkDelete}><Icon name="trash" size={14} /> Xóa</button>
                    <button className="sj-btn sm" onClick={() => setSel(new Set())}>Bỏ chọn</button></div>)}

            {list.loading && !list.data ? <Loading rows={4} /> : list.error ? <ErrorBox msg={list.error} retry={list.reload} /> : total === 0 ? (
                <div className="sj-card"><Empty icon="users" title="Không có giáo viên phù hợp"><p>Thử thay đổi bộ lọc hoặc thêm giáo viên mới.</p><button className="sj-btn primary" onClick={() => setForm({ t: null })}><Icon name="plus" size={16} /> Thêm giáo viên</button></Empty></div>
            ) : view === 'table' ? (
                <div className="sj-tablewrap" style={{ opacity: list.loading ? 0.6 : 1, transition: '.2s' }}>
                    <table className="sj-table">
                        <thead><tr>
                            <th style={{ width: 36 }}><input type="checkbox" className="sj-check" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(items.map((s) => s.id)))} aria-label="Chọn tất cả" /></th>
                            {head('full_name', 'Giáo viên')}{head('main_subject', 'Chuyên môn')}<th>Chủ nhiệm</th>{head('periods', 'Tải dạy')}<th>Liên hệ</th><th>Trạng thái</th><th />
                        </tr></thead>
                        <tbody>{items.map((t) => (
                            <tr key={t.id} className={`${sel.has(t.id) ? 'sel' : ''} ${t.status !== 'active' ? 'dim' : ''}`}>
                                <td><input type="checkbox" className="sj-check" checked={sel.has(t.id)} onChange={() => toggle(t.id)} aria-label={`Chọn ${t.full_name}`} /></td>
                                <td><div className="tc-person" style={{ cursor: 'pointer' }} onClick={() => setDrawer(t.id)}><Avatar name={t.full_name} gender={t.gender} /><div><b>{t.full_name}</b><small>{t.code} • {t.position}</small></div></div></td>
                                <td>{t.subjects.length ? t.subjects.slice(0, 3).map((s) => <span key={s.id} className={`tc-sub ${tcls(s.color)} ${s.is_main ? 'main' : ''}`}>{s.name}</span>) : <span className="sj-badge bad">Chưa có</span>}</td>
                                <td>{t.homeroom_class ? <span className="sj-badge ok">{t.homeroom_class}</span> : <span className="sj-muted">—</span>}</td>
                                <td><LoadBar periods={t.periods} quota={t.quota} status={t.load_status} /></td>
                                <td><small>{t.phone || '—'}<br />{t.email || ''}</small></td>
                                <td><span className={`sj-badge ${STATUS_TONE[t.status]}`}>{M.statuses[t.status]}</span></td>
                                <td><div className="sj-acts">
                                    <button className="sj-btn icon" title="Xem hồ sơ" onClick={() => setDrawer(t.id)}><Icon name="eye" size={15} /></button>
                                    <button className="sj-btn icon" title="Sửa" onClick={() => openEdit(t.id)}><Icon name="edit" size={15} /></button>
                                    <button className="sj-btn icon danger-h" title="Xóa" onClick={() => remove(t)}><Icon name="trash" size={15} /></button></div></td>
                            </tr>))}</tbody>
                    </table>
                </div>
            ) : (
                <div className="sj-cards">{items.map((t) => (
                    <div key={t.id} className="sj-scard" style={{ opacity: t.status !== 'active' ? 0.6 : 1 }} onClick={() => setDrawer(t.id)}>
                        <div className="sj-scard-h"><div className="tc-person"><Avatar name={t.full_name} gender={t.gender} /><div><b>{t.full_name}</b><small>{t.code}</small></div></div>
                            <input type="checkbox" className="sj-check" checked={sel.has(t.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(t.id)} aria-label={`Chọn ${t.full_name}`} /></div>
                        <div className="sj-chips">{t.subjects.slice(0, 3).map((s) => <span key={s.id} className={`tc-sub ${tcls(s.color)}`}>{s.name}</span>)}{t.homeroom_class && <span className="sj-badge ok">GVCN {t.homeroom_class}</span>}</div>
                        <LoadBar periods={t.periods} quota={t.quota} status={t.load_status} />
                    </div>))}</div>
            )}

            {total > 0 && (
                <div className="sj-pager">
                    <span>Hiển thị {(page - 1) * per + 1}–{Math.min(page * per, total)} / {total} giáo viên</span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="sj-select" style={{ width: 'auto' }} value={per} onChange={(e) => setPer(Number(e.target.value))}>{[12, 24, 50].map((n) => <option key={n} value={n}>{n} / trang</option>)}</select>
            <button className="sj-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}><Icon name="left" size={15} /></button><b>{page} / {last}</b>
            <button className="sj-btn" disabled={page >= last} onClick={() => setPage(page + 1)}><Icon name="right" size={15} /></button></span>
                </div>)}

            {form && <TeacherForm teacher={form.t} meta={M} onClose={() => setForm(null)} onSaved={(id) => { setForm(null); refresh(); setDrawer(id); }} />}
            {drawer !== null && <TeacherDrawer id={drawer} yearId={ctx.yearId} meta={M} onClose={() => setDrawer(null)} onEdit={(t) => { setDrawer(null); setForm({ t }); }} />}
            {imp && <ImportModal onClose={() => setImp(false)} onDone={() => { setImp(false); refresh(); }} />}
        </>
    );
}