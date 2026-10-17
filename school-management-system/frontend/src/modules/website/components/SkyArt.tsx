/* Minh họa ngôi trường dưới bầu trời (SVG, không cần ảnh) */
export default function SkyArt({ className }: { className?: string }) {
    const windows = [170, 206, 354, 390];
    return (
        <svg className={className} viewBox="0 0 560 440" role="img" aria-label="Minh họa ngôi trường dưới bầu trời xanh">
            <defs>
                <linearGradient id="skyArtBg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#6fc4f5" />
                    <stop offset="1" stopColor="#e8f7ff" />
                </linearGradient>
            </defs>
            <rect width="560" height="440" rx="28" fill="url(#skyArtBg)" />

            <circle cx="452" cy="96" r="72" fill="#ffd36b" opacity="0.32" />
            <circle cx="452" cy="96" r="44" fill="#ffb81c" />

            <g fill="#fff">
                <ellipse cx="124" cy="92" rx="56" ry="20" />
                <ellipse cx="158" cy="76" rx="34" ry="22" />
                <ellipse cx="96" cy="82" rx="28" ry="17" />
            </g>
            <g fill="#fff" opacity="0.9">
                <ellipse cx="350" cy="176" rx="40" ry="14" />
                <ellipse cx="374" cy="164" rx="24" ry="15" />
            </g>

            <path d="M0 362C140 342 420 342 560 362V440H0Z" fill="#cfeadf" />
            <path d="M0 392C160 376 400 376 560 392V440H0Z" fill="#b9e0d0" />

            {/* trường */}
            <rect x="150" y="252" width="260" height="110" fill="#fff" />
            <rect x="250" y="212" width="60" height="150" fill="#f4fbff" />
            <path d="M138 254 280 198 422 254Z" fill="#0b4a78" />
            <path d="M244 214 280 196 316 214Z" fill="#0a3b61" />
            <circle cx="280" cy="236" r="12" fill="#fff" stroke="#0b4a78" strokeWidth="3" />
            <path d="M280 236v-6M280 236l5 3" stroke="#0b4a78" strokeWidth="2" strokeLinecap="round" />
            {windows.map((x) => (
                <g key={x}>
                    <rect x={x} y="276" width="22" height="30" rx="2" fill="#7fcbf7" stroke="#0b4a78" strokeWidth="2" />
                    <rect x={x} y="320" width="22" height="30" rx="2" fill="#7fcbf7" stroke="#0b4a78" strokeWidth="2" />
                </g>
            ))}
            <rect x="262" y="312" width="36" height="50" rx="4" fill="#0b4a78" />
            <rect x="234" y="362" width="92" height="8" fill="#d3e4f1" />

            {/* cờ */}
            <path d="M280 198V150" stroke="#0b4a78" strokeWidth="3" strokeLinecap="round" />
            <path d="M280 150h40l-8 10 8 10h-40z" fill="#ee4b3c" />
            <path d="m300 155 1.800 5.200h5.400l-4.400 3.200 1.700 5.200-4.500-3.200-4.500 3.200 1.700-5.200-4.400-3.200h5.400z" fill="#ffd23f" />

            {/* cây phượng */}
            <rect x="74" y="276" width="12" height="90" fill="#8a5a44" />
            <circle cx="80" cy="252" r="44" fill="#2f9e73" />
            <circle cx="50" cy="272" r="28" fill="#2a8f68" />
            <circle cx="110" cy="272" r="30" fill="#2a8f68" />
            {[[60, 240], [92, 232], [104, 260], [46, 266], [78, 262], [118, 276]].map(([x, y]) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="6" fill="#ee4b3c" />
            ))}
            <rect x="476" y="300" width="9" height="64" fill="#8a5a44" />
            <circle cx="480" cy="286" r="30" fill="#2f9e73" />
            {[[470, 280], [492, 290], [482, 270]].map(([x, y]) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill="#ee4b3c" />
            ))}
        </svg>
    );
}
