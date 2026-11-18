'use client';

import { CSSProperties, DragEvent } from 'react';
import { LEVEL_COLOR, OFFICER_SHORT, Student, seatKey, shortName } from '@/lib/hr-seating';
import { Icon } from './ui';

export type ColorMode = 'group' | 'gender' | 'level' | 'none';
export type DragSource = { kind: 'pool'; id: number } | { kind: 'seat'; key: string };
export type SeatMap = Record<string, { student_id: number; locked: boolean; note?: string | null }>;

export const encodeDrag = (e: DragEvent, src: DragSource) => {
    e.dataTransfer.setData('text/plain', JSON.stringify(src));
    e.dataTransfer.effectAllowed = 'move';
};
export const decodeDrag = (e: DragEvent): DragSource | null => {
    try { return JSON.parse(e.dataTransfer.getData('text/plain')) as DragSource; } catch { return null; }
};

export function colorOf(s: Student, mode: ColorMode): string | null {
    if (mode === 'group') return s.group?.color || null;
    if (mode === 'gender') return s.gender === 'Nam' ? '#1d6fe0' : '#0891b2';
    if (mode === 'level') return s.level ? LEVEL_COLOR[s.level] : null;
    return null;
}

interface Props {
    rows: number; cols: number; per: number;
    blocked: Set<string>;
    seats: SeatMap;
    students: Map<number, Student>;
    mode?: ColorMode;
    readOnly?: boolean;
    compact?: boolean;
    selected?: string | null;
    warnIds?: Set<number>;
    overKey?: string | null;
    onSeatClick?: (key: string) => void;
    onDropSeat?: (key: string, src: DragSource) => void;
    onOver?: (key: string | null) => void;
}

/** Sơ đồ phòng học: bảng ở trên, các hàng bàn từ đầu tới cuối, mỗi cột là một dãy bàn. */
export default function SeatCanvas({ rows, cols, per, blocked, seats, students, mode = 'group', readOnly, compact, selected, warnIds, overKey, onSeatClick, onDropSeat, onOver }: Props) {
    const style = { '--seat-w': compact ? '64px' : '98px', '--seat-h': compact ? '40px' : '58px', gridTemplateColumns: `34px repeat(${cols}, auto)` } as CSSProperties;

    return (
        <div>
            <div className="hs-board">BẢNG · BỤC GIẢNG</div>
            <div className="hs-room" style={style}>
                <div />
                {Array.from({ length: cols }).map((_, c) => <div key={c} className="hs-axis">Dãy {c + 1}</div>)}
                {Array.from({ length: rows }).map((_, r) => (
                    <div key={r} style={{ display: 'contents' }}>
                        <div className="hs-axis hs-axis-row">{r + 1}</div>
                        {Array.from({ length: cols }).map((_, c) => (
                            <div key={c} className="hs-desk">
                                {Array.from({ length: per }).map((_, p) => {
                                    const key = seatKey(r, c, p);
                                    const seat = seats[key];
                                    const st = seat ? students.get(seat.student_id) : undefined;
                                    const isBlocked = blocked.has(key);
                                    const col = st ? colorOf(st, mode) : null;
                                    const cls = ['hs-seat', !st && !isBlocked ? 'empty' : '', isBlocked ? 'blocked' : '', selected === key ? 'sel' : '', st && warnIds?.has(st.id) ? 'warn' : '', overKey === key ? 'over' : '', readOnly ? 'ro' : ''].join(' ');
                                    const sty = col ? ({ '--seat-c': col } as CSSProperties) : undefined;
                                    return (
                                        <div key={p} className={cls} style={sty} role="button" tabIndex={readOnly ? -1 : 0}
                                             draggable={!readOnly && !!st && !seat?.locked}
                                             onClick={() => onSeatClick?.(key)}
                                             onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeatClick?.(key); } }}
                                             onDragStart={(e) => encodeDrag(e, { kind: 'seat', key })}
                                             onDragOver={(e) => { if (!readOnly && !isBlocked) { e.preventDefault(); onOver?.(key); } }}
                                             onDragLeave={() => onOver?.(null)}
                                             onDrop={(e) => { e.preventDefault(); onOver?.(null); const src = decodeDrag(e); if (src && !readOnly && !isBlocked) onDropSeat?.(key, src); }}
                                             title={st ? `${st.full_name}${seat?.note ? ' – ' + seat.note : ''}` : isBlocked ? 'Chỗ bị khóa' : 'Chỗ trống'}>
                                            {isBlocked ? <Icon name="ban" size={compact ? 12 : 16} /> : st ? (
                                                <>
                                                    <b className="hs-seat-name">{st.ten}</b>
                                                    {!compact && <span className="hs-seat-sub">{shortName(st.full_name).replace(st.ten, '').trim() || st.code}</span>}
                                                    <span className="hs-seat-flags">
                            {seat?.locked && <Icon name="lock" size={11} />}
                                                        {st.flags.vision && <Icon name="glasses" size={12} />}
                                                        {st.flags.hearing && <Icon name="ear" size={12} />}
                                                        {st.flags.tall && <Icon name="ruler" size={12} />}
                                                        {st.officer_roles.length > 0 && <em title={st.officer_roles.map((x) => OFFICER_SHORT[x] || x).join(', ')}><Icon name="star" size={11} /></em>}
                          </span>
                                                </>
                                            ) : <span className="hs-seat-empty">{readOnly ? '' : '＋'}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}