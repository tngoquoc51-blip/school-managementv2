'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../components/ui/Icons';
import { TileGrid } from '../components/classes/TileGrid';
import type { Tile } from '../components/classes/TileGrid';
import { SemesterWindowCard } from '../components/grades/SemesterWindowCard';
import { ExceptionsModal } from '../components/grades/ExceptionsModal';
import { GradeActivityLog } from '../components/grades/GradeActivityLog';
import { gradeService } from '../services/gradeService';
import { classService } from '../services/classService';
import type { GradeWindowsOverview, GradeWindow } from '../types/grades';

/** Trung tâm Quản lý điểm: khóa/mở kỳ nhập điểm toàn trường + ngoại lệ theo lớp/môn + nhật ký. */
export default function GradeWindowsPage() {
    const [yearId, setYearId] = useState<number>(0);
    const [years, setYears] = useState<{ id: number; label: string; is_current: number }[]>([]);
    const [data, setData] = useState<GradeWindowsOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [exceptionsFor, setExceptionsFor] = useState<GradeWindow | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [bulkBusy, setBulkBusy] = useState(false);

    useEffect(() => {
        classService.meta().then((m) => { setYears(m.school_years); setYearId(m.current_year_id); })
            .catch(() => setError('Không tải được danh sách năm học.'));
    }, []);

    const load = useCallback(() => {
        if (!yearId) return;
        setLoading(true); setError('');
        gradeService.overview(yearId)
            .then(setData)
            .catch((e) => setError(e?.response?.data?.message || 'Không tải được dữ liệu kỳ nhập điểm.'))
            .finally(() => setLoading(false));
    }, [yearId]);

    useEffect(() => { load(); }, [load]);

    const refresh = () => { load(); setReloadKey((k) => k + 1); };

    const bulkOpenAll = async () => {
        if (!data) return;
        setBulkBusy(true);
        try {
            await Promise.all(data.windows.filter((w) => w.status !== 'open').map((w) => gradeService.open(yearId, w.semester, null, 'Mở hàng loạt bởi quản trị')));
            refresh();
        } finally { setBulkBusy(false); }
    };
    const bulkCloseAll = async () => {
        if (!data) return;
        setBulkBusy(true);
        try {
            await Promise.all(data.windows.filter((w) => w.status === 'open').map((w) => gradeService.close(yearId, w.semester, 'Khóa hàng loạt bởi quản trị')));
            refresh();
        } finally { setBulkBusy(false); }
    };
    const yearLabel = years.find((y) => y.id === yearId)?.label ?? '';
    const openCount = data?.windows.filter((w) => w.status === 'open').length ?? 0;

    const tiles: Tile[] = [
        { key: 'input', title: 'Nhập điểm theo lớp', desc: 'Giáo viên nhập theo Thông tư 22', icon: 'grades', tone: 'blue', href: '/admin/grades/entry' },
        { key: 'summary', title: 'Tổng hợp điểm', desc: 'Xem theo lớp, theo môn, toàn trường', icon: 'chart', tone: 'teal', href: '/admin/grades/summary' },
        { key: 'review', title: 'Duyệt / Khiếu nại điểm', desc: 'Xử lý yêu cầu sửa điểm từ giáo viên', icon: 'alert', tone: 'rose', href: '/admin/grades/review' },
        { key: 'export', title: 'Xuất bảng điểm', desc: 'Học bạ, bảng điểm tổng kết', icon: 'download', tone: 'amber', href: '/admin/grades/export' },
    ];

    return (
        <>
            <section className="a-hero">
                <div className="a-row a-wrap">
                    <div style={{ flex: 1, minWidth: 260 }}>
                        <div className="a-crumb">Học vụ <span>›</span> Quản lý điểm</div>
                        <h1>Quản lý điểm</h1>
                        <p>Khóa/mở kỳ nhập điểm toàn trường, cấp ngoại lệ theo lớp hoặc theo môn, và theo dõi nhật ký thao tác — năm học {yearLabel}.</p>
                    </div>
                    <div className="a-row a-wrap">
                        <select className="a-select" style={{ width: 180 }} value={yearId} onChange={(e) => setYearId(+e.target.value)} aria-label="Năm học">
                            {years.map((y) => <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' ★' : ''}</option>)}
                        </select>
                        <button className="a-btn white" disabled={bulkBusy || !data} onClick={bulkOpenAll}><Icon name="check" size={16} /> Mở tất cả</button>
                        <button className="a-btn" disabled={bulkBusy || !data} onClick={bulkCloseAll}><Icon name="door" size={16} /> Khóa tất cả</button>
                    </div>
                </div>
            </section>

            <div className="a-stats" style={{ marginBottom: 22 }}>
                <div className="a-card a-stat" style={{ ['--sc' as any]: 'var(--ok)' }}>
                    <div className="ic" style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}><Icon name="check" size={22} /></div>
                    <div><b>{openCount}/2</b><small>Học kỳ đang mở nhập điểm</small></div>
                </div>
                <div className="a-card a-stat" style={{ ['--sc' as any]: 'var(--info)' }}>
                    <div className="ic" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}><Icon name="user" size={22} /></div>
                    <div><b>{data?.windows.reduce((n, w) => n + w.exceptions.length, 0) ?? 0}</b><small>Ngoại lệ đang áp dụng</small></div>
                </div>
            </div>

            {error ? (
                <div className="a-card a-empty">
                    <div className="ill" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><Icon name="alert" size={36} /></div>
                    <h3 style={{ color: 'var(--ink)' }}>Không tải được dữ liệu</h3><p>{error}</p>
                    <button className="a-btn pri" onClick={load}>Thử lại</button>
                </div>
            ) : loading || !data ? (
                <div className="a-cards">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="a-skel" style={{ height: 220 }} />)}</div>
            ) : (
                <div className="g-win-grid">
                    {data.windows.map((w) => (
                        <SemesterWindowCard key={w.semester} win={w} yearId={yearId} onChanged={refresh} onManageExceptions={() => setExceptionsFor(w)} />
                    ))}
                </div>
            )}

            <div className="a-sec" style={{ marginTop: 26 }}><h3>Chức năng điểm số</h3><small>Các công cụ làm việc với điểm hàng ngày</small></div>
            <TileGrid tiles={tiles} />

            <GradeActivityLog yearId={yearId} reloadKey={reloadKey} />

            {exceptionsFor && data && (
                <ExceptionsModal open onClose={() => setExceptionsFor(null)} win={exceptionsFor} yearId={yearId}
                                 classes={data.classes} subjects={data.subjects} onChanged={() => { refresh(); const w = data.windows.find((x) => x.semester === exceptionsFor.semester); if (w) setExceptionsFor(w); }} />
            )}
        </>
    );
}