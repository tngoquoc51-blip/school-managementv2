'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../../_lib/api';
import {
    Card,
    Empty,
    ErrorBox,
    Loading,
    Modal,
    PageHead,
    Pager,
    Pill,
    Toast,
    fmtDT,
    useApi,
    useToast,
} from '../../_components/ui';
import './requests.css';

const TABS: { key: string; label: string; tone: string }[] = [
    { key: 'pending', label: 'Chờ duyệt', tone: 'pri' },
    { key: 'approved', label: 'Đã xử lý', tone: 'ok' },
    { key: 'rejected', label: 'Đã từ chối', tone: 'err' },
    { key: 'cancelled', label: 'Học sinh hủy', tone: 'mut' },
];

type Mode = 'approve' | 'reject' | null;
type SortKey = 'newest' | 'oldest' | 'name';

export default function ProfileRequestsPage() {
    const [tab, setTab] = useState('pending');
    const [page, setPage] = useState(1);
    const [q, setQ] = useState('');
    const [fieldFilter, setFieldFilter] = useState('all');
    const [sort, setSort] = useState<SortKey>('newest');
    const [mode, setMode] = useState<Mode>(null);
    const [target, setTarget] = useState<any>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [detail, setDetail] = useState<any>(null);
    const [selected, setSelected] = useState<number[]>([]);
    const toast = useToast();

    const { data, err, loading, reload } = useApi<any>(
        `profile-requests?status=${tab}&page=${page}`
    );

    const fieldOptions = useMemo(() => {
        const set = new Set<string>();
        (data?.items || []).forEach((r: any) => {
            if (r.field_label) set.add(r.field_label);
        });
        return Array.from(set);
    }, [data]);

    const items = useMemo(() => {
        let list = [...(data?.items || [])];
        const key = q.trim().toLowerCase();
        if (key) {
            list = list.filter(
                (r: any) =>
                    r.student?.name?.toLowerCase().includes(key) ||
                    r.student?.code?.toLowerCase().includes(key) ||
                    r.student?.class?.toLowerCase().includes(key) ||
                    r.field_label?.toLowerCase().includes(key) ||
                    r.reason?.toLowerCase().includes(key)
            );
        }
        if (fieldFilter !== 'all') {
            list = list.filter((r: any) => r.field_label === fieldFilter);
        }
        list.sort((a: any, b: any) => {
            if (sort === 'name') {
                return (a.student?.name || '').localeCompare(b.student?.name || '', 'vi');
            }
            const ta = new Date(a.created_at || 0).getTime();
            const tb = new Date(b.created_at || 0).getTime();
            return sort === 'oldest' ? ta - tb : tb - ta;
        });
        return list;
    }, [data, q, fieldFilter, sort]);

    const counts = data?.counts || {};
    const pendingN = counts.pending ?? 0;

    const toggleSelect = (id: number) => {
        setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const toggleAll = () => {
        if (selected.length === items.length) setSelected([]);
        else setSelected(items.map((r: any) => r.id));
    };

    const openAct = (r: any, m: Mode) => {
        setTarget(r);
        setMode(m);
        setNote('');
    };

    const submitAct = async () => {
        if (!target || !mode) return;
        if (mode === 'reject' && note.trim().length < 3) {
            toast.fail('Nhập lý do từ chối (ít nhất 3 ký tự).');
            return;
        }
        setBusy(true);
        try {
            const res = await api<any>(`profile-requests/${target.id}/review`, {
                method: 'POST',
                body: { action: mode, note: note.trim() },
            });
            toast.ok(
                res.message ||
                (mode === 'approve' ? 'Đã duyệt & cập nhật hồ sơ.' : 'Đã từ chối đề nghị.')
            );
            setTarget(null);
            setMode(null);
            setDetail(null);
            setNote('');
            setSelected((s) => s.filter((id) => id !== target.id));
            reload();
        } catch (e: any) {
            toast.fail(e.message);
        } finally {
            setBusy(false);
        }
    };

    const bulkApprove = async () => {
        if (!selected.length) return;
        if (!confirm(`Duyệt ${selected.length} đề nghị đã chọn?`)) return;
        setBusy(true);
        let ok = 0;
        for (const id of selected) {
            try {
                await api(`profile-requests/${id}/review`, {
                    method: 'POST',
                    body: { action: 'approve', note: 'Duyệt hàng loạt' },
                });
                ok++;
            } catch {
                /* bỏ qua từng cái lỗi */
            }
        }
        setBusy(false);
        setSelected([]);
        toast.ok(`Đã duyệt ${ok}/${selected.length} đề nghị.`);
        reload();
    };

    const exportCsv = () => {
        const rows = [
            ['Mã HS', 'Họ tên', 'Lớp', 'Trường', 'Cũ', 'Mới', 'Lý do', 'Trạng thái', 'Gửi lúc'].join(','),
            ...items.map((r: any) =>
                [
                    r.student?.code,
                    `"${r.student?.name || ''}"`,
                    r.student?.class,
                    `"${r.field_label || ''}"`,
                    `"${r.old_value || ''}"`,
                    `"${r.new_value || ''}"`,
                    `"${(r.reason || '').replace(/"/g, '""')}"`,
                    r.status,
                    r.created_at,
                ].join(',')
            ),
        ].join('\n');
        const blob = new Blob(['\ufeff' + rows], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `duyet-ho-so-${tab}-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="prq">
            <div className="prq-head-row">
                <PageHead
                    title="Duyệt hồ sơ học sinh"
                    sub="Học sinh đề nghị sửa thông tin quan trọng (ngày sinh, phụ huynh, hộ khẩu…). Giáo vụ duyệt để hệ thống cập nhật và lưu nhật ký."
                />
                <div className="prq-head-actions">
                    <button type="button" className="prq-btn ghost" onClick={exportCsv}>
                        Xuất CSV
                    </button>
                    <button type="button" className="prq-btn ghost" onClick={() => reload()}>
                        ↻ Làm mới
                    </button>
                    <Link href="/academic/students" className="prq-btn pri">
                        + Hồ sơ học sinh
                    </Link>
                </div>
            </div>

            {/* Thống kê */}
            <div className="prq-stats">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        className={`prq-stat ${tab === t.key ? 'on' : ''} tone-${t.tone}`}
                        onClick={() => {
                            setTab(t.key);
                            setPage(1);
                            setSelected([]);
                        }}
                    >
                        <span className="prq-stat-n">{counts[t.key] ?? 0}</span>
                        <span className="prq-stat-l">{t.label}</span>
                    </button>
                ))}
            </div>

            {/* Chức năng con */}
            <div className="prq-features">
                <button type="button" className="prq-feat" onClick={() => setTab('pending')}>
                    <b>Hàng chờ</b>
                    <span>Xử lý đề nghị mới</span>
                </button>
                <button
                    type="button"
                    className="prq-feat"
                    onClick={() => {
                        setTab('approved');
                        setPage(1);
                    }}
                >
                    <b>Lịch sử duyệt</b>
                    <span>Đã cập nhật hồ sơ</span>
                </button>
                <button type="button" className="prq-feat" onClick={exportCsv}>
                    <b>Báo cáo CSV</b>
                    <span>Xuất danh sách hiện tại</span>
                </button>
                <Link href="/academic/students" className="prq-feat">
                    <b>Tra cứu hồ sơ</b>
                    <span>Mở danh sách học sinh</span>
                </Link>
            </div>

            {/* Toolbar */}
            <div className="prq-toolbar">
                <div className="prq-search">
                    <span className="prq-search-ico" aria-hidden>
                        ⌕
                    </span>
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Tìm theo tên, mã HS, lớp, trường dữ liệu…"
                        aria-label="Tìm kiếm"
                    />
                </div>
                <select
                    className="prq-select"
                    value={fieldFilter}
                    onChange={(e) => setFieldFilter(e.target.value)}
                >
                    <option value="all">Tất cả trường dữ liệu</option>
                    {fieldOptions.map((f) => (
                        <option key={f} value={f}>
                            {f}
                        </option>
                    ))}
                </select>
                <select
                    className="prq-select"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                >
                    <option value="newest">Mới nhất</option>
                    <option value="oldest">Cũ nhất</option>
                    <option value="name">Theo tên HS</option>
                </select>
                {tab === 'pending' && selected.length > 0 && (
                    <button type="button" className="prq-btn ok" disabled={busy} onClick={bulkApprove}>
                        Duyệt hàng loạt ({selected.length})
                    </button>
                )}
                {pendingN > 0 && tab === 'pending' && (
                    <span className="prq-hint">
                        Có <b>{pendingN}</b> đề nghị cần xử lý
                    </span>
                )}
            </div>

            {/* Tabs */}
            <div className="prq-tabs" role="tablist">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.key}
                        className={`prq-tab ${tab === t.key ? 'on' : ''}`}
                        onClick={() => {
                            setTab(t.key);
                            setPage(1);
                            setSelected([]);
                        }}
                    >
                        {t.label}
                        <em>{counts[t.key] ?? 0}</em>
                    </button>
                ))}
            </div>

            <Card pad={false}>
                {err ? (
                    <div className="prq-pad">
                        <ErrorBox msg={err} retry={reload} />
                    </div>
                ) : loading && !data ? (
                    <Loading />
                ) : data && data.ready === false ? (
                    <Empty text="Chưa tạo bảng hồ sơ. Hãy chạy file SQL hồ sơ học sinh." />
                ) : !items.length ? (
                    <Empty
                        text={
                            q || fieldFilter !== 'all'
                                ? 'Không có kết quả khớp bộ lọc.'
                                : 'Không có yêu cầu nào.'
                        }
                    />
                ) : (
                    <>
                        {tab === 'pending' && (
                            <div className="prq-bulk-bar">
                                <label className="prq-check">
                                    <input
                                        type="checkbox"
                                        checked={selected.length === items.length && items.length > 0}
                                        onChange={toggleAll}
                                    />
                                    Chọn tất cả trang này
                                </label>
                                <span className="prq-bulk-n">{selected.length} đã chọn</span>
                            </div>
                        )}
                        <ul className="prq-list">
                            {items.map((r: any) => (
                                <li key={r.id} className="prq-item">
                                    <div className="prq-item-head">
                                        <div className="prq-who">
                                            {tab === 'pending' && (
                                                <input
                                                    type="checkbox"
                                                    className="prq-item-check"
                                                    checked={selected.includes(r.id)}
                                                    onChange={() => toggleSelect(r.id)}
                                                />
                                            )}
                                            <div className="prq-av">
                                                {(r.student?.name || '?').charAt(0)}
                                            </div>
                                            <div>
                                                <button
                                                    type="button"
                                                    className="prq-name"
                                                    onClick={() => setDetail(r)}
                                                >
                                                    {r.student?.name}
                                                </button>
                                                <div className="prq-meta">
                                                    <span>{r.student?.code}</span>
                                                    <span>·</span>
                                                    <span>Lớp {r.student?.class ?? '—'}</span>
                                                    <span>·</span>
                                                    <span>Gửi {fmtDT(r.created_at)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="prq-tags">
                                            <Pill tone="pri">{r.field_label}</Pill>
                                            {tab === 'pending' && <span className="prq-dot">Mới</span>}
                                        </div>
                                    </div>

                                    <div className="prq-diff">
                                        <div className="prq-diff-box old">
                                            <small>Hiện tại</small>
                                            <strong>{r.old_value || '(trống)'}</strong>
                                        </div>
                                        <div className="prq-arrow" aria-hidden>
                                            →
                                        </div>
                                        <div className="prq-diff-box new">
                                            <small>Đề nghị đổi thành</small>
                                            <strong>{r.new_value}</strong>
                                        </div>
                                    </div>

                                    <div className="prq-reason">
                                        <span>Lý do học sinh:</span> {r.reason || '—'}
                                    </div>

                                    <div className="prq-actions">
                                        <button
                                            type="button"
                                            className="prq-btn ghost"
                                            onClick={() => setDetail(r)}
                                        >
                                            Xem chi tiết
                                        </button>
                                        <Link
                                            href={`/academic/students/${r.student?.code}`}
                                            className="prq-btn ghost"
                                        >
                                            Hồ sơ học sinh
                                        </Link>
                                        {r.status === 'pending' && (
                                            <>
                                                <button
                                                    type="button"
                                                    className="prq-btn ok"
                                                    disabled={busy}
                                                    onClick={() => openAct(r, 'approve')}
                                                >
                                                    Duyệt &amp; cập nhật
                                                </button>
                                                <button
                                                    type="button"
                                                    className="prq-btn danger"
                                                    disabled={busy}
                                                    onClick={() => openAct(r, 'reject')}
                                                >
                                                    Từ chối
                                                </button>
                                            </>
                                        )}
                                        {r.status !== 'pending' && (
                                            <div className="prq-result">
                                                <Pill
                                                    tone={
                                                        r.status === 'approved'
                                                            ? 'ok'
                                                            : r.status === 'rejected'
                                                                ? 'err'
                                                                : 'mut'
                                                    }
                                                >
                                                    {r.status === 'approved'
                                                        ? 'Đã duyệt'
                                                        : r.status === 'rejected'
                                                            ? 'Đã từ chối'
                                                            : 'Đã hủy'}
                                                </Pill>
                                                {r.reviewed_by && <span> · bởi {r.reviewed_by}</span>}
                                                {r.reviewed_at && <span> · {fmtDT(r.reviewed_at)}</span>}
                                                {r.review_note && (
                                                    <span className="prq-note"> · “{r.review_note}”</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <div className="prq-pager">
                            <Pager page={data.page} pages={data.pages} onChange={setPage} />
                        </div>
                    </>
                )}
            </Card>

            {/* Modal duyệt / từ chối */}
            {target && mode && (
                <Modal
                    title={mode === 'approve' ? 'Xác nhận duyệt đề nghị' : 'Từ chối đề nghị'}
                    onClose={() => {
                        setTarget(null);
                        setMode(null);
                    }}
                    foot={
                        <>
                            <button
                                type="button"
                                className="prq-btn ghost"
                                onClick={() => {
                                    setTarget(null);
                                    setMode(null);
                                }}
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                className={`prq-btn ${mode === 'approve' ? 'ok' : 'danger'}`}
                                disabled={busy || (mode === 'reject' && note.trim().length < 3)}
                                onClick={submitAct}
                            >
                                {busy
                                    ? 'Đang xử lý…'
                                    : mode === 'approve'
                                        ? 'Duyệt & cập nhật hồ sơ'
                                        : 'Xác nhận từ chối'}
                            </button>
                        </>
                    }
                >
                    <div className="prq-modal-body">
                        <p>
                            Học sinh <b>{target.student?.name}</b> ({target.student?.code} · Lớp{' '}
                            {target.student?.class ?? '—'}) đề nghị đổi <b>{target.field_label}</b>.
                        </p>
                        <div className="prq-diff compact">
                            <div className="prq-diff-box old">
                                <small>Hiện tại</small>
                                <strong>{target.old_value || '(trống)'}</strong>
                            </div>
                            <div className="prq-arrow">→</div>
                            <div className="prq-diff-box new">
                                <small>Giá trị mới</small>
                                <strong>{target.new_value}</strong>
                            </div>
                        </div>
                        <p className="prq-modal-reason">
                            <b>Lý do HS:</b> {target.reason || '—'}
                        </p>
                        <label className="prq-field">
                            <span>
                                {mode === 'approve'
                                    ? 'Ghi chú nội bộ (tuỳ chọn)'
                                    : 'Lý do từ chối (học sinh sẽ thấy) *'}
                            </span>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder={
                                    mode === 'approve'
                                        ? 'VD: Đã đối chiếu với giấy tờ tại văn phòng.'
                                        : 'VD: Vui lòng mang giấy khai sinh đến Văn phòng Giáo vụ.'
                                }
                                rows={3}
                                autoFocus={mode === 'reject'}
                            />
                        </label>
                        {mode === 'approve' && (
                            <p className="prq-warn">
                                Sau khi duyệt, hệ thống cập nhật hồ sơ học sinh và ghi nhật ký chỉnh sửa.
                            </p>
                        )}
                    </div>
                </Modal>
            )}

            {/* Modal chi tiết */}
            {detail && !mode && (
                <Modal
                    title="Chi tiết đề nghị"
                    onClose={() => setDetail(null)}
                    foot={
                        <>
                            <button type="button" className="prq-btn ghost" onClick={() => setDetail(null)}>
                                Đóng
                            </button>
                            <Link
                                href={`/academic/students/${detail.student?.code}`}
                                className="prq-btn ghost"
                            >
                                Mở hồ sơ
                            </Link>
                            {detail.status === 'pending' && (
                                <>
                                    <button
                                        type="button"
                                        className="prq-btn danger"
                                        onClick={() => {
                                            setDetail(null);
                                            openAct(detail, 'reject');
                                        }}
                                    >
                                        Từ chối
                                    </button>
                                    <button
                                        type="button"
                                        className="prq-btn ok"
                                        onClick={() => {
                                            setDetail(null);
                                            openAct(detail, 'approve');
                                        }}
                                    >
                                        Duyệt &amp; cập nhật
                                    </button>
                                </>
                            )}
                        </>
                    }
                >
                    <div className="prq-modal-body">
                        <dl className="prq-dl">
                            <div>
                                <dt>Học sinh</dt>
                                <dd>
                                    {detail.student?.name} · {detail.student?.code}
                                </dd>
                            </div>
                            <div>
                                <dt>Lớp</dt>
                                <dd>{detail.student?.class ?? '—'}</dd>
                            </div>
                            <div>
                                <dt>Trường dữ liệu</dt>
                                <dd>{detail.field_label}</dd>
                            </div>
                            <div>
                                <dt>Thời gian gửi</dt>
                                <dd>{fmtDT(detail.created_at)}</dd>
                            </div>
                            <div>
                                <dt>Trạng thái</dt>
                                <dd>{detail.status}</dd>
                            </div>
                            {detail.reviewed_by && (
                                <div>
                                    <dt>Người xử lý</dt>
                                    <dd>{detail.reviewed_by}</dd>
                                </div>
                            )}
                        </dl>
                        <div className="prq-diff">
                            <div className="prq-diff-box old">
                                <small>Hiện tại</small>
                                <strong>{detail.old_value || '(trống)'}</strong>
                            </div>
                            <div className="prq-arrow">→</div>
                            <div className="prq-diff-box new">
                                <small>Đề nghị</small>
                                <strong>{detail.new_value}</strong>
                            </div>
                        </div>
                        <p>
                            <b>Lý do:</b> {detail.reason || '—'}
                        </p>
                        {detail.review_note && (
                            <p>
                                <b>Ghi chú xử lý:</b> {detail.review_note}
                            </p>
                        )}
                    </div>
                </Modal>
            )}

            <Toast t={toast.t} clear={toast.clear} />
        </div>
    );
}