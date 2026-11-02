const P: Record<string, string> = {
    dashboard: 'M3 3h7v9H3z|M14 3h7v5h-7z|M14 12h7v9h-7z|M3 16h7v5H3z',
    list: 'M8 6h13|M8 12h13|M8 18h13|M3 6h.01|M3 12h.01|M3 18h.01',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    diff: 'M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M13 6h3a2 2 0 0 1 2 2v7|M6 9v12',
    bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9|M13.73 21a2 2 0 0 1-3.46 0',
    archive: 'M21 8v13H3V8|M1 3h22v5H1z|M10 12h4',
    search: 'M21 21l-4.35-4.35|M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z',
    filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M7 10l5 5 5-5|M12 15V3',
    refresh: 'M23 4v6h-6|M1 20v-6h6|M3.51 9a9 9 0 0 1 14.85-3.36L23 10|M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
    play: 'M5 3l14 9-14 9V3z',
    pause: 'M6 4h4v16H6z|M14 4h4v16h-4z',
    star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    x: 'M18 6L6 18|M6 6l12 12',
    check: 'M20 6L9 17l-5-5',
    alert: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z|M12 9v4|M12 17h.01',
    info: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z|M12 16v-4|M12 8h.01',
    chevL: 'M15 18l-6-6 6-6',
    chevR: 'M9 18l6-6-6-6',
    chevD: 'M6 9l6 6 6-6',
    chevU: 'M18 15l-6-6-6 6',
    clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z|M12 6v6l4 2',
    user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2|M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
    globe: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z|M2 12h20|M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
    copy: 'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z|M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
    sun: 'M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0z|M12 1v2|M12 21v2|M4.22 4.22l1.42 1.42|M18.36 18.36l1.42 1.42|M1 12h2|M21 12h2|M4.22 19.78l1.42-1.42|M18.36 5.64l1.42-1.42',
    moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
    lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z|M7 11V7a5 5 0 0 1 10 0v4',
    unlock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z|M7 11V7a5 5 0 0 1 9.9-1',
    trash: 'M3 6h18|M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6|M10 11v6|M14 11v6|M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
    plus: 'M12 5v14|M5 12h14',
    edit: 'M12 20h9|M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
    save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z|M17 21v-8H7v8|M7 3v5h8',
    link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71|M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
    activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
    server: 'M2 3h20v7H2z|M2 14h20v7H2z|M6 6.5h.01|M6 17.5h.01',
    zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z|M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    keyboard: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z|M6 9h.01|M10 9h.01|M14 9h.01|M18 9h.01|M7 15h10',
    up: 'M23 6l-9.5 9.5-5-5L1 18|M17 6h6v6',
    down: 'M23 18l-9.5-9.5-5 5L1 6|M17 18h6v-6',
    database: 'M21 5c0 1.66-4.03 3-9 3S3 6.66 3 5s4.03-3 9-3 9 1.34 9 3z|M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3|M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5',
    flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z|M4 22v-7',
    flask: 'M9 3h6|M10 3v6.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V3',
};

interface Props {
    name: string;
    size?: number;
    className?: string;
    fill?: boolean;
}

export default function Icon({ name, size = 18, className, fill }: Props) {
    const d = P[name] ?? P.info;
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
            {d.split('|').map((p, i) => <path key={i} d={p} />)}
        </svg>
    );
}