'use client';

import { useCallback, useEffect, useState } from 'react';
import s from '../logs.module.css';
import { errorMessage, logsApi } from '../api';
import FilterBar from '../components/FilterBar';
import LogTable from '../components/LogTable';
import { Card, ErrorBox, Pager, Skeleton, useAsync, useToast } from '../components/ui';
import type { Facets, Filters, LogRow, Paged } from '../types';
import type { TabProps } from './tabProps';

export default function ActivityTab({ tick, openLog, filters, setFilters }: TabProps & { filters: Filters; setFilters: (f: Filters) => void }) {
    const { data, error, loading, run } = useAsync<Paged<LogRow>>();
    const [facets, setFacets] = useState<Facets | null>(null);
    const [page, setPage] = useState(1);
    const [per, setPer] = useState(25);
    const [exporting, setExporting] = useState(false);
    const toast = useToast();

    useEffect(() => { logsApi.facets().then(setFacets).catch(() => {}); }, []);
    useEffect(() => { setPage(1); }, [filters, per]);
    const load = useCallback((silent = false) => run(() => logsApi.list(filters, page, per), silent), [run, filters, page, per]);
    useEffect(() => { load(tick > 0 && page === 1 ? true : false); }, [load, tick]); // eslint-disable-line react-hooks/exhaustive-deps

    const onSort = (col: string) => setFilters({ ...filters, sort: col, dir: filters.sort === col && filters.dir !== 'asc' ? 'asc' : 'desc' });

    const doExport = async () => {
        setExporting(true);
        try { await logsApi.exportCsv(filters); toast('ok', 'Đã tải file CSV (đã ghi nhận việc xuất dữ liệu)'); }
        catch (e) { toast('err', errorMessage(e)); }
        finally { setExporting(false); }
    };

    return (
        <div className={s.stack}>
            <Card><FilterBar value={filters} onChange={setFilters} facets={facets} onExport={doExport} exporting={exporting} /></Card>
            {error && !data && <ErrorBox message={error} onRetry={() => load()} />}
            {!data && !error && <Skeleton h={420} />}
            {data && (
                <div style={{ opacity: loading ? 0.6 : 1, transition: '.15s' }}>
                    <LogTable rows={data.items} filters={filters} onSort={onSort} onOpen={openLog} />
                    <div className={s.pager} style={{ justifyContent: 'space-between' }}>
                        <select className={s.field} value={per} onChange={(e) => setPer(Number(e.target.value))} aria-label="Số dòng mỗi trang">
                            {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} dòng / trang</option>)}
                        </select>
                    </div>
                    <Pager page={data.meta.page} last={data.meta.last_page} total={data.meta.total} per={data.meta.per_page} onPage={setPage} />
                </div>
            )}
        </div>
    );
}