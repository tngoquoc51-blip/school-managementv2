import s from '../extra.module.css';
import { SCHOOL } from '../data/school';
import { NOTICE } from '../data/pages';
import Icon from './Icons';

export default function TopBar() {
    return (
        <div className={s.topbar}>
            <div className={s.topbarInner}>
                <p className={s.notice}>{NOTICE}</p>
                <a href={`tel:${SCHOOL.phone.replace(/\s/g, '')}`} className={s.topLink}>
                    <Icon name="phone" size={16} /> {SCHOOL.phone}
                </a>
            </div>
        </div>
    );
}