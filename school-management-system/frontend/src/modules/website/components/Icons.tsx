/* Biểu tượng nét mảnh, dùng chung cho website */
const P: Record<string, JSX.Element> = {
    monitor: (<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>),
    flask: (<><path d="M9 3h6M10 3v6L4.500 18a2 2 0 0 0 1.800 3h11.400a2 2 0 0 0 1.800-3L14 9V3" /><path d="M7.500 14h9" /></>),
    book: (<><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z" /><path d="M8 9h7M8 13h7" /></>),
    ball: (<><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18M5.500 5.500c4 3 9 3 13 0M5.500 18.500c4-3 9-3 13 0" /></>),
    spark: (<><path d="M12 3l2 5.500L19.500 10 14 12l-2 5.500L10 12 4.500 10 10 8.500 12 3z" /><path d="M18 17v4M16 19h4" /></>),
    pin: (<><path d="M12 21s7-6.200 7-12a7 7 0 1 0-14 0c0 5.800 7 12 7 12z" /><circle cx="12" cy="9" r="2.500" /></>),
    phone: (<><path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" /></>),
    mail: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
    clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
    check: (<><circle cx="12" cy="12" r="9" /><path d="m8 12.500 2.700 2.700L16 9.500" /></>),
    arrow: (<><path d="M5 12h14M13 6l6 6-6 6" /></>),
    menu: (<><path d="M4 7h16M4 12h16M4 17h16" /></>),
};

export default function Icon({ name, size = 24 }: { name: string; size?: number }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {P[name]}
        </svg>
    );
}
