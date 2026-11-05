import type { Filters, Me } from '../types';

export interface TabProps {
    me: Me;
    range: string;
    tick: number;                        // tăng khi bấm làm mới / tự động làm mới
    openLog: (id: number) => void;
    goActivity: (f: Filters) => void;    // chuyển sang tab Hoạt động với bộ lọc
    goTab: (tab: string) => void;
    onBadges: (b: { alerts?: number }) => void;
}