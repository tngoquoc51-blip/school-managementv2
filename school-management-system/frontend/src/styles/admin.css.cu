/* ===== Admin Design System — School Management ===== */
.adm {
  --bg: #f3f5fb; --surface: #ffffff; --surface-2: #f8f9fd; --ink: #0f172a; --ink-2: #334155; --muted: #64748b;
  --line: #e6e9f2; --primary: #1d74d6; --primary-2: #0ea5e9; --primary-soft: #e2effd; --accent: #14b8a6; --accent-soft: #d9f7f2;
  --ok: #16a34a; --ok-soft: #dcfce7; --warn: #d97706; --warn-soft: #fef3c7; --danger: #e11d48; --danger-soft: #ffe4ea;
  --info: #0284c7; --info-soft: #e0f2fe;
  --side: #0b1220; --side-2: #131c31; --side-ink: #aab4cb;
  --shadow: 0 1px 2px rgba(15,23,42,.05), 0 8px 24px -12px rgba(15,23,42,.12);
  --shadow-lg: 0 24px 60px -22px rgba(10,53,88,.38);
  --radius: 18px;
  font-family: inherit;
  color: var(--ink); background: var(--bg); min-height: 100vh; display: flex; font-size: 14px; line-height: 1.5;
}
.adm[data-theme='dark'] {
  --bg: #0a0f1d; --surface: #111827; --surface-2: #0e1524; --ink: #e8ecf7; --ink-2: #c3cbe0; --muted: #8a96b2; --line: #1f2a44;
  --primary: #5cb3ff; --primary-soft: #0f2a4a; --accent-soft: #0c2f2c; --ok-soft: #0f2d1c; --warn-soft: #34270a;
  --danger-soft: #3a1220; --info-soft: #0b2a3f; --side: #060a14; --side-2: #0e1526;
  --shadow: 0 1px 2px rgba(0,0,0,.4), 0 10px 30px -14px rgba(0,0,0,.6);
}
.adm * { box-sizing: border-box; }
.adm a { color: inherit; text-decoration: none; }
.adm button { font-family: inherit; cursor: pointer; }
.adm ::-webkit-scrollbar { width: 9px; height: 9px; }
.adm ::-webkit-scrollbar-thumb { background: var(--line); border-radius: 99px; }
/* ---- Shared ---- */
.adm .a-ava { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--primary)); display: grid; place-items: center; font-weight: 700; flex-shrink: 0; color: #fff; }
@keyframes aFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
/* ---- Primitives ---- */
.adm .a-btn { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--ink-2);
  padding: 9px 14px; border-radius: 11px; font-weight: 600; font-size: 13px; transition: all .15s; white-space: nowrap; }
.adm .a-btn:hover { border-color: var(--primary); color: var(--primary); transform: translateY(-1px); }
.adm .a-btn:disabled { opacity: .55; cursor: not-allowed; transform: none; }
.adm .a-btn.pri { background: linear-gradient(135deg, var(--primary), var(--primary-2)); color: #fff; border-color: transparent; box-shadow: 0 10px 22px -10px rgba(29,116,214,.7); }
.adm .a-btn.pri:hover { color: #fff; filter: brightness(1.07); }
.adm .a-btn.dng { background: var(--danger); border-color: transparent; color: #fff; }
.adm .a-btn.dng:hover { color: #fff; filter: brightness(1.08); }
.adm .a-btn.ghost { border-color: transparent; background: transparent; }
.adm .a-btn.sm { padding: 6px 10px; font-size: 12px; border-radius: 9px; }
.adm .a-icon-btn { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); }
.adm .a-icon-btn:hover { color: var(--primary); border-color: var(--primary); }
.adm .a-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); }
.adm .a-card-h { padding: 18px 20px 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.adm .a-card-h h3 { margin: 0; font-size: 15px; }
.adm .a-card-b { padding: 18px 20px 20px; }
.adm .a-input, .adm .a-select, .adm .a-textarea { width: 100%; padding: 10px 12px; border-radius: 11px; border: 1px solid var(--line); background: var(--surface-2); color: var(--ink);
  font: inherit; outline: none; transition: border .15s, box-shadow .15s; }
.adm .a-input:focus, .adm .a-select:focus, .adm .a-textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 18%, transparent); background: var(--surface); }
.adm .a-field { display: flex; flex-direction: column; gap: 6px; }
.adm .a-field label { font-weight: 600; font-size: 12.5px; color: var(--ink-2); }
.adm .a-field .err { color: var(--danger); font-size: 12px; }
.adm .a-field .hint { color: var(--muted); font-size: 12px; }
.adm .a-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.adm .a-search { position: relative; flex: 1; min-width: 220px; }
.adm .a-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); }
.adm .a-search input { padding-left: 38px; }
.adm .a-badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 700; }
.adm .a-badge.ok { background: var(--ok-soft); color: var(--ok); }
.adm .a-badge.warn { background: var(--warn-soft); color: var(--warn); }
.adm .a-badge.dng { background: var(--danger-soft); color: var(--danger); }
.adm .a-badge.pri { background: var(--primary-soft); color: var(--primary); }
.adm .a-badge.info { background: var(--info-soft); color: var(--info); }
.adm .a-badge.mut { background: var(--surface-2); color: var(--muted); border: 1px solid var(--line); }
.adm .a-badge .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.adm .a-bar { height: 8px; border-radius: 99px; background: var(--line); overflow: hidden; }
.adm .a-bar i { display: block; height: 100%; border-radius: 99px; transition: width .6s cubic-bezier(.2,.8,.2,1); }
.adm .a-muted { color: var(--muted); }
.adm .a-row { display: flex; align-items: center; gap: 10px; }
.adm .a-wrap { flex-wrap: wrap; }
.adm .a-sp { flex: 1; }
/* ---- Page header ---- */
.adm .a-hero { position: relative; overflow: hidden; border-radius: 22px; padding: 26px 28px; color: #fff; margin-bottom: 22px;
  background: radial-gradient(1100px 320px at 100% 0%, rgba(34,211,238,.45), transparent 60%), linear-gradient(120deg, #0a3558, #0d5a94 55%, #1593d6); box-shadow: var(--shadow-lg); }
.adm .a-hero::after { content: ''; position: absolute; right: -40px; bottom: -60px; width: 240px; height: 240px; border-radius: 50%; border: 36px solid rgba(255,255,255,.08); }
.adm .a-hero h1 { margin: 0 0 4px; font-size: 24px; letter-spacing: -.02em; }
.adm .a-hero p { margin: 0; opacity: .85; max-width: 640px; }
.adm .a-hero .a-btn { background: rgba(255,255,255,.14); border-color: rgba(255,255,255,.25); color: #fff; backdrop-filter: blur(6px); }
.adm .a-hero .a-btn:hover { background: rgba(255,255,255,.24); color: #fff; }
.adm .a-hero .a-btn.white { background: #fff; color: var(--primary); border-color: #fff; }
.adm .a-crumb { font-size: 12.5px; opacity: .8; margin-bottom: 8px; display: flex; gap: 6px; align-items: center; }
.adm .a-crumb a:hover { text-decoration: underline; }
/* ---- Stats ---- */
.adm .a-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; margin-bottom: 22px; }
.adm .a-stat { padding: 18px; display: flex; gap: 14px; align-items: center; transition: transform .2s, box-shadow .2s; }
.adm .a-stat:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
.adm .a-stat .ic { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; flex-shrink: 0; }
.adm .a-stat b { font-size: 26px; letter-spacing: -.02em; display: block; line-height: 1.1; }
.adm .a-stat small { color: var(--muted); font-weight: 500; }
/* ---- Toolbar & chips ---- */
.adm .a-toolbar { padding: 14px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 18px; }
.adm .a-chips { display: flex; gap: 6px; background: var(--surface-2); padding: 4px; border-radius: 12px; border: 1px solid var(--line); }
.adm .a-chip { border: 0; background: transparent; color: var(--muted); padding: 7px 14px; border-radius: 9px; font-weight: 700; font-size: 12.5px; }
.adm .a-chip.on { background: var(--surface); color: var(--primary); box-shadow: var(--shadow); }
.adm .a-seg { display: inline-flex; background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 3px; }
.adm .a-seg button { border: 0; background: transparent; width: 34px; height: 30px; border-radius: 8px; color: var(--muted); display: grid; place-items: center; }
.adm .a-seg button.on { background: var(--surface); color: var(--primary); box-shadow: var(--shadow); }
/* ---- Class cards ---- */
.adm .a-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; }
.adm .a-class { padding: 18px; position: relative; transition: transform .2s, box-shadow .2s, border-color .2s; cursor: pointer; }
.adm .a-class:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); border-color: color-mix(in srgb, var(--primary) 45%, var(--line)); }
.adm .a-class .top-line { position: absolute; left: 0; right: 0; top: 0; height: 4px; border-radius: var(--radius) var(--radius) 0 0; }
.adm .g10 { --gc: #0ea5e9; --gs: #e0f2fe; }
.adm .g11 { --gc: #8b5cf6; --gs: #ede9fe; }
.adm .g12 { --gc: #f59e0b; --gs: #fef3c7; }
.adm[data-theme='dark'] .g10 { --gs: #0b2a3f; }
.adm[data-theme='dark'] .g11 { --gs: #241a45; }
.adm[data-theme='dark'] .g12 { --gs: #34270a; }
.adm .a-class .top-line { background: var(--gc); }
.adm .a-class .name { width: 54px; height: 54px; border-radius: 16px; background: var(--gs); color: var(--gc); display: grid; place-items: center; font-weight: 800; font-size: 17px; flex-shrink: 0; }
.adm .a-class h4 { margin: 0; font-size: 16px; }
.adm .a-class .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 14px 0; }
.adm .a-class .meta div { background: var(--surface-2); border-radius: 11px; padding: 8px 10px; text-align: center; }
.adm .a-class .meta b { display: block; font-size: 16px; }
.adm .a-class .meta small { color: var(--muted); font-size: 11px; }
.adm .a-menu { position: relative; }
.adm .a-pop { position: absolute; right: 0; top: 40px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow-lg); min-width: 190px; padding: 6px; z-index: 40; animation: aFade .15s; }
.adm .a-pop button { width: 100%; text-align: left; border: 0; background: transparent; padding: 9px 10px; border-radius: 8px; display: flex; gap: 10px; align-items: center; color: var(--ink-2); font-size: 13px; }
.adm .a-pop button:hover { background: var(--surface-2); }
.adm .a-pop button.d { color: var(--danger); }
/* ---- Table ---- */
.adm .a-table-wrap { overflow-x: auto; }
.adm table.a-table { width: 100%; border-collapse: collapse; }
.adm .a-table th { text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); padding: 12px 16px; background: var(--surface-2); border-bottom: 1px solid var(--line); white-space: nowrap; }
.adm .a-table th.s { cursor: pointer; user-select: none; }
.adm .a-table th.s:hover { color: var(--primary); }
.adm .a-table td { padding: 12px 16px; border-bottom: 1px solid var(--line); vertical-align: middle; }
.adm .a-table tr:hover td { background: var(--surface-2); }
.adm .a-table tr:last-child td { border-bottom: 0; }
.adm .a-pager { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; gap: 12px; flex-wrap: wrap; }
.adm .a-pager .pg { display: flex; gap: 6px; }
.adm .a-pager .pg button { min-width: 34px; height: 34px; border-radius: 9px; border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); font-weight: 600; }
.adm .a-pager .pg button.on { background: var(--primary); color: #fff; border-color: var(--primary); }
.adm .a-pager .pg button:disabled { opacity: .4; }
/* ---- Tabs ---- */
.adm .a-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin-bottom: 20px; overflow-x: auto; }
.adm .a-tab { border: 0; background: transparent; padding: 12px 16px; font-weight: 700; color: var(--muted); border-bottom: 3px solid transparent; display: flex; gap: 8px; align-items: center; white-space: nowrap; }
.adm .a-tab:hover { color: var(--ink); }
.adm .a-tab.on { color: var(--primary); border-color: var(--primary); }
.adm .a-tab .n { background: var(--primary-soft); color: var(--primary); border-radius: 99px; padding: 0 8px; font-size: 11px; }
/* ---- Modal / Drawer ---- */
.adm .a-ov { position: fixed; inset: 0; background: rgba(8,12,28,.55); backdrop-filter: blur(5px); z-index: 100; display: grid; place-items: center; padding: 20px; animation: aOv .2s; }
@keyframes aOv { from { opacity: 0; } to { opacity: 1; } }
.adm .a-modal { background: var(--surface); color: var(--ink); width: 100%; max-width: 620px; max-height: 92vh; display: flex; flex-direction: column; border-radius: 22px; box-shadow: var(--shadow-lg); animation: aPop .25s cubic-bezier(.2,.9,.3,1.2); border: 1px solid var(--line); }
.adm .a-modal.lg { max-width: 860px; }
.adm .a-modal.sm { max-width: 440px; }
@keyframes aPop { from { opacity: 0; transform: translateY(14px) scale(.96); } to { opacity: 1; transform: none; } }
.adm .a-modal-h { padding: 20px 24px 14px; display: flex; align-items: flex-start; gap: 12px; }
.adm .a-modal-h h3 { margin: 0; font-size: 18px; }
.adm .a-modal-h p { margin: 2px 0 0; color: var(--muted); font-size: 13px; }
.adm .a-modal-b { padding: 4px 24px 20px; overflow-y: auto; }
.adm .a-modal-f { padding: 14px 24px; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; gap: 10px; background: var(--surface-2); border-radius: 0 0 22px 22px; }
/* ---- Toast ---- */
.adm .a-toasts { position: fixed; top: 76px; right: 22px; z-index: 200; display: flex; flex-direction: column; gap: 10px; width: min(380px, calc(100vw - 32px)); }
.adm .a-toast { background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--c); border-radius: 14px; box-shadow: var(--shadow-lg); padding: 12px 14px; display: flex; gap: 12px; position: relative; overflow: hidden; animation: aToast .35s cubic-bezier(.2,.9,.3,1.1); }
@keyframes aToast { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: none; } }
.adm .a-toast .ti { width: 32px; height: 32px; border-radius: 10px; background: color-mix(in srgb, var(--c) 16%, transparent); color: var(--c); display: grid; place-items: center; flex-shrink: 0; }
.adm .a-toast b { display: block; font-size: 13.5px; }
.adm .a-toast span { color: var(--muted); font-size: 12.5px; }
.adm .a-toast .life { position: absolute; left: 0; bottom: 0; height: 3px; background: var(--c); animation: aLife var(--d) linear forwards; }
@keyframes aLife { from { width: 100%; } to { width: 0; } }
.adm .a-toast.success { --c: var(--ok); }
.adm .a-toast.error { --c: var(--danger); }
.adm .a-toast.warning { --c: var(--warn); }
.adm .a-toast.info { --c: var(--info); }
/* ---- Misc ---- */
.adm .a-empty { text-align: center; padding: 56px 20px; color: var(--muted); }
.adm .a-empty .ill { width: 84px; height: 84px; border-radius: 26px; background: var(--primary-soft); color: var(--primary); display: grid; place-items: center; margin: 0 auto 14px; }
.adm .a-skel { background: linear-gradient(90deg, var(--line) 25%, var(--surface-2) 50%, var(--line) 75%); background-size: 200% 100%; animation: aSk 1.2s infinite; border-radius: 12px; }
@keyframes aSk { to { background-position: -200% 0; } }
.adm .a-spin { width: 16px; height: 16px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: aSpin .7s linear infinite; display: inline-block; }
@keyframes aSpin { to { transform: rotate(360deg); } }
.adm .a-two { display: grid; grid-template-columns: 1.6fr 1fr; gap: 18px; }
.adm .a-kv { display: grid; grid-template-columns: 150px 1fr; gap: 10px 14px; }
.adm .a-kv dt { color: var(--muted); }
.adm .a-kv dd { margin: 0; font-weight: 600; }
.adm .a-sel-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line); cursor: pointer; }
.adm .a-sel-row:hover { border-color: var(--primary); }
.adm .a-sel-row.on { background: var(--primary-soft); border-color: var(--primary); }
.adm .a-check { width: 18px; height: 18px; accent-color: var(--primary); }
.adm .a-act { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px dashed var(--line); }
.adm .a-act i { width: 10px; height: 10px; border-radius: 50%; background: var(--primary); margin-top: 6px; flex-shrink: 0; box-shadow: 0 0 0 4px var(--primary-soft); }
/* ---- Timetable ---- */
.adm .a-tt { display: grid; grid-template-columns: 96px repeat(6, minmax(120px, 1fr)); gap: 8px; min-width: 860px; }
.adm .a-tt .hd { text-align: center; font-weight: 800; padding: 10px 0; border-radius: 12px; background: var(--primary-soft); color: var(--primary); }
.adm .a-tt .pr { display: flex; flex-direction: column; justify-content: center; align-items: center; background: var(--surface-2); border-radius: 12px; font-weight: 800; border: 1px solid var(--line); }
.adm .a-tt .pr small { color: var(--muted); font-weight: 500; font-size: 11px; }
.adm .a-slot { min-height: 76px; border-radius: 14px; border: 1.5px dashed var(--line); background: var(--surface-2); padding: 8px 10px; text-align: left; color: var(--muted); transition: all .15s; position: relative; }
.adm .a-slot:hover { border-color: var(--primary); transform: translateY(-2px); }
.adm .a-slot.f { border-style: solid; border-color: transparent; color: #fff; background: var(--sc); box-shadow: 0 10px 20px -12px var(--sc); }
.adm .a-slot b { display: block; font-size: 13px; }
.adm .a-slot small { opacity: .85; font-size: 11.5px; }
.adm .a-slot.dirty::after { content: ''; position: absolute; top: 8px; right: 8px; width: 8px; height: 8px; border-radius: 50%; background: #fde047; }
@media (max-width: 1100px) {
.adm .a-two { grid-template-columns: 1fr; }
.adm .a-side { position: fixed; left: 0; transform: translateX(-100%); }
.adm.open .a-side { transform: none; width: 264px; }
}
@media (max-width: 640px) {
.adm .a-grid2 { grid-template-columns: 1fr; }
.adm .a-content { padding: 18px 14px 40px; }
.adm .a-top { padding: 0 14px; }
}

/* Nhúng trang vào layout admin có sẵn (không đụng tới menu/sidebar của bạn) */

/* Đồng bộ với Dashboard: thẻ thống kê có viền màu bên trái */
.adm .a-stat { border-left: 4px solid var(--sc, var(--primary)); }

/* Liên kết nhanh sang các trang khác */
.adm .a-links { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; align-items: center; }
.adm .a-links .lbl { font-weight: 700; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; margin-right: 4px; }
.adm .a-link { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line);
  color: var(--ink-2); font-weight: 600; font-size: 13px; transition: all .15s; box-shadow: var(--shadow); }
.adm .a-link:hover { color: var(--primary); border-color: var(--primary); transform: translateY(-2px); }
.adm .a-link .ic { color: var(--primary); display: grid; place-items: center; }

/* ===== Giao diện đồng bộ Dashboard (v2) ===== */
.adm.adm-embed { display: block; min-height: calc(100vh - 150px); background: #eef5fc; border-radius: 24px; padding: 24px; }

/* Tiêu đề trang: thẻ trắng viền xanh, không còn banner gradient nặng */
.adm .a-hero { background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-left: 5px solid var(--primary); box-shadow: var(--shadow); padding: 20px 24px; border-radius: 20px; }
.adm .a-hero::after { display: none; }
.adm .a-hero h1 { color: var(--ink); font-size: 22px; }
.adm .a-hero p { color: var(--muted); opacity: 1; }
.adm .a-hero .a-btn { background: var(--surface); border-color: var(--line); color: var(--ink-2); backdrop-filter: none; }
.adm .a-hero .a-btn:hover { background: var(--surface); color: var(--primary); border-color: var(--primary); }
.adm .a-hero .a-btn.white { background: linear-gradient(135deg, var(--primary), var(--primary-2)); color: #fff; border-color: transparent; box-shadow: 0 10px 22px -10px rgba(29,116,214,.7); }
.adm .a-hero .a-btn.white:hover { color: #fff; }
.adm .a-crumb { color: var(--muted); opacity: 1; }

/* Thẻ chức năng (giống "Truy cập nhanh" của Dashboard) */
.adm .a-sec { display: flex; align-items: baseline; gap: 12px; margin: 4px 2px 12px; flex-wrap: wrap; }
.adm .a-sec h3 { margin: 0; font-size: 16px; }
.adm .a-sec small { color: var(--muted); }
.adm .a-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px; margin-bottom: 22px; }
.adm .a-tile { display: flex; align-items: center; gap: 14px; text-align: left; width: 100%; padding: 16px; border-radius: 16px; background: var(--surface);
  border: 1px solid var(--line); color: var(--ink); cursor: pointer; transition: all .18s; font: inherit; }
.adm .a-tile:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); border-color: var(--tc); }
.adm .a-tile.on { border-color: var(--tc); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tc) 18%, transparent); }
.adm .a-tile .ti { width: 46px; height: 46px; border-radius: 14px; background: var(--tb); color: var(--tc); display: grid; place-items: center; flex-shrink: 0; }
.adm .a-tile b { display: block; font-size: 14.5px; }
.adm .a-tile small { display: block; color: var(--muted); font-size: 12.5px; margin-top: 2px; }
.adm .a-tile .go { margin-left: auto; color: var(--muted); display: grid; place-items: center; }
.adm .t-blue { --tc: #1d74d6; --tb: #e2effd; }
.adm .t-teal { --tc: #0f9d8f; --tb: #d9f7f2; }
.adm .t-violet { --tc: #7c5cf0; --tb: #ece8ff; }
.adm .t-amber { --tc: #d98206; --tb: #fff1d6; }
.adm .t-rose { --tc: #e11d6a; --tb: #ffe4ee; }
.adm .t-green { --tc: #16a34a; --tb: #dcfce7; }

/* Khu làm việc của từng chức năng */
.adm .a-ws { overflow: hidden; margin-bottom: 18px; }
.adm .a-ws-h { display: flex; align-items: center; gap: 12px; padding: 18px 20px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.adm .a-ws-h h3 { margin: 0; font-size: 16px; }
.adm .a-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; padding: 16px 20px; }
.adm .a-kpi { background: var(--surface-2); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; }
.adm .a-kpi b { display: block; font-size: 20px; }
.adm .a-kpi small { color: var(--muted); }

/* Chọn lớp */
.adm .a-pick { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.adm .a-pickrow { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border: 1px solid var(--line); background: var(--surface); border-radius: 14px; color: var(--ink); transition: all .15s; }
.adm .a-pickrow:hover { border-color: var(--gc); transform: translateY(-2px); box-shadow: var(--shadow); }
.adm .a-pickrow .nm { width: 44px; height: 44px; border-radius: 12px; background: var(--gs); color: var(--gc); display: grid; place-items: center; font-weight: 800; font-size: 13px; flex-shrink: 0; }
