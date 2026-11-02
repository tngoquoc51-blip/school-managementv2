'use client';
import { useState } from 'react';
import s from './DoiSong.module.css';
import Icon from '../Icons';
import { DS_CLUBS } from './doi-song.data';

/** Tab chọn nhóm câu lạc bộ. Chuyển tab bằng chuột hoặc phím mũi tên trái/phải. */
export default function ClubTabs() {
    const [i, setI] = useState(0);
    const g = DS_CLUBS.groups[i];
    const n = DS_CLUBS.groups.length;
    function key(e: React.KeyboardEvent) {
        if (e.key === 'ArrowRight') { e.preventDefault(); setI((i + 1) % n); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); setI((i - 1 + n) % n); }
    }
    return (
        <div>
            <div className={s.tabs} role="tablist" aria-label="Nhóm câu lạc bộ" onKeyDown={key}>
                {DS_CLUBS.groups.map((x, k) => (
                    <button key={x.key} role="tab" id={`tab-${x.key}`} aria-selected={k === i} aria-controls="clubs-panel" tabIndex={k === i ? 0 : -1}
                            className={`${s.tab} ${k === i ? s.tabOn : ''}`} onClick={() => setI(k)}>
                        <Icon name={x.icon} size={18} />{x.label}<em>{x.clubs.length}</em>
                    </button>
                ))}
            </div>
            <div id="clubs-panel" role="tabpanel" aria-labelledby={`tab-${g.key}`} className={s.panel}>
                <p className={s.panelLead}>{g.lead}</p>
                <ul className={s.clubs}>
                    {g.clubs.map((c) => (
                        <li key={c.name}>
                            <span className={s.clubSub}>{c.sub}</span>
                            <h3>{c.name}</h3>
                            <p>{c.text}</p>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}