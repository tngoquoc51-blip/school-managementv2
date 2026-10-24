'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../../_lib/api';
import {
    Card, Empty, ErrorBox, Loading, Modal, PageHead, Pager, Pill, Toast,
    fmtDT, useApi, useToast,
} from '../../_components/ui';
import './requests.css';

const TABS: { key: string; label: string; tone: string }[] = [
    { key: 'pending', label: 'Chờ duyệt', tone: 'pri' },
    { key: 'approved', label: 'Đã xử lý', tone: 'ok' },
    { key: 'rejected', label: 'Đã từ chối', tone: 'err' },
    { key: 'cancelled', label: 'Học sinh hủy', tone: 'mut' },
];

type Mode = 'approve' | 'reject' | null;

export default function ProfileRequestsPage() {
    const [tab, setTab] = useState('pending');
    const [page, setPage] = useState(1);
    const [q, setQ] = useState('');
    const [fieldFilter, setFieldFilter] = useState('all');
    const [mode, setMode] = useState<Mode>(null);
    const [target, setTarget] = useState<any>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [detail, setDetail] = useState<any>(null);
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
        let list = data?.items || [];
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
        return list;
    }, [data, q, fieldFilter]);

    const counts = data?.counts || {};
    const pendingN = counts.pending ?? 0;

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
            toast.ok(res.message || (mode === 'approve' ? 'Đã duyệt & cập nhật hồ sơ.' : 'Đã từ chối đề nghị.'));
            setTarget(null);
            setMode(null);
            setDetail(null);
            setNote('');
            reload();
        } catch (e: any) {
            toast.fail(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="prq">
            <PageHead
                title="Duyệt hồ sơ học sinh"
                sub="Học sinh đề nghị sửa thông tin quan trọng (ngày sinh, phụ huynh, hộ khẩu…). Giáo vụ duyệt để hệ thống cập nhật và lưu nhật ký."
            />

            {/* Thống kê nhanh */}
            <div className="prq-stats">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        className={`prq-stat ${tab === t.key ? 'on' : ''} tone-${t.tone}`}
                        onClick={() => {
                            setTab(t.key);
                            setPage(1);
                        }}
                    >
                        <span className="prq-stat-n">{counts[t.key] ?? 0}</span>
                        <span className="prq-stat-l">{t.label}</span>
                    </button>
                ))}
            </div>

            {/* Thanh công cụ */}
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
                    aria-label="Lọc theo trường"
                >
                    <option value="all">Tất cả trường dữ liệu</option>
                    {fieldOptions.map((f) => (
                        <option key={f} value={f}>
                            {f}
                        </option>
                    ))}
                </select>
                <button type="button" className="prq-refresh" onClick={() => reload()} title="Tải lại">
                    ↻ Làm mới
                </button>
                {pendingN > 0 && tab === 'pending' && (
                    <span className="prq-hint">
                        Có <b>{pendingN}</b> đề nghị cần xử lý
                    </span>
                )}
            </div>

            {/* Tabs trạng thái */}
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
                    <Empty text={q || fieldFilter !== 'all' ? 'Không có kết quả khớp bộ lọc.' : 'Không có yêu cầu nào.'} />
                ) : (
                    <>
                        <ul className="prq-list">
                            {items.map((r: any) => (
                                <li key={r.id} className="prq-item">
                                    <div className="prq-item-head">
                                        <div className="prq-who">
                                            <div className="prq-av">
                                                {(r.student?.name || '?').charAt(0)}
                                            </div>
                                            <div>
                                                <Link
                                                    href={`/academic/students/${r.student?.code}`}
                                                    className="prq-name"
                                                >
                                                    {r.student?.name}
                                                </Link>
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
                            {target.student?.class ?? '—'}) đề nghị đổi trường{' '}
                            <b>{target.field_label}</b>.
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
                                        : 'VD: Vui lòng mang giấy khai sinh đến Văn phòng Giáo vụ để đối chiếu.'
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