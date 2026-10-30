const P: Record<string, string> = {
    menu: 'M4 7h16M4 12h16M4 17h16',
    close: 'M6 6l12 12M18 6 6 18',
    check: 'm5 12.5 4.5 4.5L19 7.5',
    chevron: 'm9 6 6 6-6 6',
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    pin: 'M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.500C5 14.800 12 21 12 21Zm0-8.500a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    phone: 'M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z',
    mail: 'M4 6h16v12H4V6Zm0 1 8 6 8-6',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3 2',
    book: 'M4 5.500A2.500 2.500 0 0 1 6.500 3H20v15H6.500A2.500 2.500 0 0 0 4 20.500v-15ZM4 20.500A2.500 2.500 0 0 0 6.500 23H20v-2',
    flask: 'M9 3h6M10 3v6L4.500 18.500A2 2 0 0 0 6.200 21.500h11.600a2 2 0 0 0 1.700-3L14 9V3M7.500 15h9',
    monitor: 'M3 5h18v11H3V5Zm6 15h6m-3-4v4',
    ball: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5.500 4-2.900-1.500-4.800h-5L8 12.600l4 2.900ZM12 3v3.500M20 9l-3.500 1M18 18.500l-3-2.500M6 18.500l3-2.500M4 9l3.500 1',
    spark: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.500 2.500m7 7L18 18M18 6l-2.500 2.500m-7 7L6 18',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8.500a8 8 0 0 1 16 0',
    teacher: 'M4 5a2 2 0 0 1 2-2h13v15H6a1 1 0 0 0 0 2h13M8 7h7M8 11h5',
    search: 'm20 20-4.500-4.500M17 10.500a6.500 6.500 0 1 1-13 0 6.500 6.500 0 0 1 13 0Z',
    calendar: 'M4 6h16v14H4V6Zm0 4h16M8 3v4m8-4v4',
    shield: 'M12 3 5 6v5.500c0 4.500 3 8 7 9.500 4-1.500 7-5 7-9.500V6l-7-3Zm-3 9 2.500 2.500L15.500 10',
    eye: 'M2 12s3.500-6.500 10-6.500S22 12 22 12s-3.500 6.500-10 6.500S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
};

export default function Icon({ name, size = 22, className }: { name: keyof typeof P | string; size?: number; className?: string }) {
    return (
        <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={P[name] ?? P.spark} />
        </svg>
    );
}