'use client';

import { useCallback, useEffect, useState } from 'react';
import DiffView from './DiffView';
import Icon from './Icon';
import { logsApi } from './logsApi';
import { useToast } from './ToastProvider';
import { Chip, LevelBadge, Skeleton } from './ui';
import type { EventDetail, EventFilters, LogEvent } from './types';
import { ACTOR_TYPE, CATEGORY_LABEL, actionLabel, actorLabel, copyText, fmtFull, fmtMs, timeAgo } from './utils';

interface Props {
    id: number;
    onClose: () => void;
    onNavigate: (id: number) => void;
    onFilter: (patch: Partial<EventFilters>) => void;
    onPinChange?: (id: number, pinned: boolean) => void;
    neighbors?: { prev: number | null; next: number | null };
}

type RelTab = 'same_request' | 'same_actor' | 'same_ip';
const REL_LABEL: Record<RelTab, string> = { same_request: 'Cùng yêu cầu', same_actor: 'Cùng người thực hiện', same_ip: 'Cùng IP' };

export default function EventDrawer({ id, onClose, onNavigate, onFilter, onPinChange, neighbors }: Props) {
    const toast = useToast();
    const [d, setD] = useState<EventDetail | null>(null);
    const [err, setErr] = useState('');
    const [rel, setRel] = useState<RelTab>('same_request');
    const [note, setNote] = useState('');
    const [savingPin, setSavingPin] = useState(false);

    const load = useCallback(async () => {
        setD(null);
        setErr('');
        try {
            const data = await logsApi.event(id);
            setD(data);
            setNote(data.event.pin_note ?? '');
            const first = (['same_request', 'same_actor', 'same_ip'] as RelTab[]).find((k) => data.related[k].length > 0);
            setRel(first ?? 'same_request');
        } catch (e) {
            setErr((e as Error).message);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const on = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement)?.closest('input,textarea,select')) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown' && neighbors?.next) onNavigate(neighbors.next);
            if (e.key === 'ArrowUp' && neighbors?.prev) onNavigate(neighbors.prev);
        };
        window.addEventListener('keydown', on);
        return () => window.removeEventListener('keydown', on);
    }, [onClose, onNavigate, neighbors]);

    const togglePin = async () => {
        if (!d) return;
        setSavingPin(true);
        try {
            if (d.event.pinned) {
                await logsApi.unpin(id);
                setD({ ...d, event: { ...d.event, pinned: false, pin_note: null } });
                setNote('');
                onPinChange?.(id, false);
                toast.info('Đã bỏ ghim');
            } else {
                await logsApi.pin(id, note.trim() || null);
                setD({ ...d, event: { ...d.event, pinned: true, pin_note: note.trim() || null } });
                onPinChange?.(id, true);
                toast.success('Đã ghim sự kiện', 'Sự kiện được ghim sẽ không bị dọn dẹp tự động.');
            }
        } catch (e) {
            toast.error('Chưa thực hiện được', (e as Error).message);
        } finally {
            setSavingPin(false);
        }
    };

    const saveNote = async () => {
        setSavingPin(true);
        try {
            await logsApi.pin(id, note.trim() || null);
            toast.success('Đã lưu ghi chú');
        } catch (e) {
            toast.error('Chưa lưu được ghi chú', (e as Error).message);
        } finally {
            setSavingPin(false);
        }
    };

    const copyJson = async () => {
        const ok = await copyText(JSON.stringify(d, null, 2));
        if (ok) toast.success('Đã sao chép JSON');
        else toast.error('Không sao chép được', 'Trình duyệt chặn quyền clipboard.');
    };

    const ev = d?.event;
    const jump = (patch: Partial<EventFilters>) => { onFilter(patch); onClose(); };

    return (
        <>
            <div className="lg-scrim" onClick={onClose} />
            <aside className="lg-drawer" role="dialog" aria-modal="true" aria-label="Chi tiết sự kiện">
                <header className="lg-drawer__head">
                    <div className="lg-drawer__nav">
                        <button type="button" className="lg-iconbtn" disabled={!neighbors?.prev} onClick={() => neighbors?.prev && onNavigate(neighbors.prev)} aria-label="Sự kiện trước (↑)"><Icon name="chevU" size={18} /></button>
                        <button type="button" className="lg-iconbtn" disabled={!neighbors?.next} onClick={() => neighbors?.next && onNavigate(neighbors.next)} aria-label="Sự kiện sau (↓)"><Icon name="chevD" size={18} /></button>
                        <span className="lg-mono lg-muted">#{id}</span>
                    </div>
                    <div className="lg-drawer__tools">
                        {ev && (
                            <>
                                <button type="button" className={`lg-iconbtn${ev.pinned ? ' is-on' : ''}`} onClick={togglePin} disabled={savingPin} aria-pressed={ev.pinned} aria-label={ev.pinned ? 'Bỏ ghim' : 'Ghim sự kiện'} title={ev.pinned ? 'Bỏ ghim' : 'Ghim để điều tra / giữ lại'}><Icon name="star" size={18} fill={ev.pinned} /></button>
                                <button type="button" className="lg-iconbtn" aria-label="Sao chép JSON" title="Sao chép JSON" onClick={copyJson}><Icon name="copy" size={18} /></button>
                            </>
                        )}
                        <button type="button" className="lg-iconbtn" onClick={onClose} aria-label="Đóng (Esc)"><Icon name="x" size={18} /></button>
                    </div>
                </header>

                <div className="lg-drawer__body">
                    {err ? (
                        <div className="lg-empty lg-empty--error"><strong>Không tải được sự kiện</strong><p>{err}</p><button type="button" className="lg-btn lg-btn--primary" onClick={load}>Thử lại</button></div>
                    ) : !ev ? (
                        <div className="lg-stack"><Skeleton h={28} w="60%" /><Skeleton h={18} /><Skeleton h={120} /><Skeleton h={90} /></div>
                    ) : (
                        <>
                            <div className="lg-drawer__title">
                                <div className="lg-row"><LevelBadge level={ev.level} /><Chip tone="brand">{CATEGORY_LABEL[ev.category] ?? ev.category}</Chip>{ev.pinned && <Chip tone="amber">Đã ghim</Chip>}</div>
                                <h3>{actionLabel(ev.action)}</h3>
                                <p>{ev.summary}</p>
                                <small className="lg-muted">{fmtFull(ev.occurred_at)} · {timeAgo(ev.occurred_at)}</small>
                            </div>

                            <dl className="lg-kv">
                                <div><dt><Icon name="user" size={14} /> Người thực hiện</dt><dd>{actorLabel(ev.actor)}{ev.actor.type && <em> · {ACTOR_TYPE[ev.actor.type] ?? ev.actor.type}</em>}{(ev.actor.id !== null || ev.actor.name) && <button type="button" className="lg-link" onClick={() => jump({ actor: ev.actor.name ?? String(ev.actor.id), range: 'all' })}>Lọc</button>}</dd></div>
                                <div><dt><Icon name="globe" size={14} /> Địa chỉ IP</dt><dd className="lg-mono">{ev.ip_address ?? '—'}{ev.ip_address && <button type="button" className="lg-link" onClick={() => jump({ ip: ev.ip_address ?? '', range: 'all' })}>Lọc</button>}</dd></div>
                                <div><dt><Icon name="activity" size={14} /> Yêu cầu</dt><dd className="lg-mono">{ev.http_method ?? '—'} {ev.route ?? ''}{ev.status_code !== null && <b className={`lg-http lg-http--${Math.floor(ev.status_code / 100)}`}>{ev.status_code}</b>}</dd></div>
                                <div><dt><Icon name="clock" size={14} /> Thời gian xử lý</dt><dd>{fmtMs(ev.duration_ms)}</dd></div>
                                {(ev.subject.type || ev.subject.id) && <div><dt><Icon name="database" size={14} /> Đối tượng</dt><dd className="lg-mono">{ev.subject.type} {ev.subject.id && `#${ev.subject.id}`}{ev.subject.type && <button type="button" className="lg-link" onClick={() => jump({ subject_type: ev.subject.type ?? '', subject_id: ev.subject.id ?? '', range: 'all' })}>Lọc</button>}</dd></div>}
                                <div><dt><Icon name="link" size={14} /> Mã yêu cầu</dt><dd className="lg-mono">{ev.request_id ?? '—'}{ev.request_id && <button type="button" className="lg-link" onClick={() => jump({ request_id: ev.request_id ?? '', range: 'all' })}>Lọc</button>}</dd></div>
                                <div><dt><Icon name="server" size={14} /> Nguồn</dt><dd className="lg-mono">{ev.source}</dd></div>
                                {ev.user_agent && <div className="lg-kv__wide"><dt><Icon name="eye" size={14} /> Trình duyệt / thiết bị</dt><dd className="lg-muted lg-small">{ev.user_agent}</dd></div>}
                            </dl>

                            {ev.diff.length > 0 && (
                                <section className="lg-drawer__sec">
                                    <h4>Thay đổi dữ liệu <Chip tone="violet">{ev.diff.length} trường</Chip></h4>
                                    <DiffView rows={ev.diff} />
                                </section>
                            )}

                            {ev.meta && Object.keys(ev.meta).length > 0 && (
                                <section className="lg-drawer__sec">
                                    <h4>Thông tin kèm theo</h4>
                                    <pre className="lg-code">{JSON.stringify(ev.meta, null, 2)}</pre>
                                </section>
                            )}

                            <section className="lg-drawer__sec">
                                <h4>Ghi chú điều tra</h4>
                                <textarea className="lg-textarea" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú để đồng nghiệp hiểu bối cảnh sự kiện này…" />
                                <div className="lg-row lg-row--end">
                                    {ev.pinned ? <button type="button" className="lg-btn lg-btn--soft" onClick={saveNote} disabled={savingPin || note === (ev.pin_note ?? '')}>Lưu ghi chú</button> : <button type="button" className="lg-btn lg-btn--soft" onClick={togglePin} disabled={savingPin}><Icon name="star" size={15} /> Ghim kèm ghi chú</button>}
                                </div>
                            </section>

                            <section className="lg-drawer__sec">
                                <h4>Chuỗi sự kiện liên quan</h4>
                                <div className="lg-tabs-mini" role="tablist">
                                    {(Object.keys(REL_LABEL) as RelTab[]).map((k) => (
                                        <button key={k} type="button" role="tab" aria-selected={rel === k} className={rel === k ? 'is-active' : ''} onClick={() => setRel(k)}>{REL_LABEL[k]} <b>{d?.related[k].length ?? 0}</b></button>
                                    ))}
                                </div>
                                <RelatedList items={d?.related[rel] ?? []} onOpen={onNavigate} />
                                <p className="lg-hint">Hiển thị các sự kiện trong vòng ±10 phút quanh thời điểm này.</p>
                            </section>
                        </>
                    )}
                </div>
            </aside>
        </>
    );
}

function RelatedList({ items, onOpen }: { items: LogEvent[]; onOpen: (id: number) => void }) {
    if (!items.length) return <p className="lg-muted lg-small">Không có sự kiện liên quan.</p>;
    return (
        <ol className="lg-rel">
            {items.map((e) => (
                <li key={e.id}>
                    <button type="button" onClick={() => onOpen(e.id)}>
                        <i className={`lg-rel__dot lg-lvbg--${e.level}`} />
                        <span><strong>{actionLabel(e.action)}</strong><small>{e.summary}</small></span>
                        <time className="lg-mono">{fmtFull(e.occurred_at).split(' · ')[0]}</time>
                    </button>
                </li>
            ))}
        </ol>
    );
}