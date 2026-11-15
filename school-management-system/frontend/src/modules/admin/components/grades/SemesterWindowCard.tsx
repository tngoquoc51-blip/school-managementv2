'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../ui/Icons';
import { ConfirmDialog } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { gradeService } from '../../services/gradeService';
import type { GradeWindow } from '../../types/grades';
import { fmtDateTime } from '../classes/shared';

interface Props {
    win: GradeWindow;
    yearId: number;
    onChanged: () => void;
    onManageExceptions: () => void;
}

function useCountdown(target: string | null) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!target) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [target]);
    if (!target) return null;
    const diff = new Date(target).getTime() - now;
    if (diff <= 0) return 'Sắp tự khóa';
    const h = Math.floor(diff / 3_600_000);
    const d = Math.floor(h / 24);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    if (d > 0) return `Còn ${d} ngày ${h % 24} giờ`;
    if (h > 0) return `Còn ${h} giờ ${m} phút`;
    return `Còn ${m} phút`;
}

/** Thẻ công tắc khóa/mở nhập điểm cho 1 học kỳ — hành động trung tâm của cả module. */
export function SemesterWindowCard({ win, yearId, onChanged, onManageExceptions }: Props) {
    const toast = useToast();
    const isOpen = win.status === 'open';
    const countdown = useCountdown(isOpen ? win.closes_at : null);
    const [busy, setBusy] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState<'open' | 'close' | null>(null);
    const [closesAt, setClosesAt] = useState('');
    const [note, setNote] = useState('');

    const exMultiClass = useMemo(() => new Set(win.exceptions.map((e) => e.class_id)).size, [win.exceptions]);

    const doOpen = async () => {
        setBusy(true);
        try {
            await gradeService.open(yearId, win.semester, closesAt || null, note || null);
            toast.success(`Đã mở nhập điểm học kỳ ${win.semester}`, closesAt ? `Tự động khóa lúc ${new Date(closesAt).toLocaleString('vi-VN')}` : 'Giáo viên có thể nhập/sửa điểm ngay bây giờ.');
            setConfirmOpen(null); setClosesAt(''); setNote(''); onChanged();
        } catch (e: any) { toast.error('Không thể mở kỳ nhập điểm', e?.response?.data?.message || 'Đã xảy ra lỗi.'); } finally { setBusy(false); }
    };

    const doClose = async () => {
        setBusy(true);
        try {
            await gradeService.close(yearId, win.semester, note || null);
            toast.success(`Đã khóa nhập điểm học kỳ ${win.semester}`, 'Giáo viên không thể tự ý nhập/sửa điểm nữa.');
            setConfirmOpen(null); setNote(''); onChanged();
        } catch (e: any) { toast.error('Không thể khóa kỳ nhập điểm', e?.response?.data?.message || 'Đã xảy ra lỗi.'); } finally { setBusy(false); }
    };

    return (
        <div className={`g-win ${isOpen ? 'g-win-open' : 'g-win-closed'}`}>
            <div className="g-win-band">
                <div className="g-win-band-ic"><Icon name={isOpen ? 'check' : 'door'} size={26} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <small>HỌC KỲ</small>
                    <h3>Học kỳ {win.semester}</h3>
                </div>
                <span className="g-win-pill">{isOpen ? 'MỞ' : 'KHÓA'}</span>
            </div>

            <div className="g-win-body">
                <div className="g-win-status-row">
                    <span className={`a-badge ${isOpen ? 'ok' : 'dng'}`}><i className="dot" />{isOpen ? 'Đang mở nhập điểm' : 'Đang khóa nhập điểm'}</span>
                    {isOpen && countdown && <span className="a-badge warn">⏱ {countdown}</span>}
                </div>

                <div className="g-win-meta">
                    {isOpen ? (
                        <>
                            <div><span className="a-muted">Mở lúc</span><b>{fmtDateTime(win.opened_at)}</b></div>
                            <div><span className="a-muted">Tự khóa lúc</span><b>{win.closes_at ? fmtDateTime(win.closes_at) : 'Không đặt hạn'}</b></div>
                        </>
                    ) : (
                        <div className="g-win-meta-full"><span className="a-muted">Khóa lúc</span><b>{win.closed_at ? fmtDateTime(win.closed_at) : 'Chưa từng mở trong năm học này'}</b></div>
                    )}
                </div>
                {win.note && <p className="g-win-note">“{win.note}”</p>}

                <div className="a-row g-win-actions">
                    {isOpen ? (
                        <button className="a-btn dng" onClick={() => setConfirmOpen('close')}><Icon name="door" size={16} /> Khóa ngay</button>
                    ) : (
                        <button className="a-btn pri" onClick={() => setConfirmOpen('open')}><Icon name="check" size={16} /> Mở nhập điểm</button>
                    )}
                    <button className="a-btn" onClick={onManageExceptions}>
                        <Icon name="user" size={16} /> Ngoại lệ {exMultiClass > 0 && <span className="a-badge info" style={{ marginLeft: 4 }}>{exMultiClass} lớp</span>}
                    </button>
                </div>
            </div>

            <ConfirmDialog
                open={confirmOpen === 'close'} danger loading={busy} title={`Khóa nhập điểm học kỳ ${win.semester}?`} confirmText="Khóa ngay"
                message={<>Toàn bộ giáo viên sẽ <b>không thể nhập hoặc sửa điểm</b> cho học kỳ này nữa, trừ khi được cấp ngoại lệ riêng theo lớp/môn.</>}
                onConfirm={doClose} onClose={() => setConfirmOpen(null)}
            />

            {confirmOpen === 'open' && (
                <div className="a-ov" onMouseDown={(e) => e.target === e.currentTarget && setConfirmOpen(null)}>
                    <div className="a-modal sm">
                        <div className="a-modal-h"><div style={{ flex: 1 }}><h3>Mở nhập điểm học kỳ {win.semester}</h3><p>Giáo viên sẽ nhập/sửa điểm được ngay sau khi mở</p></div>
                            <button className="a-icon-btn" onClick={() => setConfirmOpen(null)}><Icon name="x" /></button></div>
                        <div className="a-modal-b" style={{ display: 'grid', gap: 14, paddingTop: 8 }}>
                            <div className="a-field"><label>Tự động khóa lúc (không bắt buộc)</label>
                                <input type="datetime-local" className="a-input" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
                                <span className="hint">Để trống nếu muốn tự tay khóa, không giới hạn thời gian.</span></div>
                            <div className="a-field"><label>Ghi chú</label>
                                <input className="a-input" placeholder="VD: Mở nhập điểm giữa kỳ" value={note} onChange={(e) => setNote(e.target.value)} /></div>
                        </div>
                        <div className="a-modal-f"><button className="a-btn" onClick={() => setConfirmOpen(null)}>Hủy</button>
                            <button className="a-btn pri" onClick={doOpen} disabled={busy}>{busy && <span className="a-spin" />} Mở nhập điểm</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}