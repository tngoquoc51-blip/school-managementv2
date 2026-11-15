'use client';

import './rewards.css';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { errMsg, getToken, rewardsApi } from '@/modules/bgh/rewards/rewardsService';
import type { Meta, Mode, Period, View, ViewProps } from '@/modules/bgh/rewards/types';
import { Icon, Skeleton, UIProvider } from './ui';
import ClassDrawer from './ClassDrawer';
import Overview from './views/Overview';
import Ranking from './views/Ranking';
import Scoring, { ScoreModal } from './views/Scoring';
import Awards, { AwardModal } from './views/Awards';
import AwardsHome from './views/AwardsHome';
import Honor from './views/Honor';
import AwardTypes from './views/AwardTypes';
import Criteria from './views/Criteria';
import Logs from './views/Logs';

type Txt = string | Partial<Record<Mode, string>>;
const pick = (x: Txt, m: Mode) => (typeof x === 'string' ? x : x[m] || '');

/** Tên menu + tiêu đề từng màn hình (có thể khác nhau theo mục) */
const ITEM: Record<View, { i: string; l: Txt; t: Txt }> = {
    home: { i: 'home', l: 'Tổng quan', t: { reward: 'Tổng quan khen thưởng', discipline: 'Tổng quan nhắc nhở & kỷ luật' } },
    awards: { i: 'award', l: { reward: 'Đề xuất & xét duyệt', discipline: 'Đề xuất & xử lý' }, t: { reward: 'Đề xuất & xét duyệt khen thưởng', discipline: 'Đề xuất & xử lý kỷ luật' } },
    honor: { i: 'star', l: 'Bảng vàng', t: 'Bảng vàng khen thưởng' },
    types: { i: 'list', l: 'Danh hiệu & mức thưởng', t: 'Danh hiệu khen thưởng' },
    overview: { i: 'home', l: 'Tổng quan', t: 'Tổng quan thi đua' },
    ranking: { i: 'trophy', l: 'Bảng xếp hạng', t: 'Bảng xếp hạng thi đua' },
    scoring: { i: 'edit', l: 'Chấm điểm', t: 'Chấm điểm thi đua' },
    criteria: { i: 'list', l: 'Tiêu chí thi đua', t: 'Tiêu chí thi đua' },
    logs: { i: 'log', l: 'Nhật ký hoạt động', t: 'Nhật ký hoạt động' },
};

/** Mỗi mục trong menu chính của BGH chỉ mở đúng chức năng của mình */
const MODES: Record<Mode, { brand: string; icon: string; kinds: string; start: View; groups: { s: string; v: View[] }[] }> = {
    reward: { brand: 'Khen thưởng', icon: 'award', kinds: 'khen_thuong', start: 'home', groups: [{ s: 'Chức năng', v: ['home', 'awards', 'honor', 'types'] }, { s: 'Hệ thống', v: ['logs'] }] },
    discipline: { brand: 'Kỷ luật', icon: 'alert', kinds: 'nhac_nho,ky_luat', start: 'home', groups: [{ s: 'Chức năng', v: ['home', 'awards'] }, { s: 'Hệ thống', v: ['logs'] }] },
    emulation: { brand: 'Thi đua', icon: 'trophy', kinds: '', start: 'overview', groups: [{ s: 'Chức năng', v: ['overview', 'ranking', 'scoring', 'criteria'] }, { s: 'Hệ thống', v: ['logs'] }] },
};
const PERIODS: [Period, string][] = [['week', 'Tuần'], ['month', 'Tháng'], ['semester', 'Học kỳ'], ['year', 'Năm học']];

function Shell({ mode }: { mode: Mode }) {
    const cfg = MODES[mode];
    const allowed = cfg.groups.flatMap((g) => g.v);
    const router = useRouter();
    const [meta, setMeta] = useState<Meta | null>(null);
    const [err, setErr] = useState('');
    const [forbidden, setForbidden] = useState(false);
    const [view, setView] = useState<View>(cfg.start);
    const [period, setPeriod] = useState<Period>('week');
    const [yearId, setYearId] = useState<number | undefined>();
    const [date, setDate] = useState('');
    const [rev, setRev] = useState(0);
    const [classId, setClassId] = useState<number | null>(null);
    const [score, setScore] = useState<{ ids?: number[] } | null>(null);
    const [award, setAward] = useState<{ classId?: number } | null>(null);
    const [user, setUser] = useState<any>(null);
    const [pending, setPending] = useState(0);

    // Khôi phục tab từ #hash + thông tin người dùng
    useEffect(() => {
        const h = window.location.hash.replace('#', '') as View;
        if (allowed.includes(h)) setView(h);
        try { setUser(JSON.parse(localStorage.getItem('user') || 'null')); } catch { /* bỏ qua */ }
    }, []);

    const go = useCallback((v: View) => { setView(v); window.history.replaceState(null, '', '#' + v); }, []);

    // Tải dữ liệu khởi tạo (năm học, danh sách lớp, quyền)
    useEffect(() => {
        if (!getToken()) { router.replace('/login'); return; }
        setErr('');
        rewardsApi.meta(yearId).then((m) => {
            setMeta(m);
            setDate((d) => d || m.default_date);
        }).catch((e) => {
            const s = e?.response?.status;
            if (s === 401) { router.replace('/login'); }
            else if (s === 403) setForbidden(true);
            else setErr(errMsg(e));
        });
    }, [yearId, router]);

    // Số đề xuất chờ duyệt hiện trên menu
    const eff = yearId ?? meta?.year.id;
    useEffect(() => {
        if (!eff || mode === 'emulation') return;
        rewardsApi.awards({ year_id: eff, status: 'pending', kind: cfg.kinds, page: 1 }).then((r) => setPending(r.counts.pending)).catch(() => {});
    }, [eff, rev, mode, cfg.kinds]);

    const changed = useCallback(() => setRev((r) => r + 1), []);
    const cur = { t: pick(ITEM[view].t, mode) };

    const props: ViewProps | null = meta && eff && date ? {
        meta, yearId: eff, date, period, rev, go, changed, mode, kinds: cfg.kinds,
        openClass: setClassId,
        openScore: (ids) => setScore({ ids }),
        openAward: (o) => setAward(o || {}),
    } : null;

    return (
        <div className="rw">
            <div className="rw-main">
                <header className="rw-top">
                    <div>
                        <h1>{cur.t}</h1>
                        <div className="sub">{meta ? `Năm học ${meta.year.label} · ${meta.classes.length} lớp` : 'Đang tải dữ liệu…'}</div>
                    </div>
                    <span className="spacer" />
                    {meta && (view === 'overview' || view === 'ranking') && (
                        <div className="row">
                            {view === 'ranking' && (
                                <div className="seg" role="group" aria-label="Kỳ xếp hạng">
                                    {PERIODS.map(([k, l]) => <button key={k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{l}</button>)}
                                </div>
                            )}
                            <input type="date" value={date} min={meta.year.start_date} max={meta.year.end_date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Ngày tham chiếu" />
                        </div>
                    )}
                    {meta && meta.years.length > 1 && (
                        <select value={eff} onChange={(e) => { setDate(''); setYearId(Number(e.target.value)); }} aria-label="Năm học">
                            {meta.years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
                        </select>
                    )}
                    <button className="icon-btn" onClick={changed} title="Tải lại dữ liệu" aria-label="Tải lại"><Icon n="refresh" /></button>
                </header>

                <nav className="rw-tabs" aria-label={`Chức năng ${cfg.brand}`}>
                    {allowed.map((k) => (
                        <button key={k} className={view === k ? 'on' : ''} onClick={() => go(k)} aria-current={view === k ? 'page' : undefined}>
                            <Icon n={ITEM[k].i} s={17} />{pick(ITEM[k].l, mode)}
                            {k === 'awards' && pending > 0 && <span className="cnt">{pending}</span>}
                        </button>
                    ))}
                </nav>

                <main className="rw-content">
                    {forbidden ? (
                        <div className="rw-err"><Icon n="alert" />Tài khoản của bạn chưa được phân quyền truy cập phân hệ Thi đua. Hãy liên hệ quản trị hệ thống.</div>
                    ) : err ? (
                        <div className="rw-err"><Icon n="alert" />{err}</div>
                    ) : !props ? (
                        <div className="rw-grid4"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>
                    ) : (
                        <>
                            {view === 'home' && <AwardsHome {...props} />}
                            {view === 'honor' && <Honor {...props} />}
                            {view === 'types' && <AwardTypes {...props} />}
                            {view === 'overview' && <Overview {...props} />}
                            {view === 'ranking' && <Ranking {...props} />}
                            {view === 'scoring' && <Scoring {...props} />}
                            {view === 'awards' && <Awards {...props} />}
                            {view === 'criteria' && <Criteria {...props} />}
                            {view === 'logs' && <Logs {...props} />}
                        </>
                    )}
                </main>
            </div>

            {props && classId !== null && (
                <ClassDrawer id={classId} meta={props.meta} period={view === 'ranking' ? period : 'week'} date={date}
                             onClose={() => setClassId(null)}
                             onScore={mode === 'emulation' ? (id) => setScore({ ids: [id] }) : undefined}
                             onAward={mode !== 'emulation' ? (id) => setAward({ classId: id }) : undefined}
                             awardLabel={mode === 'discipline' ? 'Đề xuất kỷ luật' : undefined} />
            )}
            {props && score && <ScoreModal meta={props.meta} preset={score.ids} onClose={() => setScore(null)} onDone={changed} />}
            {props && award && <AwardModal meta={props.meta} yearId={props.yearId} classId={award.classId} mode={mode} onClose={() => setAward(null)} onDone={changed} />}
        </div>
    );
}

/** Dùng chung cho 3 mục: reward (Khen thưởng), discipline (Kỷ luật), emulation (Thi đua) */
export default function RewardsApp({ mode }: { mode: Mode }) {
    return (
        <UIProvider>
            <Shell mode={mode} />
        </UIProvider>
    );
}