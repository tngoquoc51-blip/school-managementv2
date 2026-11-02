import Link from 'next/link';
import s from './TinTuc.module.css';
import Icon from '../Icons';
import { fmtDate, type NewsItem } from '../../lib/api';
import { TT_TEXT } from './tin-tuc.data';

/** Thẻ một bài viết. Bài chưa có ảnh thì hiện nền màu theo tông (tone) của bài. */
export default function NewsTile({ n, big = false }: { n: NewsItem; big?: boolean }) {
    const href = n.slug ? `/tin-tuc/${n.slug}` : '/tin-tuc';
    return (
        <article className={`${s.tile} ${big ? s.tileBig : ''}`}>
            <Link href={href} className={`${s.cover} ${s['tone_' + n.tone] ?? s.tone_a}`} aria-hidden="true" tabIndex={-1}>
                <Icon name={n.kind === 'event' ? 'calendar' : 'book'} size={big ? 64 : 42} />
                <span className={s.kind}>{n.kind === 'event' ? 'Sự kiện' : 'Tin tức'}</span>
            </Link>
            <div className={s.tileBody}>
                <p className={s.meta}><span className={s.tag}>{n.category}</span><time dateTime={n.date}>{fmtDate(n.date)}</time></p>
                <h3><Link href={href}>{n.title}</Link></h3>
                <p className={s.sum}>{n.summary}</p>
                {n.kind === 'event' && n.event_date && <p className={s.when}><Icon name="calendar" size={16} />{fmtDate(n.event_date)}{n.event_place ? ` · ${n.event_place}` : ''}</p>}
                <Link href={href} className={s.more}>{TT_TEXT.readMore}<Icon name="arrow" size={16} /></Link>
            </div>
        </article>
    );
}