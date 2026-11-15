'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import c from './subjects.module.css';
import {
    subjectApi, type Assignment, type ClassOpt, type Subject, type SubjectDetail, type SubjectForm, type SubjectStats, type TeacherOpt,
} from '../services/subjectService';

const KINDS: Record<string, string> = { score: 'Tính điểm', pass: 'Đạt / Chưa đạt' };
const DEPTS = ['Toán – Tin', 'Khoa học tự nhiên', 'Khoa học xã hội', 'Ngoại ngữ', 'Giáo dục khác'];
const EMPTY: SubjectForm = { code: '', name: '', kind: 'score', periods_per_week: 2, sort_order: 100, department: DEPTS[0], description: '', color: '#0ea5e9', is_active: true };
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Có lỗi xảy ra, vui lòng thử lại.');
const n = (v: unknown) => Number(v ?? 0);
type Toast = { id: number; ok: boolean; text: string };

export default function SubjectsPage() {
    const [list, setList] = useState<Subject[]>([]);
    const [stats, setStats] = useState<SubjectStats | null>(null);
    const [q, setQ] = useState('');
    const [dept, setDept] = useState('all');
    const [status, setStatus] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [form, setForm] = useState<(SubjectForm & { id?: number }) | null>(null);
    const [errs, setErrs] = useState('');
    const [busy, setBusy] = useState(false);
    const [del, setDel] = useState<Subject | null>(null);
    const [detail, setDetail] = useState<SubjectDetail | null>(null);
    const [tab, setTab] = useState<'info' | 'assign'>('info');
    const [meta, setMeta] = useState<{ classes: ClassOpt[]; teachers: TeacherOpt[] } | null>(null);
    const [add, setAdd] = useState({ class_id: '', teacher_id: '' });

    const toast = (ok: boolean, text: string) => {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t, { id, ok, text }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
    };

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const [l, s] = await Promise.all([subjectApi.list({ q, dept, status }), subjectApi.stats()]);
            setList(l); setStats(s);
        } catch (e) { setError(msg(e)); } finally { setLoading(false); }
    }, [q, dept, status]);
    useEffect(() => { const t = setTimeout(load, q ? 350 : 0); return () => clearTimeout(t); }, [load, q]);

    const openDetail = async (id: number, t: 'info' | 'assign' = 'info') => {
        setTab(t);
        try {
            const [d, m] = await Promise.all([subjectApi.show(id), meta ? Promise.resolve(meta) : subjectApi.meta()]);
            setDetail(d); setMeta(m); setAdd({ class_id: '', teacher_id: '' });
        } catch (e) { toast(false, msg(e)); }
    };
    const reloadDetail = async () => { if (detail) setDetail(await subjectApi.show(detail.subject.id)); await load(); };

    async function run(fn: () => Promise<string>, after?: () => Promise<void> | void) {
        setBusy(true);
        try { toast(true, await fn()); await after?.(); } catch (e) { toast(false, msg(e)); } finally { setBusy(false); }
    }

    async function save(e: FormEvent) {
        e.preventDefault();
        if (!form) return;
        setBusy(true); setErrs('');
        try {
            const { id, ...body } = form;
            toast(true, id ? await subjectApi.update(id, body) : await subjectApi.create(body));
            setForm(null); await load(); if (id && detail) await reloadDetail();
        } catch (er) { setErrs(msg(er)); } finally { setBusy(false); }
    }

    const depts = useMemo(() => stats?.departments.filter((d) => d.name) ?? [], [stats]);
    const teachersFor = (subjectId: number) => {
        const t = meta?.teachers ?? [];
        return [...t.filter((x) => x.main_subject_id === subjectId), ...t.filter((x) => x.main_subject_id !== subjectId)];
    };
    const free = useMemo(() => {
        if (!detail || !meta) return [];
        const used = new Set(detail.assignments.map((a) => a.class_id));
        return meta.classes.filter((cl) => !used.has(cl.id));
    }, [detail, meta]);

    const cards: [string, number | string, string][] = stats ? [
        ['Tổng số môn học', stats.total, `${stats.periods} tiết/tuần (tổng chuẩn)`],
        ['Đang hoạt động', stats.active, `${stats.total - stats.active} môn tạm ngưng`],
        ['Đã phân công lớp', stats.total - stats.unassigned, 'năm học hiện tại'],
        ['Chưa phân công', stats.unassigned, stats.unassigned ? 'cần xếp giáo viên và lớp' : 'đã đầy đủ'],
    ] : [];

    return (
        <div className={c.page}>
            <div className={c.toasts} aria-live="polite">
                {toasts.map((t) => <div key={t.id} className={c.toast} style={{ '--c': t.ok ? '#16a34a' : '#dc2626' } as CSSProperties} role="status">{t.ok ? 'Thành công' : 'Có lỗi'}<small>{t.text}</small></div>)}
            </div>

            <section className={c.hero}>
                <div><h1>Môn học</h1><p>Quản lý danh mục môn, số tiết mỗi tuần, tổ chuyên môn và phân công giáo viên cho từng lớp.</p></div>
                <div className={c.heroBtns}>
                    <button className={`${c.btn} ${c.glass}`} onClick={load}>Làm mới</button>
                    <button className={`${c.btn} ${c.pri}`} onClick={() => { setErrs(''); setForm({ ...EMPTY, sort_order: (stats?.total ?? 0) + 1 }); }}>+ Thêm môn học</button>
                </div>
            </section>

            <div className={c.stats}>
                {stats ? cards.map(([t, v, s]) => <div key={t} className={c.stat}><small>{t}</small><b>{v}</b><br /><i>{s}</i></div>)
                    : [0, 1, 2, 3].map((i) => <div key={i} className={c.skel} style={{ height: 96 }} />)}
            </div>

            <div className={c.bar}>
                <input className={`${c.input} ${c.search}`} type="search" placeholder="Tìm theo tên hoặc mã môn…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm môn học" />
                <div className={c.chips} role="group" aria-label="Tổ chuyên môn">
                    <button className={c.chip} aria-pressed={dept === 'all'} onClick={() => setDept('all')}>Tất cả</button>
                    {depts.map((d) => <button key={d.name} className={c.chip} aria-pressed={dept === d.name} onClick={() => setDept(d.name)}>{d.name} · {n(d.c)}</button>)}
                </div>
                <select className={c.input} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Trạng thái">
                    <option value="all">Mọi trạng thái</option><option value="active">Đang hoạt động</option><option value="inactive">Tạm ngưng</option>
                </select>
            </div>

            {error && (
                <>
                    <div role="alert" className={c.err}><span>{error}</span><button onClick={load}>Thử lại</button></div>
                    {/Phiên đăng nhập|401|quyền/.test(error) && <div className={c.hint}>Hãy đăng nhập lại bằng tài khoản quản trị. Nếu vẫn báo lỗi, kiểm tra route <code>admin/subjects</code> đã thêm vào <code>routes/api.php</code> và đã chạy <code>subjects_module.sql</code>.</div>}
                </>
            )}

            {loading && !list.length ? <div className={c.grid}>{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className={c.skel} />)}</div>
                : !list.length && !error ? <div className={c.empty}><b>Không có môn học phù hợp.</b><br />Thử đổi bộ lọc hoặc bấm “Thêm môn học”.</div>
                    : (
                        <div className={c.grid}>
                            {list.map((s) => (
                                <button
                                    key={s.id}
                                    className={`${c.card} ${n(s.is_active) ? '' : c.off}`}
                                    style={{ '--c': s.color || '#0ea5e9' } as CSSProperties}
                                    onClick={() => openDetail(s.id)}
                                >
                                    <div className={c.cardAccent} />
                                    <div className={c.cardTop}>
                                        <span className={c.code}>{s.code}</span>
                                        <span className={`${c.badge} ${n(s.is_active) ? c.badgeOk : c.badgeMut}`}>
                    {n(s.is_active) ? 'Hoạt động' : 'Tạm ngưng'}
                </span>
                                    </div>

                                    <div className={c.cardBody}>
                                        <h3 className={c.name}>{s.name}</h3>
                                        <p className={c.dept}>{s.department || 'Chưa xếp tổ chuyên môn'}</p>

                                        <div className={c.tags}>
                                            <span className={c.tag}>{KINDS[s.kind] ?? s.kind}</span>
                                            <span className={c.tag}>{s.periods_per_week} tiết/tuần</span>
                                            {!n(s.classes_count) && (
                                                <span className={`${c.tag} ${c.tagWarn}`}>Chưa phân công</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className={c.metrics}>
                                        <div className={c.metric}>
                                            <b>{n(s.classes_count)}</b>
                                            <small>Lớp</small>
                                        </div>
                                        <div className={c.metric}>
                                            <b>{n(s.teachers_count)}</b>
                                            <small>GV dạy</small>
                                        </div>
                                        <div className={c.metric}>
                                            <b>{n(s.main_teachers)}</b>
                                            <small>GV chính</small>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

            {detail && (
                <>
                    <div className={c.ov} onMouseDown={() => setDetail(null)} />
                    <aside className={c.drawer} role="dialog" aria-modal="true" aria-label="Chi tiết môn học">
                        {/* ===== HEADER ===== */}
                        <div className={c.dh} style={{ '--accent': detail.subject.color || '#0ea5e9' } as CSSProperties}>
                            <div className={c.dhBar} />
                            <div className={c.dhTop}>
                                <span className={c.dhCode}>{detail.subject.code}</span>
                                <button className={c.x} aria-label="Đóng" onClick={() => setDetail(null)}>✕</button>
                            </div>
                            <h2>{detail.subject.name}</h2>
                            <div className={c.dhMeta}>
                                <span>{detail.subject.department || 'Chưa xếp tổ'}</span>
                                <span>·</span>
                                <span>{detail.subject.periods_per_week} tiết/tuần</span>
                                <span>·</span>
                                <span>{detail.assignments.length} lớp</span>
                            </div>
                            <span className={`${c.dhStatus} ${n(detail.subject.is_active) ? c.stOn : c.stOff}`}>
                    {n(detail.subject.is_active) ? '● Đang hoạt động' : '● Tạm ngưng'}
                </span>
                        </div>

                        {/* ===== TABS ===== */}
                        <div className={c.tabs} role="tablist">
                            <button className={c.tab} role="tab" aria-selected={tab === 'info'} onClick={() => setTab('info')}>
                                Thông tin chung
                            </button>
                            <button className={c.tab} role="tab" aria-selected={tab === 'assign'} onClick={() => setTab('assign')}>
                                Phân công giảng dạy
                                <em>{detail.assignments.length}</em>
                            </button>
                        </div>

                        <div className={c.db}>
                            {tab === 'info' ? (
                                <>
                                    {/* Thống kê */}
                                    <div className={c.dStats}>
                                        <div className={c.dStat}>
                                            <b>{detail.assignments.length}</b>
                                            <span>Lớp đang học</span>
                                        </div>
                                        <div className={c.dStat}>
                                            <b>{new Set(detail.assignments.map((a) => a.teacher_id)).size}</b>
                                            <span>Giáo viên dạy</span>
                                        </div>
                                        <div className={c.dStat}>
                                            <b>{(meta?.teachers ?? []).filter((t) => t.main_subject_id === detail.subject.id).length}</b>
                                            <span>GV bộ môn chính</span>
                                        </div>
                                    </div>

                                    {/* Thông tin chi tiết */}
                                    <div className={c.section}>
                                        <h3 className={c.sectionTitle}>Thông tin môn học</h3>
                                        <div className={c.infoGrid}>
                                            <div className={c.infoItem}>
                                                <span>Mã môn</span>
                                                <b>{detail.subject.code}</b>
                                            </div>
                                            <div className={c.infoItem}>
                                                <span>Hình thức đánh giá</span>
                                                <b>{KINDS[detail.subject.kind] ?? detail.subject.kind}</b>
                                            </div>
                                            <div className={c.infoItem}>
                                                <span>Số tiết / tuần</span>
                                                <b>{detail.subject.periods_per_week} tiết</b>
                                            </div>
                                            <div className={c.infoItem}>
                                                <span>Tổ chuyên môn</span>
                                                <b>{detail.subject.department || '—'}</b>
                                            </div>
                                            <div className={c.infoItem}>
                                                <span>Thứ tự hiển thị</span>
                                                <b>{detail.subject.sort_order}</b>
                                            </div>
                                            <div className={c.infoItem}>
                                                <span>Trạng thái</span>
                                                <b className={n(detail.subject.is_active) ? c.txtOk : c.txtWarn}>
                                                    {n(detail.subject.is_active) ? 'Đang hoạt động' : 'Tạm ngưng'}
                                                </b>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mô tả */}
                                    <div className={c.section}>
                                        <h3 className={c.sectionTitle}>Mô tả</h3>
                                        <div className={c.descBox}>
                                            <p>{detail.subject.description?.trim() || 'Chưa có mô tả cho môn học này.'}</p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className={c.dActions}>
                                        <button
                                            className={`${c.btn} ${c.pri}`}
                                            onClick={() => {
                                                setErrs('');
                                                setForm({ ...detail.subject, is_active: !!n(detail.subject.is_active) });
                                            }}
                                        >
                                            Sửa thông tin
                                        </button>
                                        <button
                                            className={c.btn}
                                            disabled={busy}
                                            onClick={() => run(() => subjectApi.toggle(detail.subject.id), reloadDetail)}
                                        >
                                            {n(detail.subject.is_active) ? 'Tạm ngưng môn' : 'Bật lại môn'}
                                        </button>
                                        <button className={`${c.btn} ${c.dng}`} onClick={() => setDel(detail.subject)}>
                                            Xóa môn học
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Form phân công */}
                                    <div className={c.addbox}>
                                        <div className={c.addboxHead}>
                                            <b>Thêm phân công mới</b>
                                            <span>Gán giáo viên phụ trách môn này cho một lớp</span>
                                        </div>
                                        <div className={c.row2}>
                                            <label className={c.field}>
                                                Lớp học
                                                <select
                                                    className={c.input}
                                                    value={add.class_id}
                                                    onChange={(e) => setAdd({ ...add, class_id: e.target.value })}
                                                >
                                                    <option value="">— Chọn lớp —</option>
                                                    {free.map((cl) => (
                                                        <option key={cl.id} value={cl.id}>
                                                            {cl.name} (khối {cl.grade})
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className={c.field}>
                                                Giáo viên
                                                <select
                                                    className={c.input}
                                                    value={add.teacher_id}
                                                    onChange={(e) => setAdd({ ...add, teacher_id: e.target.value })}
                                                >
                                                    <option value="">— Chọn giáo viên —</option>
                                                    {teachersFor(detail.subject.id).map((t) => (
                                                        <option key={t.id} value={t.id}>
                                                            {t.full_name}
                                                            {t.main_subject_id === detail.subject.id ? ' ★' : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        </div>
                                        <div className={c.addboxFoot}>
                                            <small>★ Giáo viên có môn chính trùng với môn này</small>
                                            <button
                                                className={`${c.btn} ${c.pri}`}
                                                disabled={busy || !add.class_id || !add.teacher_id}
                                                onClick={() =>
                                                    run(
                                                        () =>
                                                            subjectApi.assign(
                                                                detail.subject.id,
                                                                Number(add.class_id),
                                                                Number(add.teacher_id),
                                                            ),
                                                        reloadDetail,
                                                    )
                                                }
                                            >
                                                Phân công
                                            </button>
                                        </div>
                                    </div>

                                    {/* Danh sách phân công */}
                                    <div className={c.section}>
                                        <h3 className={c.sectionTitle}>
                                            Danh sách lớp đang học
                                            <em>{detail.assignments.length}</em>
                                        </h3>

                                        {detail.assignments.length === 0 ? (
                                            <div className={c.emptyAssign}>
                                                <div className={c.emptyIcon}>📋</div>
                                                <b>Chưa có phân công</b>
                                                <p>Môn này chưa được gán cho lớp nào trong năm học hiện tại.</p>
                                            </div>
                                        ) : (
                                            <div className={c.assignList}>
                                                {detail.assignments.map((a: Assignment) => (
                                                    <div key={a.id} className={c.assignCard}>
                                                        <div className={c.assignLeft}>
                                                            <b>Lớp {a.class_name}</b>
                                                            <span>
                                                    Khối {a.grade}
                                                                {n(a.slots) > 0 ? ` · ${n(a.slots)} tiết TKB` : ''}
                                                </span>
                                                        </div>
                                                        <div className={c.assignRight}>
                                                            <select
                                                                className={c.input}
                                                                value={a.teacher_id}
                                                                disabled={busy}
                                                                aria-label={`Giáo viên lớp ${a.class_name}`}
                                                                onChange={(e) =>
                                                                    run(
                                                                        () =>
                                                                            subjectApi.reassign(
                                                                                detail.subject.id,
                                                                                a.id,
                                                                                Number(e.target.value),
                                                                            ),
                                                                        reloadDetail,
                                                                    )
                                                                }
                                                            >
                                                                {teachersFor(detail.subject.id).map((t) => (
                                                                    <option key={t.id} value={t.id}>
                                                                        {t.full_name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <button
                                                                className={`${c.btn} ${c.sm} ${c.btnGhost}`}
                                                                disabled={busy}
                                                                onClick={() =>
                                                                    run(
                                                                        () => subjectApi.unassign(detail.subject.id, a.id),
                                                                        reloadDetail,
                                                                    )
                                                                }
                                                            >
                                                                Gỡ
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </aside>
                </>
            )}

            {form && (
                <div className={c.ov} style={{ zIndex: 120 }} onMouseDown={(e) => e.target === e.currentTarget && setForm(null)}>
                    <form className={c.modal} onSubmit={save} role="dialog" aria-modal="true" aria-label="Môn học">
                        <div className={c.mh}><h2>{form.id ? 'Sửa môn học' : 'Thêm môn học'}</h2><button type="button" className={c.x} aria-label="Đóng" onClick={() => setForm(null)}>✕</button></div>
                        <div className={c.mb}>
                            <div className={c.row2}>
                                <label className={c.field}>Mã môn *<input className={c.input} required maxLength={10} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="VD: TOAN" /></label>
                                <label className={c.field}>Tên môn *<input className={c.input} required maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: Toán" /></label>
                            </div>
                            <div className={c.row2}>
                                <label className={c.field}>Hình thức đánh giá
                                    <select className={c.input} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                                <label className={c.field}>Số tiết / tuần *<input className={c.input} type="number" min={1} max={10} required value={form.periods_per_week} onChange={(e) => setForm({ ...form, periods_per_week: Number(e.target.value) })} /></label>
                            </div>
                            <div className={c.row2}>
                                <label className={c.field}>Tổ chuyên môn<input className={c.input} list="dept-list" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></label>
                                <label className={c.field}>Thứ tự hiển thị<input className={c.input} type="number" min={1} max={250} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></label>
                            </div>
                            <datalist id="dept-list">{Array.from(new Set([...DEPTS, ...depts.map((d) => d.name)])).map((d) => <option key={d} value={d} />)}</datalist>
                            <div className={c.row2}>
                                <label className={c.field}>Màu nhận diện<input className={c.input} type="color" style={{ height: 42, padding: 4 }} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></label>
                                <label className={c.field}>Trạng thái<select className={c.input} value={form.is_active ? '1' : '0'} onChange={(e) => setForm({ ...form, is_active: e.target.value === '1' })}><option value="1">Đang hoạt động</option><option value="0">Tạm ngưng</option></select></label>
                            </div>
                            <label className={c.field}>Mô tả<textarea className={c.input} rows={3} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
                            {errs && <p className={c.fe} role="alert">{errs}</p>}
                        </div>
                        <div className={c.mf}><button type="button" className={c.btn} onClick={() => setForm(null)}>Hủy</button><button className={`${c.btn} ${c.pri}`} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu môn học'}</button></div>
                    </form>
                </div>
            )}

            {del && (
                <div className={c.ov} style={{ zIndex: 130 }} onMouseDown={(e) => e.target === e.currentTarget && setDel(null)}>
                    <div className={c.modal} style={{ maxWidth: 460 }} role="alertdialog" aria-modal="true">
                        <div className={c.mh}><h2>Xóa môn “{del.name}”?</h2></div>
                        <div className={c.mb}><p>Hành động này không thể hoàn lại. Hệ thống sẽ từ chối nếu môn còn được phân công cho lớp hoặc còn giáo viên có môn chính là môn này.</p></div>
                        <div className={c.mf}><button className={c.btn} onClick={() => setDel(null)}>Hủy</button>
                            <button className={`${c.btn} ${c.dng}`} disabled={busy} onClick={() => run(() => subjectApi.remove(del.id), () => { setDel(null); setDetail(null); return load(); })}>Xóa</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}