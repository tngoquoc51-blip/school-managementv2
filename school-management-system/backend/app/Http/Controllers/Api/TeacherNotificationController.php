<?php

namespace App\Http\Controllers\Api;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Cổng giáo viên – TRUNG TÂM THÔNG BÁO (đi sau middleware StaffToken, prefix teacher/nt).
 * Đường dẫn thật: /api/gv/teacher/nt/...
 *
 * Nguồn thông báo hiển thị trong hộp thư của giáo viên:
 *   1) Thông báo nhà trường phát hành (bảng sm_nt_items, audience = all | teacher)
 *   2) Nhắc việc cá nhân đến hạn (sm_nt_items, audience = self)
 *   3) Thông báo TỰ SINH từ dữ liệu hệ thống (không lưu bảng riêng):
 *        - tiết đã dạy xong nhưng chưa điểm danh   (sm_timetable + sm_att_lessons)
 *        - kết quả duyệt yêu cầu đổi tiết/dạy bù    (sm_tt_requests)
 *        - sắp đến giờ dạy                          (sm_timetable + sm_periods)
 * Trạng thái đọc / gắn sao / lưu trữ / tạm hoãn của từng giáo viên lưu ở sm_nt_state.
 * Giáo viên cũng gửi được thông báo cho học sinh của lớp mình dạy (sm_nt_outbox, sm_nt_outbox_rcpt).
 */
class TeacherNotificationController extends LessonAttendanceStaffController
{
    private const TZ = 'Asia/Ho_Chi_Minh';
    private const ADMIN = ['academic', 'principal', 'vice_principal', 'super_admin'];
    public const KINDS = ['announcement' => 'Thông báo', 'schedule' => 'Thời khóa biểu', 'attendance' => 'Điểm danh', 'exam' => 'Kiểm tra – thi', 'finance' => 'Tài chính', 'event' => 'Sự kiện', 'system' => 'Hệ thống', 'reminder' => 'Nhắc việc'];
    private const PRIO = ['normal', 'high', 'urgent'];
    private const REQ = ['swap' => 'đổi tiết', 'makeup' => 'dạy bù', 'absent' => 'xin nghỉ tiết', 'room' => 'đổi phòng'];

    /* ---------- tiện ích ---------- */
    private function now(): Carbon { return Carbon::now(self::TZ); }
    private function utc(): string { return now()->format('Y-m-d H:i:s'); }
    private function iso($s): ?string { return $s ? Carbon::parse($s, 'UTC')->format('Y-m-d\TH:i:s\Z') : null; }
    private function yearId(): int { return (int) (DB::table('sm_school_years')->where('is_current', 1)->value('id') ?: DB::table('sm_school_years')->max('id')); }
    /** Chuỗi giờ địa phương (datetime-local) → UTC để lưu */
    private function fromLocal($s): ?string
    {
        if ($s === null || trim((string) $s) === '') return null;
        try { return Carbon::parse((string) $s, self::TZ)->setTimezone('UTC')->format('Y-m-d H:i:s'); }
        catch (\Throwable $e) { abort(422, 'Thời gian không hợp lệ.'); }
    }
    private function who(Request $r): array
    {
        $st = $this->staff($r); $admin = in_array($st->role, self::ADMIN, true); $own = (int) ($st->teacher_id ?? 0);
        $tid = in_array($st->role, ['teacher', 'homeroom_teacher'], true) ? $own : ((int) $r->query('teacher_id', 0) ?: $own);
        return [$st, $tid, $admin];
    }
    /** Hộp thư là của từng giáo viên nên bắt buộc phải xác định được giáo viên */
    private function need(Request $r): array
    {
        [$st, $tid, $admin] = $this->who($r);
        abort_unless($tid > 0, 422, 'Tài khoản này chưa gắn với giáo viên nào (cột teacher_id trong sm_staff_accounts đang trống). Hãy đăng nhập bằng tài khoản giáo viên.');
        return [$st, $tid, $admin];
    }
    private function prefsOf(int $tid): array
    {
        $p = DB::table('sm_nt_prefs')->where('teacher_id', $tid)->first();
        return ['muted' => $p && $p->muted !== '' ? array_values(array_filter(explode(',', $p->muted))) : [], 'quiet_from' => $p->quiet_from ?? null, 'quiet_to' => $p->quiet_to ?? null,
            'sound' => $p ? (bool) $p->sound : true, 'desktop' => $p ? (bool) $p->desktop : false, 'auto_read' => $p ? (bool) $p->auto_read : false];
    }

    /* ---------- nguồn thông báo ---------- */
    /** Các tiết dạy của giáo viên trong 1 ngày */
    private function dayRows(int $tid, string $date, int $yid): array
    {
        $wd = (int) date('N', strtotime($date)) + 1; if ($wd > 7) return [];
        return DB::select("SELECT t.period, p.start_time, p.end_time, cs.id cs_id, c.name class_name, s.name subject
            FROM sm_timetable t JOIN sm_class_subjects cs ON cs.id = t.class_subject_id JOIN sm_classes c ON c.id = cs.class_id
            JOIN sm_subjects s ON s.id = cs.subject_id LEFT JOIN sm_periods p ON p.id = t.period
            WHERE cs.teacher_id = ? AND t.weekday = ? AND c.school_year_id = ? ORDER BY t.period", [$tid, $wd, $yid]);
    }

    /** Thông báo tự sinh từ dữ liệu hệ thống */
    private function derived(int $tid): array
    {
        $out = []; $now = $this->now(); $today = $now->toDateString(); $hm = $now->format('H:i'); $yid = $this->yearId();
        try {
            foreach ([0, 1, 2] as $back) {
                $date = $now->copy()->subDays($back)->toDateString();
                $rows = $this->dayRows($tid, $date, $yid); if (!$rows) continue;
                $marked = []; foreach (DB::select('SELECT class_subject_id cs, period p FROM sm_att_lessons WHERE att_date = ? GROUP BY class_subject_id, period', [$date]) as $m) $marked["{$m->cs}|{$m->p}"] = 1;
                foreach ($rows as $x) {
                    $end = $x->end_time ? substr((string) $x->end_time, 0, 5) : null; $start = $x->start_time ? substr((string) $x->start_time, 0, 5) : null;
                    $ended = $date < $today || ($end !== null && $end < $hm);
                    if ($ended && !isset($marked["{$x->cs_id}|{$x->period}"])) {
                        $when = $end ? Carbon::parse("$date $end:00", self::TZ)->setTimezone('UTC')->format('Y-m-d H:i:s') : $this->utc();
                        $out[] = ['key' => "d:att:{$x->cs_id}:{$date}:{$x->period}", 'src' => 'auto', 'id' => null, 'kind' => 'attendance', 'priority' => $back > 0 ? 'high' : 'normal',
                            'title' => "Chưa điểm danh: {$x->subject} – lớp {$x->class_name} (tiết {$x->period})",
                            'body' => "Tiết {$x->period}" . ($start && $end ? " ({$start}–{$end})" : '') . ' ngày ' . Carbon::parse($date)->format('d/m/Y') . ' đã kết thúc nhưng chưa có dữ liệu điểm danh. Hãy mở điểm danh để ghi nhận sĩ số và gửi sổ.',
                            'link' => '/teacher/attendance', 'sender' => 'Hệ thống điểm danh', 'sender_role' => 'system', 'pinned' => false, 'created_at' => $this->iso($when), 'due_at' => null];
                    } elseif ($date === $today && $start && $start > $hm && Carbon::parse("$date $start:00", self::TZ)->diffInMinutes($now) <= 45) {
                        $out[] = ['key' => "d:next:{$x->cs_id}:{$date}:{$x->period}", 'src' => 'auto', 'id' => null, 'kind' => 'schedule', 'priority' => 'normal',
                            'title' => "Sắp đến giờ dạy: {$x->subject} – lớp {$x->class_name}", 'body' => "Tiết {$x->period} bắt đầu lúc {$start}" . ($end ? ", kết thúc {$end}" : '') . '. Chuẩn bị giáo án và điểm danh khi vào lớp.',
                            'link' => '/teacher/schedule', 'sender' => 'Thời khóa biểu', 'sender_role' => 'system', 'pinned' => false, 'created_at' => $this->iso($this->utc()), 'due_at' => null];
                    }
                }
            }
        } catch (\Throwable $e) { /* chưa có bảng điểm danh / thời khóa biểu thì bỏ qua */ }
        try {
            $rows = DB::select("SELECT q.id, q.kind, q.status, q.att_date, q.period, q.review_note, q.reviewed_at, c.name class_name FROM sm_tt_requests q LEFT JOIN sm_classes c ON c.id = q.class_id
                WHERE q.teacher_id = ? AND q.status IN ('approved','rejected') AND q.reviewed_at >= ? ORDER BY q.reviewed_at DESC LIMIT 30", [$tid, now()->subDays(30)->format('Y-m-d H:i:s')]);
            foreach ($rows as $q) {
                $ok = $q->status === 'approved'; $lab = self::REQ[$q->kind] ?? $q->kind;
                $out[] = ['key' => "d:ttr:{$q->id}:{$q->status}", 'src' => 'auto', 'id' => null, 'kind' => 'schedule', 'priority' => $ok ? 'normal' : 'high',
                    'title' => 'Yêu cầu ' . $lab . ($ok ? ' đã được duyệt' : ' bị từ chối') . ' – lớp ' . ($q->class_name ?: ''),
                    'body' => 'Tiết ' . $q->period . ' ngày ' . Carbon::parse($q->att_date)->format('d/m/Y') . '.' . ($q->review_note ? ' Ghi chú của người duyệt: ' . $q->review_note : ''),
                    'link' => '/teacher/schedule/yeu-cau', 'sender' => 'Ban giám hiệu', 'sender_role' => 'principal', 'pinned' => false, 'created_at' => $this->iso($q->reviewed_at), 'due_at' => null];
            }
        } catch (\Throwable $e) { /* chưa cài module thời khóa biểu giáo viên */ }
        return $out;
    }

    /** Thông báo lưu trong sm_nt_items dành cho giáo viên này */
    private function stored(int $tid): array
    {
        $now = $this->utc(); $soon = now()->addDay()->format('Y-m-d H:i:s'); $out = [];
        $rows = DB::select("SELECT * FROM sm_nt_items WHERE status = 'active' AND (expires_at IS NULL OR expires_at > ?) AND (audience = 'all' OR (audience IN ('teacher','self') AND teacher_id = ?))
            ORDER BY created_at DESC, id DESC LIMIT 400", [$now, $tid]);
        foreach ($rows as $x) {
            $pr = in_array($x->priority, self::PRIO, true) ? $x->priority : 'normal'; $created = $x->created_at; $due = $x->due_at;
            if ($x->kind === 'reminder') {   // nhắc việc chỉ vào hộp thư khi sắp đến hạn / quá hạn và chưa xong
                if ($x->done_at || !$due || $due > $soon) continue;
                $created = $due; if ($due < $now) $pr = 'urgent'; elseif ($pr === 'normal') $pr = 'high';
            }
            $out[] = ['key' => 'i:' . $x->id, 'src' => 'stored', 'id' => (int) $x->id, 'kind' => isset(self::KINDS[$x->kind]) ? $x->kind : 'announcement', 'priority' => $pr, 'title' => $x->title, 'body' => $x->body, 'link' => $x->link,
                'sender' => $x->audience === 'self' ? 'Nhắc việc của tôi' : ($x->sender_name ?: 'Nhà trường'), 'sender_role' => $x->sender_role, 'pinned' => (bool) $x->pinned, 'created_at' => $this->iso($created), 'due_at' => $this->iso($due)];
        }
        return $out;
    }

    /** Hộp thư đã ghép trạng thái của giáo viên: pinned → mới nhất */
    private function mailbox(int $tid): array
    {
        $st = []; foreach (DB::table('sm_nt_state')->where('teacher_id', $tid)->get() as $s) $st[$s->item_key] = $s;
        $nowU = $this->utc(); $items = array_merge($this->stored($tid), $this->derived($tid));
        foreach ($items as &$it) {
            $s = $st[$it['key']] ?? null;
            $it['read'] = (bool) ($s && $s->read_at); $it['starred'] = (bool) ($s && $s->starred); $it['archived'] = (bool) ($s && $s->archived_at);
            $it['snoozed'] = (bool) ($s && $s->snooze_until && $s->snooze_until > $nowU); $it['snooze_until'] = $it['snoozed'] ? $this->iso($s->snooze_until) : null;
        }
        unset($it);
        usort($items, fn ($a, $b) => [(int) $b['pinned'], $b['created_at']] <=> [(int) $a['pinned'], $a['created_at']]);
        return $items;
    }

    /** Loại thông báo bị tắt trong cài đặt (vẫn hiện nếu khẩn cấp hoặc được ghim) */
    private function hidden(array $it, array $muted): bool { return in_array($it['kind'], $muted, true) && $it['priority'] !== 'urgent' && !$it['pinned']; }

    /* ---------- tổng quan & hộp thư ---------- */
    public function overview(Request $r)
    {
        [, $tid] = $this->need($r); $this->flush();
        $pf = $this->prefsOf($tid); $all = $this->mailbox($tid); $live = array_values(array_filter($all, fn ($i) => !$i['archived'] && !$i['snoozed'] && !$this->hidden($i, $pf['muted'])));
        $unread = array_values(array_filter($live, fn ($i) => !$i['read']));
        $byKind = []; foreach ($unread as $i) $byKind[$i['kind']] = ($byKind[$i['kind']] ?? 0) + 1;
        $days = []; for ($k = 13; $k >= 0; $k--) $days[$this->now()->subDays($k)->toDateString()] = 0;
        foreach ($all as $i) { $d = Carbon::parse($i['created_at'])->setTimezone(self::TZ)->toDateString(); if (isset($days[$d])) $days[$d]++; }
        $today = $this->now()->toDateString(); $now = $this->utc(); $soon = now()->addDay()->format('Y-m-d H:i:s');
        $rem = DB::selectOne("SELECT COUNT(*) open_n, COALESCE(SUM(due_at IS NOT NULL AND due_at < ?),0) overdue, COALESCE(SUM(due_at IS NOT NULL AND due_at >= ? AND due_at <= ?),0) soon
            FROM sm_nt_items WHERE audience = 'self' AND teacher_id = ? AND kind = 'reminder' AND status = 'active' AND done_at IS NULL", [$now, $now, $soon, $tid]);
        $ob = DB::selectOne("SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN status='sent' THEN recipients END),0) rc, COALESCE(SUM(status='scheduled'),0) sch FROM sm_nt_outbox WHERE teacher_id = ? AND status <> 'cancelled' AND created_at >= ?", [$tid, now()->subDays(30)->format('Y-m-d H:i:s')]);
        return response()->json([
            'today' => $today,
            'counts' => ['all' => count($live), 'unread' => count($unread), 'urgent' => count(array_filter($unread, fn ($i) => $i['priority'] === 'urgent')), 'high' => count(array_filter($unread, fn ($i) => $i['priority'] === 'high')),
                'starred' => count(array_filter($all, fn ($i) => $i['starred'] && !$i['archived'])), 'snoozed' => count(array_filter($all, fn ($i) => $i['snoozed'] && !$i['archived'])), 'archived' => count(array_filter($all, fn ($i) => $i['archived']))],
            'by_kind' => $byKind, 'by_day' => array_map(fn ($d, $n) => ['date' => $d, 'n' => $n], array_keys($days), array_values($days)),
            'attention' => array_slice(array_values(array_filter($unread, fn ($i) => $i['priority'] !== 'normal' || $i['pinned'])), 0, 5),
            'todo' => array_slice(array_values(array_filter($live, fn ($i) => str_starts_with($i['key'], 'd:att:'))), 0, 6),
            'next' => (function () use ($live) { foreach ($live as $i) if (str_starts_with($i['key'], 'd:next:')) return $i; return null; })(),
            'recent' => array_slice($live, 0, 6),
            'reminders' => ['open' => (int) $rem->open_n, 'overdue' => (int) $rem->overdue, 'soon' => (int) $rem->soon],
            'outbox' => ['sent' => (int) $ob->n, 'recipients' => (int) $ob->rc, 'scheduled' => (int) $ob->sch],
        ]);
    }

    public function index(Request $r)
    {
        [, $tid] = $this->need($r);
        $tab = in_array($r->query('tab'), ['all', 'unread', 'starred', 'snoozed', 'archived'], true) ? $r->query('tab') : 'all';
        $kind = isset(self::KINDS[$r->query('kind')]) ? $r->query('kind') : ''; $prio = in_array($r->query('priority'), self::PRIO, true) ? $r->query('priority') : '';
        $q = mb_strtolower(trim((string) $r->query('q', ''))); $page = max(1, (int) $r->query('page', 1)); $per = 30;
        $pf = $this->prefsOf($tid); $all = $this->mailbox($tid);
        $vis = fn ($i) => !$this->hidden($i, $pf['muted']) || $kind === $i['kind'];
        $counts = ['all' => 0, 'unread' => 0, 'starred' => 0, 'snoozed' => 0, 'archived' => 0]; $byKind = [];
        foreach ($all as $i) {
            if ($i['archived']) { $counts['archived']++; continue; }
            if ($i['starred']) $counts['starred']++;
            if ($i['snoozed']) { $counts['snoozed']++; continue; }
            if ($this->hidden($i, $pf['muted'])) continue;
            $counts['all']++; if (!$i['read']) { $counts['unread']++; $byKind[$i['kind']] = ($byKind[$i['kind']] ?? 0) + 1; }
        }
        $rows = array_values(array_filter($all, function ($i) use ($tab, $kind, $prio, $q, $vis) {
            if ($kind && $i['kind'] !== $kind) return false; if ($prio && $i['priority'] !== $prio) return false;
            if ($q !== '' && !str_contains(mb_strtolower($i['title'] . ' ' . $i['body'] . ' ' . $i['sender']), $q)) return false;
            return match ($tab) {
                'unread' => !$i['read'] && !$i['archived'] && !$i['snoozed'] && $vis($i),
                'starred' => $i['starred'] && !$i['archived'],
                'snoozed' => $i['snoozed'] && !$i['archived'],
                'archived' => $i['archived'],
                default => !$i['archived'] && !$i['snoozed'] && $vis($i),
            };
        }));
        $total = count($rows);
        return response()->json(['meta' => ['total' => $total, 'page' => $page, 'per' => $per, 'pages' => max(1, (int) ceil($total / $per))], 'counts' => $counts, 'by_kind' => $byKind, 'kinds' => self::KINDS, 'data' => array_slice($rows, ($page - 1) * $per, $per)]);
    }

    /** Đọc / chưa đọc / gắn sao / lưu trữ / tạm hoãn cho một hoặc nhiều thông báo */
    public function state(Request $r)
    {
        [, $tid] = $this->need($r);
        $d = $r->validate(['keys' => 'required|array|min:1|max:100', 'keys.*' => ['required', 'string', 'max:80', 'regex:/^(i:\d+|d:[A-Za-z0-9:_\-]+)$/'],
            'action' => 'required|in:read,unread,star,unstar,archive,unarchive,snooze,unsnooze', 'minutes' => 'nullable|integer|min:5|max:43200', 'until' => 'nullable|string|max:25']);
        $until = null;
        if ($d['action'] === 'snooze') {
            $until = !empty($d['minutes']) ? now()->addMinutes((int) $d['minutes'])->format('Y-m-d H:i:s') : $this->fromLocal($d['until'] ?? null);
            abort_unless($until && $until > $this->utc(), 422, 'Hãy chọn thời điểm nhắc lại trong tương lai.');
        }
        $now = $this->utc(); $n = 0;
        foreach (array_unique($d['keys']) as $key) {
            $row = DB::table('sm_nt_state')->where('teacher_id', $tid)->where('item_key', $key)->first();
            $set = ['updated_at' => $now];
            switch ($d['action']) {
                case 'read': $set['read_at'] = $now; break;
                case 'unread': $set['read_at'] = null; break;
                case 'star': $set['starred'] = 1; break;
                case 'unstar': $set['starred'] = 0; break;
                case 'archive': $set['archived_at'] = $now; if (!$row || !$row->read_at) $set['read_at'] = $now; break;
                case 'unarchive': $set['archived_at'] = null; break;
                case 'snooze': $set['snooze_until'] = $until; break;
                case 'unsnooze': $set['snooze_until'] = null; break;
            }
            if ($row) DB::table('sm_nt_state')->where('id', $row->id)->update($set);
            else DB::table('sm_nt_state')->insert(array_merge(['teacher_id' => $tid, 'item_key' => $key, 'read_at' => null, 'starred' => 0, 'archived_at' => null, 'snooze_until' => null], $set));
            $n++;
        }
        return response()->json(['message' => 'Đã cập nhật.', 'n' => $n]);
    }

    /** Đánh dấu đã đọc tất cả (có thể giới hạn theo loại) */
    public function readAll(Request $r)
    {
        [, $tid] = $this->need($r); $kind = $r->input('kind'); $pf = $this->prefsOf($tid); $now = $this->utc(); $n = 0;
        foreach ($this->mailbox($tid) as $i) {
            if ($i['read'] || $i['archived'] || $i['snoozed'] || $this->hidden($i, $pf['muted'])) continue; if ($kind && $i['kind'] !== $kind) continue;
            $row = DB::table('sm_nt_state')->where('teacher_id', $tid)->where('item_key', $i['key'])->first();
            if ($row) DB::table('sm_nt_state')->where('id', $row->id)->update(['read_at' => $now, 'updated_at' => $now]);
            else DB::table('sm_nt_state')->insert(['teacher_id' => $tid, 'item_key' => $i['key'], 'read_at' => $now, 'starred' => 0, 'archived_at' => null, 'snooze_until' => null, 'updated_at' => $now]);
            $n++;
        }
        return response()->json(['message' => "Đã đánh dấu {$n} thông báo là đã đọc.", 'n' => $n]);
    }

    /* ---------- cài đặt ---------- */
    public function prefs(Request $r) { [, $tid] = $this->need($r); return response()->json(['data' => $this->prefsOf($tid), 'kinds' => self::KINDS]); }

    public function prefsSave(Request $r)
    {
        [, $tid] = $this->need($r);
        $d = $r->validate(['muted' => 'nullable|array', 'muted.*' => 'string|in:' . implode(',', array_keys(self::KINDS)), 'quiet_from' => ['nullable', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'], 'quiet_to' => ['nullable', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'sound' => 'nullable|boolean', 'desktop' => 'nullable|boolean', 'auto_read' => 'nullable|boolean']);
        $row = ['muted' => implode(',', array_values(array_unique($d['muted'] ?? []))), 'quiet_from' => $d['quiet_from'] ?? null, 'quiet_to' => $d['quiet_to'] ?? null,
            'sound' => !empty($d['sound']) ? 1 : 0, 'desktop' => !empty($d['desktop']) ? 1 : 0, 'auto_read' => !empty($d['auto_read']) ? 1 : 0, 'updated_at' => $this->utc()];
        if (DB::table('sm_nt_prefs')->where('teacher_id', $tid)->exists()) DB::table('sm_nt_prefs')->where('teacher_id', $tid)->update($row); else DB::table('sm_nt_prefs')->insert(['teacher_id' => $tid] + $row);
        return response()->json(['message' => 'Đã lưu cài đặt thông báo.']);
    }

    /* ---------- nhắc việc cá nhân ---------- */
    public function reminders(Request $r)
    {
        [, $tid] = $this->need($r); $tab = in_array($r->query('tab'), ['open', 'done', 'all'], true) ? $r->query('tab') : 'open'; $now = $this->utc();
        $q = DB::table('sm_nt_items')->where('audience', 'self')->where('teacher_id', $tid)->where('kind', 'reminder')->where('status', 'active');
        $cnt = ['open' => (clone $q)->whereNull('done_at')->count(), 'done' => (clone $q)->whereNotNull('done_at')->count()];
        if ($tab === 'open') $q->whereNull('done_at'); elseif ($tab === 'done') $q->whereNotNull('done_at');
        $rows = $q->orderByRaw('done_at IS NOT NULL')->orderByRaw('due_at IS NULL')->orderBy('due_at')->orderByDesc('id')->limit(200)->get();
        return response()->json(['counts' => $cnt, 'data' => $rows->map(fn ($x) => ['id' => (int) $x->id, 'title' => $x->title, 'body' => $x->body, 'priority' => $x->priority, 'link' => $x->link, 'due_at' => $this->iso($x->due_at), 'done_at' => $this->iso($x->done_at),
            'overdue' => !$x->done_at && $x->due_at && $x->due_at < $now, 'created_at' => $this->iso($x->created_at)])->all()]);
    }

    public function reminderSave(Request $r, ?int $id = null)
    {
        [, $tid] = $this->need($r);
        $d = $r->validate(['title' => 'required|string|min:2|max:200', 'body' => 'nullable|string|max:2000', 'priority' => 'nullable|in:' . implode(',', self::PRIO), 'due_at' => 'nullable|string|max:25', 'link' => ['nullable', 'string', 'max:255', 'regex:/^\//']]);
        $row = ['title' => trim($d['title']), 'body' => $d['body'] ?? null, 'priority' => $d['priority'] ?? 'normal', 'link' => $d['link'] ?? null, 'due_at' => $this->fromLocal($d['due_at'] ?? null), 'updated_at' => $this->utc()];
        if ($id) {
            $n = DB::table('sm_nt_items')->where('id', $id)->where('audience', 'self')->where('teacher_id', $tid)->where('kind', 'reminder')->update($row);
            abort_unless($n || DB::table('sm_nt_items')->where('id', $id)->where('teacher_id', $tid)->exists(), 404, 'Không tìm thấy nhắc việc.');
            return response()->json(['message' => 'Đã cập nhật nhắc việc.']);
        }
        abort_if(DB::table('sm_nt_items')->where('audience', 'self')->where('teacher_id', $tid)->where('kind', 'reminder')->whereNull('done_at')->count() >= 200, 422, 'Bạn đang có quá nhiều nhắc việc chưa xong (tối đa 200).');
        $nid = DB::table('sm_nt_items')->insertGetId($row + ['kind' => 'reminder', 'audience' => 'self', 'teacher_id' => $tid, 'status' => 'active', 'pinned' => 0, 'sender_name' => 'Nhắc việc của tôi', 'sender_role' => 'teacher', 'created_at' => $this->utc()]);
        return response()->json(['message' => 'Đã thêm nhắc việc.', 'id' => $nid]);
    }

    public function reminderDone(Request $r, int $id)
    {
        [, $tid] = $this->need($r); $done = (bool) $r->input('done', true);
        $n = DB::table('sm_nt_items')->where('id', $id)->where('audience', 'self')->where('teacher_id', $tid)->where('kind', 'reminder')->update(['done_at' => $done ? $this->utc() : null, 'updated_at' => $this->utc()]);
        abort_unless($n, 404, 'Không tìm thấy nhắc việc.');
        return response()->json(['message' => $done ? 'Đã hoàn thành.' : 'Đã mở lại nhắc việc.']);
    }

    public function reminderDelete(Request $r, int $id)
    {
        [, $tid] = $this->need($r);
        $n = DB::table('sm_nt_items')->where('id', $id)->where('audience', 'self')->where('teacher_id', $tid)->where('kind', 'reminder')->delete();
        abort_unless($n, 404, 'Không tìm thấy nhắc việc.');
        DB::table('sm_nt_state')->where('teacher_id', $tid)->where('item_key', 'i:' . $id)->delete();
        return response()->json(['message' => 'Đã xóa nhắc việc.']);
    }

    /* ---------- gửi thông báo cho học sinh ---------- */
    /** Lớp mà giáo viên được phép gửi: lớp đang dạy + lớp chủ nhiệm */
    public function classes(Request $r)
    {
        [, $tid] = $this->need($r); $yid = $this->yearId();
        $rows = DB::select("SELECT c.id, c.name, c.grade, (SELECT COUNT(*) FROM sm_enrollments e WHERE e.class_id = c.id AND e.school_year_id = c.school_year_id) total, (c.homeroom_teacher_id = ?) is_home
            FROM sm_classes c WHERE c.school_year_id = ? AND (c.homeroom_teacher_id = ? OR EXISTS (SELECT 1 FROM sm_class_subjects cs WHERE cs.class_id = c.id AND cs.teacher_id = ?)) ORDER BY c.grade, c.name", [$tid, $yid, $tid, $tid]);
        return response()->json(['data' => array_map(fn ($x) => ['id' => (int) $x->id, 'name' => $x->name, 'grade' => (int) $x->grade, 'total' => (int) $x->total, 'is_home' => (bool) $x->is_home], $rows)]);
    }

    /** Gửi các thông báo hẹn giờ đã đến hạn (chạy mỗi khi mở trang, không cần cron) */
    private function flush(): void
    {
        try {
            foreach (DB::table('sm_nt_outbox')->where('status', 'scheduled')->where('send_at', '<=', $this->utc())->limit(50)->get() as $o) $this->deliver($o->id);
        } catch (\Throwable $e) { /* chưa tạo bảng */ }
    }

    private function deliver(int $id): int
    {
        $o = DB::table('sm_nt_outbox')->find($id); if (!$o) return 0;
        $yid = (int) DB::table('sm_classes')->where('id', $o->class_id)->value('school_year_id');
        DB::insert('INSERT IGNORE INTO sm_nt_outbox_rcpt (outbox_id, student_id) SELECT ?, e.student_id FROM sm_enrollments e WHERE e.class_id = ? AND e.school_year_id = ?', [$id, $o->class_id, $yid]);
        $n = (int) DB::table('sm_nt_outbox_rcpt')->where('outbox_id', $id)->count();
        DB::table('sm_nt_outbox')->where('id', $id)->update(['status' => 'sent', 'sent_at' => $this->utc(), 'recipients' => $n, 'updated_at' => $this->utc()]);
        return $n;
    }

    public function outbox(Request $r)
    {
        [, $tid] = $this->need($r); $this->flush();
        $rows = DB::select("SELECT o.*, c.name class_name, (SELECT COUNT(*) FROM sm_nt_outbox_rcpt x WHERE x.outbox_id = o.id AND x.read_at IS NOT NULL) read_n
            FROM sm_nt_outbox o LEFT JOIN sm_classes c ON c.id = o.class_id WHERE o.teacher_id = ? ORDER BY o.id DESC LIMIT 100", [$tid]);
        return response()->json(['data' => array_map(fn ($o) => ['id' => (int) $o->id, 'class_id' => (int) $o->class_id, 'class_name' => $o->class_name, 'title' => $o->title, 'body' => $o->body, 'priority' => $o->priority, 'status' => $o->status,
            'send_at' => $this->iso($o->send_at), 'sent_at' => $this->iso($o->sent_at), 'recipients' => (int) $o->recipients, 'read_n' => (int) $o->read_n, 'created_at' => $this->iso($o->created_at)], $rows)]);
    }

    public function outboxSend(Request $r)
    {
        [$st, $tid, $admin] = $this->need($r);
        $d = $r->validate(['class_id' => 'required|integer', 'title' => 'required|string|min:3|max:200', 'body' => 'required|string|min:3|max:2000', 'priority' => 'nullable|in:' . implode(',', self::PRIO), 'send_at' => 'nullable|string|max:25']);
        $cls = DB::table('sm_classes')->where('id', $d['class_id'])->first(); abort_unless($cls, 404, 'Không tìm thấy lớp.');
        $ok = $admin || (int) $cls->homeroom_teacher_id === $tid || DB::table('sm_class_subjects')->where('class_id', $cls->id)->where('teacher_id', $tid)->exists();
        abort_unless($ok, 403, 'Bạn chỉ được gửi thông báo cho lớp mình chủ nhiệm hoặc đang dạy.');
        abort_if(DB::table('sm_enrollments')->where('class_id', $cls->id)->where('school_year_id', $cls->school_year_id)->count() === 0, 422, 'Lớp này chưa có học sinh.');
        $when = $this->fromLocal($d['send_at'] ?? null); $future = $when && $when > now()->addMinute()->format('Y-m-d H:i:s');
        abort_if($future && $when > now()->addDays(30)->format('Y-m-d H:i:s'), 422, 'Chỉ hẹn giờ được trong vòng 30 ngày.');
        $id = DB::table('sm_nt_outbox')->insertGetId(['teacher_id' => $tid, 'class_id' => $cls->id, 'title' => trim($d['title']), 'body' => trim($d['body']), 'priority' => $d['priority'] ?? 'normal',
            'status' => $future ? 'scheduled' : 'sent', 'send_at' => $future ? $when : null, 'recipients' => 0, 'created_at' => $this->utc(), 'updated_at' => $this->utc()]);
        $n = $future ? 0 : $this->deliver($id);
        return response()->json(['message' => $future ? 'Đã hẹn giờ gửi thông báo.' : "Đã gửi thông báo cho {$n} học sinh lớp {$cls->name}.", 'id' => $id, 'recipients' => $n]);
    }

    public function outboxShow(Request $r, int $id)
    {
        [, $tid] = $this->need($r);
        $o = DB::table('sm_nt_outbox')->where('id', $id)->where('teacher_id', $tid)->first(); abort_unless($o, 404, 'Không tìm thấy thông báo.');
        $rc = DB::select("SELECT s.id, s.full_name, s.code, x.read_at FROM sm_nt_outbox_rcpt x JOIN sm_students s ON s.id = x.student_id WHERE x.outbox_id = ? ORDER BY (x.read_at IS NULL) DESC, s.full_name LIMIT 300", [$id]);
        return response()->json(['data' => ['id' => (int) $o->id, 'title' => $o->title, 'body' => $o->body, 'status' => $o->status, 'recipients' => (int) $o->recipients, 'send_at' => $this->iso($o->send_at), 'sent_at' => $this->iso($o->sent_at)],
            'students' => array_map(fn ($s) => ['id' => (int) $s->id, 'name' => $s->full_name, 'code' => $s->code, 'read_at' => $this->iso($s->read_at)], $rc)]);
    }

    public function outboxCancel(Request $r, int $id)
    {
        [, $tid] = $this->need($r);
        $n = DB::table('sm_nt_outbox')->where('id', $id)->where('teacher_id', $tid)->where('status', 'scheduled')->update(['status' => 'cancelled', 'updated_at' => $this->utc()]);
        abort_unless($n, 422, 'Chỉ hủy được thông báo đang hẹn giờ.');
        return response()->json(['message' => 'Đã hủy thông báo hẹn giờ.']);
    }

    /* ---------- phát hành thông báo (Ban giám hiệu / giáo vụ) ---------- */
    private function adminOnly(Request $r)
    {
        $st = $this->staff($r); abort_unless(in_array($st->role, self::ADMIN, true), 403, 'Chỉ Ban giám hiệu hoặc giáo vụ mới được phát hành thông báo.'); return $st;
    }

    public function published(Request $r)
    {
        $this->adminOnly($r);
        $rows = DB::select("SELECT i.*, t.full_name tname, (SELECT COUNT(*) FROM sm_nt_state s WHERE s.item_key = CONCAT('i:', i.id) AND s.read_at IS NOT NULL) read_n
            FROM sm_nt_items i LEFT JOIN sm_teachers t ON t.id = i.teacher_id WHERE i.audience IN ('all','teacher') ORDER BY i.id DESC LIMIT 100");
        $total = (int) DB::table('sm_staff_accounts')->whereIn('role', ['teacher', 'homeroom_teacher'])->count();
        return response()->json(['teachers' => $total, 'data' => array_map(fn ($i) => ['id' => (int) $i->id, 'kind' => $i->kind, 'priority' => $i->priority, 'title' => $i->title, 'body' => $i->body, 'link' => $i->link, 'audience' => $i->audience, 'teacher_name' => $i->tname,
            'sender' => $i->sender_name, 'pinned' => (bool) $i->pinned, 'status' => $i->status, 'read_n' => (int) $i->read_n, 'expires_at' => $this->iso($i->expires_at), 'created_at' => $this->iso($i->created_at)], $rows)]);
    }

    public function publish(Request $r)
    {
        $st = $this->adminOnly($r);
        $d = $r->validate(['kind' => 'required|in:' . implode(',', array_diff(array_keys(self::KINDS), ['reminder'])), 'priority' => 'required|in:' . implode(',', self::PRIO), 'title' => 'required|string|min:3|max:200', 'body' => 'required|string|min:3|max:5000',
            'link' => ['nullable', 'string', 'max:255', 'regex:/^\//'], 'audience' => 'required|in:all,teacher', 'teacher_id' => 'nullable|integer', 'pinned' => 'nullable|boolean', 'expires_at' => 'nullable|string|max:25']);
        if ($d['audience'] === 'teacher') abort_unless(!empty($d['teacher_id']) && DB::table('sm_teachers')->where('id', $d['teacher_id'])->exists(), 422, 'Hãy chọn giáo viên nhận thông báo.');
        $exp = $this->fromLocal($d['expires_at'] ?? null); abort_if($exp && $exp <= $this->utc(), 422, 'Thời điểm hết hạn phải ở tương lai.');
        $id = DB::table('sm_nt_items')->insertGetId(['kind' => $d['kind'], 'priority' => $d['priority'], 'title' => trim($d['title']), 'body' => trim($d['body']), 'link' => $d['link'] ?? null, 'audience' => $d['audience'],
            'teacher_id' => $d['audience'] === 'teacher' ? (int) $d['teacher_id'] : null, 'sender_id' => $st->id, 'sender_name' => $st->name ?? $st->full_name ?? 'Nhà trường', 'sender_role' => $st->role, 'pinned' => !empty($d['pinned']) ? 1 : 0,
            'status' => 'active', 'expires_at' => $exp, 'created_at' => $this->utc(), 'updated_at' => $this->utc()]);
        return response()->json(['message' => 'Đã phát hành thông báo.', 'id' => $id]);
    }

    public function revoke(Request $r, int $id)
    {
        $this->adminOnly($r);
        $n = DB::table('sm_nt_items')->where('id', $id)->whereIn('audience', ['all', 'teacher'])->where('status', 'active')->update(['status' => 'revoked', 'updated_at' => $this->utc()]);
        abort_unless($n, 404, 'Không tìm thấy thông báo hoặc đã được thu hồi.');
        return response()->json(['message' => 'Đã thu hồi thông báo.']);
    }

    public function teachers(Request $r)
    {
        $this->adminOnly($r); $q = trim((string) $r->query('q', ''));
        $rows = DB::table('sm_teachers')->when($q !== '', fn ($w) => $w->where('full_name', 'like', '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%'))->orderBy('full_name')->limit(30)->get(['id', 'full_name']);
        return response()->json(['data' => $rows->map(fn ($t) => ['id' => (int) $t->id, 'name' => $t->full_name])->all()]);
    }
}
