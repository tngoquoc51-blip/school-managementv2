'use client';

import { useMemo, useState } from 'react';
import { api } from '../_lib/api';
import {
    Card,
    Empty,
    ErrorBox,
    Loading,
    Modal,
    PageHead,
    Pager,
    Toast,
    fmtDT,
    useApi,
    useToast,
} from '../_components/ui';
import './notifications.css';

type TabKey = 'all' | 'unread' | 'read' | 'sent';

const TABS: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'unread', label: 'Chưa đọc' },
    { key: 'read', label: 'Đã đọc' },
    { key: 'sent', label: 'Đã gửi' },
];

const TYPE_LABEL: Record<string, string> = {
    system: 'Hệ thống',
    profile: 'Hồ sơ HS',
    grade: 'Điểm',
    schedule: 'TKB / Lịch thi',
    fee: 'Học phí',
    general: 'Chung',
};

export default function AcademicNotificationsPage() {
    const [tab, setTab] = useState<TabKey>('all');
    const [page, setPage] = useState(1);
    const [q, setQ] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [detail, setDetail] = useState<any>(null);
    const [compose, setCompose] = useState(false);
    const [busy, setBusy] = useState(false);
    const toast = useToast();

    // form soạn thông báo
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [nType, setNType] = useState('general');
    const [audience, setAudience] = useState('staff'); // staff | students | all
    const [priority, setPriority] = useState('normal');

    const { data, err, loading, reload } = useApi<any>(
        `notifications?status=${tab}&page=${page}&type=${typeFilter === 'all' ? '' : typeFilter}&q=${encodeURIComponent(q)}`
    );

    const items = data?.items || [];
    const counts = data?.counts || { all: 0, unread: 0, read: 0, sent: 0 };

    const filtered = useMemo(() => {
        const key = q.trim().toLowerCase();
        if (!key) return items;
        return items.filter(
            (n: any) =>
                n.title?.toLowerCase().includes(key) ||
                n.body?.toLowerCase().includes(key) ||
                n.type?.toLowerCase().includes(key)
        );
    }, [items, q]);

    const markRead = async (id: number) => {
        try {
            await api(`notifications/${id}/read`, { method: 'POST' });
            reload();
        } catch (e: any) {
            toast.fail(e.message);
        }
    };

    const markAllRead = async () => {
        setBusy(true);
        try {
            await api('notifications/read-all', { method: 'POST' });
            toast.ok('Đã đánh dấu tất cả là đã đọc.');
            reload();
        } catch (e: any) {
            toast.fail(e.message);
        } finally {
            setBusy(false);
        }
    };

    const removeOne = async (id: number) => {
        if (!confirm('Xóa thông báo này?')) return;
        try {
            await api(`notifications/${id}`, { method: 'DELETE' });
            toast.ok('Đã xóa.');
            setDetail(null);
            reload();
        } catch (e: any) {
            toast.fail(e.message);
        }
    };

    const sendNotif = async () => {
        if (title.trim().length < 3 || body.trim().length < 3) {
            toast.fail('Tiêu đề và nội dung tối thiểu 3 ký tự.');
            return;
        }
        setBusy(true);
        try {
            await api('notifications', {
                method: 'POST',
                body: {
                    title: title.trim(),
                    body: body.trim(),
                    type: nType,
                    audience,
                    priority,
                },
            });
            toast.ok('Đã gửi thông báo.');
            setCompose(false);
            setTitle('');
            setBody('');
            setTab('sent');
            reload();
        } catch (e: any) {
            toast.fail(e.message);
        } finally {
            setBusy(false);
        }
    };

    const openDetail = async (n: any) => {
        setDetail(n);
        if (!n.is_read && n.direction !== 'out') {
            await markRead(n.id);
        }
    };

    return (
        <div className="ntf">
            <div className="ntf-head">
                <PageHead
                    title="Thông báo"
                    sub="Nhận thông báo hệ thống, đề nghị hồ sơ, lịch thi… và gửi thông báo tới giáo viên / học sinh."
                />
                <div className="ntf-head-actions">
                    <button type="button" className="ntf-btn ghost" disabled={busy} onClick={markAllRead}>
                        Đánh dấu đã đọc hết
                    </button>
                    <button type="button" className="ntf-btn pri" onClick={() => setCompose(true)}>
                        + Soạn thông báo
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="ntf-stats">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        className={`ntf-stat ${tab === t.key ? 'on' : ''}`}
                        onClick={() => {
                            setTab(t.key);
                            setPage(1);
                        }}
                    >
                        <span className="ntf-stat-n">{counts[t.key] ?? 0}</span>
                        <span className="ntf-stat-l">{t.label}</span>
                    </button>
                ))}
            </div>

            {/* Chức năng con */}
            <div className="ntf-features">
                <button type="button" className="ntf-feat" onClick={() => setTab('unread')}>
                    <b>Hộp thư đến</b>
                    <span>Thông báo chưa đọc</span>
                </button>
                <button type="button" className="ntf-feat" onClick={() => setCompose(true)}>
                    <b>Gửi thông báo</b>
                    <span>GV / HS / Toàn trường</span>
                </button>
                <button type="button" className="ntf-feat" onClick={() => setTab('sent')}>
                    <b>Đã gửi</b>
                    <span>Lịch sử phát hành</span>
                </button>
                <button type="button" className="ntf-feat" onClick={() => reload()}>
                    <b>Làm mới</b>
                    <span>Tải lại danh sách</span>
                </button>
            </div>

            {/* Toolbar */}
            <div className="ntf-toolbar">
                <div className="ntf-search">
                    <span>⌕</span>
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Tìm tiêu đề, nội dung…"
                    />
                </div>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                    <option value="all">Mọi loại</option>
                    {Object.entries(TYPE_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                            {v}
                        </option>
                    ))}
                </select>
                <div className="ntf-tabs">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            className={tab === t.key ? 'on' : ''}
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
            </div>

            <Card pad={false}>
                {err ? (
                    <div className="ntf-pad">
                        <ErrorBox msg={err} retry={reload} />
                    </div>
                ) : loading && !data ? (
                    <Loading />
                ) : !filtered.length ? (
                    <Empty text="Không có thông báo nào." />
                ) : (
                    <>
                        <ul className="ntf-list">
                            {filtered.map((n: any) => (
                                <li
                                    key={n.id}
                                    className={`ntf-item ${!n.is_read && n.direction !== 'out' ? 'unread' : ''}`}
                                    onClick={() => openDetail(n)}
                                >
                                    <div className={`ntf-ico type-${n.type || 'general'}`}>
                                        {(TYPE_LABEL[n.type] || 'TB').slice(0, 2)}
                                    </div>
                                    <div className="ntf-body">
                                        <div className="ntf-row">
                                            <strong>{n.title}</strong>
                                            <time>{fmtDT(n.created_at)}</time>
                                        </div>
                                        <p>{n.body}</p>
                                        <div className="ntf-meta">
                                            <span className="ntf-chip">{TYPE_LABEL[n.type] || n.type}</span>
                                            {n.priority === 'high' && (
                                                <span className="ntf-chip high">Ưu tiên cao</span>
                                            )}
                                            {n.direction === 'out' && (
                                                <span className="ntf-chip out">Đã gửi · {n.audience_label || n.audience}</span>
                                            )}
                                            {!n.is_read && n.direction !== 'out' && (
                                                <span className="ntf-dot">Chưa đọc</span>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        {data?.pages > 1 && (
                            <div className="ntf-pager">
                                <Pager page={data.page} pages={data.pages} onChange={setPage} />
                            </div>
                        )}
                    </>
                )}
            </Card>

            {/* Chi tiết */}
            {detail && (
                <Modal
                    title="Chi tiết thông báo"
                    onClose={() => setDetail(null)}
                    foot={
                        <>
                            <button type="button" className="ntf-btn ghost" onClick={() => setDetail(null)}>
                                Đóng
                            </button>
                            <button
                                type="button"
                                className="ntf-btn danger"
                                onClick={() => removeOne(detail.id)}
                            >
                                Xóa
                            </button>
                        </>
                    }
                >
                    <div className="ntf-detail">
                        <h3>{detail.title}</h3>
                        <div className="ntf-meta">
                            <span className="ntf-chip">{TYPE_LABEL[detail.type] || detail.type}</span>
                            <span>{fmtDT(detail.created_at)}</span>
                        </div>
                        <p className="ntf-detail-body">{detail.body}</p>
                        {detail.sender_name && (
                            <p className="ntf-from">
                                Người gửi: <b>{detail.sender_name}</b>
                            </p>
                        )}
                    </div>
                </Modal>
            )}

            {/* Soạn thông báo */}
            {compose && (
                <Modal
                    title="Soạn thông báo mới"
                    onClose={() => setCompose(false)}
                    foot={
                        <>
                            <button type="button" className="ntf-btn ghost" onClick={() => setCompose(false)}>
                                Hủy
                            </button>
                            <button type="button" className="ntf-btn pri" disabled={busy} onClick={sendNotif}>
                                {busy ? 'Đang gửi…' : 'Gửi thông báo'}
                            </button>
                        </>
                    }
                >
                    <div className="ntf-compose">
                        <label>
                            <span>Tiêu đề *</span>
                            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Lịch họp tổ chuyên môn" />
                        </label>
                        <label>
                            <span>Nội dung *</span>
                            <textarea
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                rows={4}
                                placeholder="Nhập nội dung thông báo…"
                            />
                        </label>
                        <div className="ntf-compose-grid">
                            <label>
                                <span>Loại</span>
                                <select value={nType} onChange={(e) => setNType(e.target.value)}>
                                    {Object.entries(TYPE_LABEL).map(([k, v]) => (
                                        <option key={k} value={k}>
                                            {v}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                <span>Đối tượng</span>
                                <select value={audience} onChange={(e) => setAudience(e.target.value)}>
                                    <option value="staff">Cán bộ / Giáo viên</option>
                                    <option value="students">Học sinh</option>
                                    <option value="all">Toàn trường</option>
                                </select>
                            </label>
                            <label>
                                <span>Mức ưu tiên</span>
                                <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                                    <option value="normal">Bình thường</option>
                                    <option value="high">Cao</option>
                                </select>
                            </label>
                        </div>
                    </div>
                </Modal>
            )}

            <Toast t={toast.t} clear={toast.clear} />
        </div>
    );
}