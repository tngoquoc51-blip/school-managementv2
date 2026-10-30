'use client';
import { useMemo, useState } from 'react';
import s from '../extra.module.css';
import { ARTICLES } from '../data/pages';

const TAGS = ['Tất cả', ...Array.from(new Set(ARTICLES.map((a) => a.tag)))];

export default function NewsBoard() {
    const [tag, setTag] = useState('Tất cả');
    const [q, setQ] = useState('');
    const list = useMemo(() => ARTICLES.filter((a) =>
        (tag === 'Tất cả' || a.tag === tag) &&
        (a.title + a.text).toLowerCase().includes(q.trim().toLowerCase())), [tag, q]);

    return (
        <div>
            <div className={s.toolbar}>
                <div className={s.tabs} role="group" aria-label="Lọc theo chuyên mục">
                    {TAGS.map((t) => (
                        <button key={t} type="button" aria-pressed={t === tag}
                                className={t === tag ? s.tabOn : s.tab} onClick={() => setTag(t)}>{t}</button>
                    ))}
                </div>
                <input className={s.search} type="search" placeholder="Tìm bài viết" aria-label="Tìm bài viết"
                       value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {list.length === 0 ? (
                <p className={s.empty}>Không có bài viết phù hợp. Thử bỏ bộ lọc hoặc đổi từ khóa.</p>
            ) : (
                <ul className={s.articleGrid}>
                    {list.map((a) => (
                        <li key={a.id} className={s.article}>
                            <div className={s.articleMeta}><span className={s.articleTag}>{a.tag}</span><span>{a.date}</span></div>
                            <h3>{a.title}</h3>
                            <p>{a.text}</p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}