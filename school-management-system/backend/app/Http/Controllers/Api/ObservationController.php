<?php

namespace App\Http\Controllers\Api;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Cổng giáo viên – DỰ GIỜ & ĐÁNH GIÁ TIẾT DẠY (đi sau middleware StaffToken, prefix teacher/ob).
 * Đường dẫn thật: /api/gv/teacher/ob/...
 *
 * Luồng nghiệp vụ:
 *   1) Lên lịch: giáo viên XIN DỰ GIỜ đồng nghiệp (chờ người được dự xác nhận) | MỜI đồng nghiệp dự giờ lớp mình |
 *      giáo vụ / BGH PHÂN CÔNG dự giờ (có hiệu lực ngay). Lịch được đối chiếu thời khóa biểu (sm_timetable) để cảnh báo trùng tiết.
 *   2) Từ ngày dự giờ, người dự điền PHIẾU ĐÁNH GIÁ theo bộ tiêu chí (thang 1–4) → hệ thống tính % và xếp loại Tốt/Khá/Đạt/Chưa đạt.
 *   3) Giáo viên được dự xem nhận xét, phản hồi / rút kinh nghiệm và lập KẾ HOẠCH CẢI TIẾN.
 *   4) Giáo vụ / BGH theo dõi chỉ tiêu dự giờ, báo cáo, quản lý bộ tiêu chí.
 * Mọi bước đều gửi thông báo vào Trung tâm thông báo (sm_nt_items) của giáo viên liên quan.
 */
class ObservationController extends LessonAttendanceStaffController
{
    private const TZ = 'Asia/Ho_Chi_Minh';
    private const ADMIN = ['academic', 'principal', 'vice_principal', 'super_admin'];
    public const KINDS = ['periodic' => 'Dự giờ định kỳ', 'demo' => 'Thao giảng', 'topic' => 'Chuyên đề', 'surprise' => 'Đột xuất', 'review' => 'Kiểm tra chuyên môn'];

    /* ---------- tiện ích ---------- */
    private function utc(): string { return now()->format('Y-m-d H:i:s'); }
    private function today(): string { return Carbon::now(self::TZ)->format('Y-m-d'); }
    private function iso($s): ?string { return $s ? Carbon::parse($s, 'UTC')->format('Y-m-d\TH:i:s\Z') : null; }
    private function yearId(): int { return (int) (DB::table('sm_school_years')->where('is_current', 1)->value('id') ?: DB::table('sm_school_years')->max('id')); }
    /** Tên năm học – chịu được việc cột tên khác nhau giữa các bản cơ sở dữ liệu */
    private function yearLabel(object $y): string { foreach (['name', 'label', 'title', 'year_name', 'code'] as $k) if (isset($y->$k) && $y->$k !== '') return (string) $y->$k; return 'Năm học #' . $y->id; }
    private function wd(string $date): int { return (int) date('N', strtotime($date)) + 1; }   // khớp sm_timetable.weekday (thứ 2 = 2)
    private function who(Request $r): array
    {
        $st = $this->staff($r); $admin = in_array($st->role, self::ADMIN, true);
        return [$st, (int) ($st->teacher_id ?? 0), $admin];
    }
    private function need(Request $r): array
    {
        [$st, $tid, $admin] = $this->who($r);
        abort_unless($tid > 0, 422, 'Tài khoản này chưa gắn với giáo viên nào (cột teacher_id trong sm_staff_accounts đang trống). Hãy đăng nhập bằng tài khoản giáo viên.');
        return [$st, $tid, $admin];
    }
    private function adminOnly(Request $r): array
    {
        $w = $this->who($r); abort_unless($w[2], 403, 'Chỉ Ban giám hiệu / giáo vụ mới dùng được chức năng này.'); return $w;
    }
    private function rating($pct): ?string
    {
        if ($pct === null) return null;
        return $pct >= 85 ? 'Tốt' : ($pct >= 70 ? 'Khá' : ($pct >= 50 ? 'Đạt' : 'Chưa đạt'));
    }
    private function teacherName(int $id): string { return (string) (DB::table('sm_teachers')->where('id', $id)->value('full_name') ?: 'Giáo viên'); }
    private function dm(string $d): string { return date('d/m/Y', strtotime($d)); }

    /** Gửi thông báo vào Trung tâm thông báo của một giáo viên (bỏ qua êm nếu module thông báo chưa cài) */
    private function notify(int $teacherId, string $title, string $body, string $link, string $prio = 'normal', ?string $until = null): void
    {
        if ($teacherId <= 0) return;
        try {
            DB::table('sm_nt_items')->insert([
                'kind' => 'event', 'priority' => $prio, 'title' => mb_substr($title, 0, 200), 'body' => $body, 'link' => $link, 'audience' => 'teacher', 'teacher_id' => $teacherId,
                'sender_name' => 'Dự giờ', 'sender_role' => 'system', 'pinned' => 0, 'status' => 'active',
                'expires_at' => $until ? Carbon::parse($until . ' 23:59:59', self::TZ)->setTimezone('UTC')->format('Y-m-d H:i:s') : null, 'created_at' => $this->utc(), 'updated_at' => $this->utc(),
            ]);
        } catch (\Throwable $e) { /* chưa cài module thông báo */ }
    }

    private function sess(int $id): object
    {
        $s = DB::selectOne('SELECT s.*, t.full_name AS observed_name, p.start_time, p.end_time FROM sm_ob_sessions s LEFT JOIN sm_teachers t ON t.id = s.observed_id LEFT JOIN sm_periods p ON p.id = s.period WHERE s.id = ?', [$id]);
        abort_unless($s, 404, 'Không tìm thấy buổi dự giờ.');
        return $s;
    }
    private function observersOf(array $ids): array
    {
        if (!$ids) return [];
        $in = implode(',', array_fill(0, count($ids), '?'));
        $rows = DB::select("SELECT o.session_id, o.teacher_id, o.status, o.note, o.responded_at, t.full_name AS name, e.id AS eval_id, e.status AS eval_status, e.percent, e.rating, e.submitted_at
            FROM sm_ob_observers o LEFT JOIN sm_teachers t ON t.id = o.teacher_id LEFT JOIN sm_ob_evals e ON e.session_id = o.session_id AND e.observer_id = o.teacher_id
            WHERE o.session_id IN ($in) ORDER BY o.id", $ids);
        $m = []; foreach ($rows as $x) $m[$x->session_id][] = $x; return $m;
    }
    /** Chuẩn hóa một buổi dự giờ cho giao diện, kèm quyền thao tác của người đang xem */
    private function fmt(object $s, array $obs, int $tid, bool $admin, int $staffId): array
    {
        $today = $this->today(); $isObserved = $tid > 0 && (int) $s->observed_id === $tid; $mine = null;
        foreach ($obs as $o) if ((int) $o->teacher_id === $tid && $tid > 0) $mine = $o;
        $open = in_array($s->status, ['pending', 'scheduled'], true);
        $list = array_map(function ($o) use ($admin, $isObserved, $tid) {
            $see = $o->eval_status === 'submitted' && ($admin || $isObserved || (int) $o->teacher_id === $tid);
            return ['teacher_id' => (int) $o->teacher_id, 'name' => $o->name, 'status' => $o->status, 'note' => $o->note, 'eval_status' => $o->eval_status, 'eval_id' => $see || (int) $o->teacher_id === $tid ? ($o->eval_id ? (int) $o->eval_id : null) : null,
                'percent' => $see ? (float) $o->percent : null, 'rating' => $see ? $o->rating : null, 'submitted_at' => $this->iso($o->submitted_at)];
        }, $obs);
        return [
            'id' => (int) $s->id, 'title' => $s->title, 'kind' => $s->kind, 'kind_label' => self::KINDS[$s->kind] ?? $s->kind, 'status' => $s->status, 'initiator' => $s->initiator,
            'lesson_date' => $s->lesson_date, 'period' => $s->period !== null ? (int) $s->period : null, 'start' => $s->start_time ? substr($s->start_time, 0, 5) : null, 'end' => $s->end_time ? substr($s->end_time, 0, 5) : null,
            'room' => $s->room, 'class_id' => $s->class_id ? (int) $s->class_id : null, 'class_subject_id' => $s->class_subject_id ? (int) $s->class_subject_id : null, 'class_name' => $s->class_name, 'subject' => $s->subject,
            'objective' => $s->objective, 'observed_id' => (int) $s->observed_id, 'observed_name' => $s->observed_name, 'created_by_name' => $s->created_by_name, 'cancel_note' => $s->cancel_note,
            'created_at' => $this->iso($s->created_at), 'phase' => $s->lesson_date < $today ? 'past' : ($s->lesson_date === $today ? 'today' : 'upcoming'),
            'observers' => $list,
            'me' => ['observed' => $isObserved, 'observer' => $mine !== null, 'status' => $mine->status ?? null, 'eval_status' => $mine->eval_status ?? null, 'eval_id' => isset($mine->eval_id) && $mine->eval_id ? (int) $mine->eval_id : null],
            'can_respond' => ($isObserved && $s->status === 'pending') || ($mine && $mine->status === 'invited' && $open),
            'can_evaluate' => $mine && $mine->status === 'accepted' && in_array($s->status, ['scheduled', 'completed'], true) && $s->lesson_date <= $today,
            'can_edit' => $open && ($admin || $isObserved || ((int) $s->created_by === $staffId && $staffId > 0)),
        ];
    }
    private function canSee(object $s, int $tid, bool $admin): bool
    {
        return $admin || ($tid > 0 && ((int) $s->observed_id === $tid || DB::table('sm_ob_observers')->where('session_id', $s->id)->where('teacher_id', $tid)->exists()));
    }
    /** Giáo viên nào đang có tiết dạy vào đúng ngày + tiết (theo thời khóa biểu)? */
    private function busy(array $teacherIds, string $date, ?int $period, int $skipObserved = 0): array
    {
        if ($period === null || !$teacherIds) return [];
        $in = implode(',', array_fill(0, count($teacherIds), '?')); $out = [];
        $rows = DB::select("SELECT cs.teacher_id, t.full_name, c.name AS class_name, s.name AS subject FROM sm_timetable tt JOIN sm_class_subjects cs ON cs.id = tt.class_subject_id
            JOIN sm_classes c ON c.id = cs.class_id JOIN sm_subjects s ON s.id = cs.subject_id LEFT JOIN sm_teachers t ON t.id = cs.teacher_id
            WHERE cs.teacher_id IN ($in) AND tt.weekday = ? AND tt.period = ? AND c.school_year_id = ?", array_merge($teacherIds, [$this->wd($date), $period, $this->yearId()]));
        foreach ($rows as $x) $out[] = "{$x->full_name} đang dạy {$x->subject} lớp {$x->class_name}";
        return $out;
    }

    /* ---------- dữ liệu dùng chung ---------- */
    public function meta(Request $r)
    {
        [$st, $tid, $admin] = $this->who($r);
        return response()->json(['is_admin' => $admin, 'teacher_id' => $tid ?: null, 'kinds' => self::KINDS, 'settings' => $this->settingsArr(),
            'scale' => [['v' => 1, 'label' => 'Chưa đạt'], ['v' => 2, 'label' => 'Đạt'], ['v' => 3, 'label' => 'Khá'], ['v' => 4, 'label' => 'Tốt']],
            'template' => DB::selectOne("SELECT id, name FROM sm_ob_templates WHERE status = 'active' ORDER BY is_default DESC, id LIMIT 1")]);
    }
    public function teachers(Request $r)
    {
        $this->who($r); $q = trim((string) $r->query('q', '')); $y = $this->yearId(); $b = [$y];
        $w = ''; if ($q !== '') { $w = 'WHERE t.full_name LIKE ?'; $b[] = "%$q%"; }
        $rows = DB::select("SELECT t.id, t.full_name AS name, (SELECT GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR ', ') FROM sm_class_subjects cs JOIN sm_subjects s ON s.id = cs.subject_id JOIN sm_classes c ON c.id = cs.class_id
            WHERE cs.teacher_id = t.id AND c.school_year_id = ?) AS subjects FROM sm_teachers t $w ORDER BY t.full_name LIMIT 40", $b);
        return response()->json(['data' => array_map(fn ($x) => ['id' => (int) $x->id, 'name' => $x->name, 'subjects' => $x->subjects], $rows)]);
    }
    /** Các tiết dạy của một giáo viên trong một ngày – để chọn tiết cần dự giờ */
    public function slots(Request $r)
    {
        $this->who($r); $date = (string) $r->query('date', ''); $tid = (int) $r->query('teacher_id', 0);
        abort_unless($tid > 0 && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date), 422, 'Hãy chọn giáo viên và ngày.');
        $rows = DB::select('SELECT tt.period, p.start_time, p.end_time, cs.id AS class_subject_id, c.id AS class_id, c.name AS class_name, s.name AS subject,
              (SELECT COUNT(*) FROM sm_ob_sessions x WHERE x.observed_id = cs.teacher_id AND x.lesson_date = ? AND x.period = tt.period AND x.status IN (\'pending\', \'scheduled\')) AS booked
            FROM sm_timetable tt JOIN sm_class_subjects cs ON cs.id = tt.class_subject_id JOIN sm_classes c ON c.id = cs.class_id JOIN sm_subjects s ON s.id = cs.subject_id LEFT JOIN sm_periods p ON p.id = tt.period
            WHERE cs.teacher_id = ? AND tt.weekday = ? AND c.school_year_id = ? ORDER BY tt.period, c.name', [$date, $tid, $this->wd($date), $this->yearId()]);
        return response()->json(['data' => array_map(fn ($x) => ['class_subject_id' => (int) $x->class_subject_id, 'class_id' => (int) $x->class_id, 'class_name' => $x->class_name, 'subject' => $x->subject,
            'period' => (int) $x->period, 'start' => $x->start_time ? substr($x->start_time, 0, 5) : null, 'end' => $x->end_time ? substr($x->end_time, 0, 5) : null, 'booked' => (int) $x->booked > 0], $rows)]);
    }

    /* ---------- tổng quan ---------- */
    public function overview(Request $r)
    {
        [$st, $tid, $admin] = $this->who($r); $today = $this->today(); $y = $this->yearId(); $set = $this->settingsArr(); $out = ['personal' => $tid > 0, 'is_admin' => $admin, 'settings' => $set];
        if ($tid > 0) {
            $done = (int) DB::selectOne("SELECT COUNT(DISTINCT e.session_id) n FROM sm_ob_evals e JOIN sm_ob_sessions s ON s.id = e.session_id WHERE e.observer_id = ? AND e.status = 'submitted' AND s.status <> 'cancelled' AND s.school_year_id = ?", [$tid, $y])->n;
            $taught = (int) DB::selectOne("SELECT COUNT(DISTINCT e.session_id) n FROM sm_ob_evals e JOIN sm_ob_sessions s ON s.id = e.session_id WHERE s.observed_id = ? AND e.status = 'submitted' AND s.school_year_id = ?", [$tid, $y])->n;
            $avg = DB::selectOne("SELECT AVG(e.percent) a FROM sm_ob_evals e JOIN sm_ob_sessions s ON s.id = e.session_id WHERE s.observed_id = ? AND e.status = 'submitted' AND s.school_year_id = ?", [$tid, $y])->a;
            $mineSql = '(s.observed_id = ? OR EXISTS (SELECT 1 FROM sm_ob_observers o WHERE o.session_id = s.id AND o.teacher_id = ?))';
            $upcoming = (int) DB::selectOne("SELECT COUNT(*) n FROM sm_ob_sessions s WHERE $mineSql AND s.status IN ('pending','scheduled') AND s.lesson_date >= ?", [$tid, $tid, $today])->n;
            $waiting = (int) DB::selectOne("SELECT COUNT(*) n FROM sm_ob_sessions s WHERE s.observed_id = ? AND s.status = 'pending'", [$tid])->n
                + (int) DB::selectOne("SELECT COUNT(*) n FROM sm_ob_observers o JOIN sm_ob_sessions s ON s.id = o.session_id WHERE o.teacher_id = ? AND o.status = 'invited' AND s.status IN ('pending','scheduled')", [$tid])->n;
            $todo = DB::select("SELECT s.id, s.title, s.lesson_date, s.subject, s.class_name, t.full_name AS observed_name FROM sm_ob_observers o JOIN sm_ob_sessions s ON s.id = o.session_id LEFT JOIN sm_teachers t ON t.id = s.observed_id
                LEFT JOIN sm_ob_evals e ON e.session_id = o.session_id AND e.observer_id = o.teacher_id WHERE o.teacher_id = ? AND o.status = 'accepted' AND s.status IN ('scheduled','completed') AND s.lesson_date <= ? AND (e.id IS NULL OR e.status = 'draft') ORDER BY s.lesson_date", [$tid, $today]);
            $unack = DB::select("SELECT e.id, e.percent, e.rating, e.submitted_at, s.id AS sid, s.title, s.lesson_date, t.full_name AS observer_name FROM sm_ob_evals e JOIN sm_ob_sessions s ON s.id = e.session_id LEFT JOIN sm_teachers t ON t.id = e.observer_id
                WHERE s.observed_id = ? AND e.status = 'submitted' AND e.ack_at IS NULL ORDER BY e.submitted_at DESC", [$tid]);
            $openActs = (int) DB::selectOne("SELECT COUNT(*) n FROM sm_ob_actions WHERE teacher_id = ? AND status = 'open'", [$tid])->n;
            $lateActs = DB::select("SELECT id, content, due_date FROM sm_ob_actions WHERE teacher_id = ? AND status = 'open' AND due_date IS NOT NULL AND due_date < ? ORDER BY due_date", [$tid, $today]);
            $att = [];
            $link = '/teacher/observations/lich?open=';
            foreach (DB::select("SELECT s.id, s.title, s.lesson_date, t.full_name AS who FROM sm_ob_sessions s LEFT JOIN sm_ob_observers o ON o.session_id = s.id LEFT JOIN sm_teachers t ON t.id = o.teacher_id WHERE s.observed_id = ? AND s.status = 'pending' ORDER BY s.lesson_date LIMIT 5", [$tid]) as $x)
                $att[] = ['type' => 'respond', 'prio' => 'high', 'title' => "{$x->who} xin dự giờ bài “{$x->title}”", 'hint' => 'Ngày ' . $this->dm($x->lesson_date) . ' – chờ bạn xác nhận', 'link' => $link . $x->id];
            foreach (DB::select("SELECT s.id, s.title, s.lesson_date, t.full_name AS who FROM sm_ob_observers o JOIN sm_ob_sessions s ON s.id = o.session_id LEFT JOIN sm_teachers t ON t.id = s.observed_id WHERE o.teacher_id = ? AND o.status = 'invited' AND s.status IN ('pending','scheduled') ORDER BY s.lesson_date LIMIT 5", [$tid]) as $x)
                $att[] = ['type' => 'invite', 'prio' => 'high', 'title' => "{$x->who} mời bạn dự giờ bài “{$x->title}”", 'hint' => 'Ngày ' . $this->dm($x->lesson_date) . ' – hãy nhận lời hoặc từ chối', 'link' => $link . $x->id];
            foreach (array_slice($todo, 0, 5) as $x) $att[] = ['type' => 'eval', 'prio' => 'high', 'title' => "Hoàn thành phiếu nhận xét bài “{$x->title}”", 'hint' => "Giáo viên {$x->observed_name} · dự ngày " . $this->dm($x->lesson_date), 'link' => '/teacher/observations/phieu?session=' . $x->id];
            foreach (array_slice($unack, 0, 4) as $x) $att[] = ['type' => 'ack', 'prio' => 'normal', 'title' => "Có nhận xét mới cho bài “{$x->title}”", 'hint' => "{$x->observer_name}: {$x->rating} ({$x->percent}%) – xem và phản hồi", 'link' => '/teacher/observations/ket-qua?eval=' . $x->id];
            foreach (array_slice($lateActs, 0, 3) as $x) $att[] = ['type' => 'late', 'prio' => 'urgent', 'title' => 'Việc cải tiến quá hạn: ' . mb_substr($x->content, 0, 70), 'hint' => 'Hạn ' . $this->dm($x->due_date), 'link' => '/teacher/observations/ket-qua?tab=cai-tien'];
            $ids = array_map(fn ($x) => (int) $x->id, DB::select("SELECT s.id FROM sm_ob_sessions s WHERE $mineSql AND s.status IN ('pending','scheduled') AND s.lesson_date >= ? ORDER BY s.lesson_date, s.period LIMIT 6", [$tid, $tid, $today]));
            $ob = $this->observersOf($ids); $upc = [];
            foreach ($ids as $id) $upc[] = $this->fmt($this->sess($id), $ob[$id] ?? [], $tid, $admin, (int) $st->id);
            $recent = DB::select("SELECT e.id, e.percent, e.rating, e.submitted_at, s.title, s.lesson_date, s.subject, s.class_name, t.full_name AS observer_name FROM sm_ob_evals e JOIN sm_ob_sessions s ON s.id = e.session_id LEFT JOIN sm_teachers t ON t.id = e.observer_id
                WHERE s.observed_id = ? AND e.status = 'submitted' ORDER BY e.submitted_at DESC LIMIT 5", [$tid]);
            $months = []; for ($i = 5; $i >= 0; $i--) $months[Carbon::now(self::TZ)->subMonths($i)->format('Y-m')] = 0;
            foreach (DB::select("SELECT DATE_FORMAT(s.lesson_date, '%Y-%m') ym, COUNT(*) n FROM sm_ob_sessions s WHERE $mineSql AND s.status <> 'cancelled' AND s.lesson_date >= ? GROUP BY ym", [$tid, $tid, Carbon::now(self::TZ)->subMonths(5)->format('Y-m-01')]) as $x) if (isset($months[$x->ym])) $months[$x->ym] = (int) $x->n;
            $out += ['quota' => ['observe' => ['done' => $done, 'target' => $set['quota_observe']], 'taught' => ['done' => $taught, 'target' => $set['quota_taught']]],
                'kpi' => ['upcoming' => $upcoming, 'waiting' => $waiting, 'eval_todo' => count($todo), 'received' => $taught, 'avg_percent' => $avg !== null ? round((float) $avg, 1) : null, 'avg_rating' => $this->rating($avg !== null ? (float) $avg : null), 'actions_open' => $openActs, 'unack' => count($unack)],
                'attention' => array_slice($att, 0, 9), 'upcoming' => $upc,
                'recent' => array_map(fn ($x) => ['id' => (int) $x->id, 'title' => $x->title, 'date' => $x->lesson_date, 'subject' => $x->subject, 'class_name' => $x->class_name, 'observer' => $x->observer_name, 'percent' => (float) $x->percent, 'rating' => $x->rating], $recent),
                'by_month' => array_map(fn ($k, $v) => ['m' => $k, 'n' => $v], array_keys($months), array_values($months))];
        }
        if ($admin) {
            $c = DB::select('SELECT status, COUNT(*) n FROM sm_ob_sessions WHERE school_year_id = ? GROUP BY status', [$y]); $m = []; foreach ($c as $x) $m[$x->status] = (int) $x->n;
            $a = DB::selectOne("SELECT AVG(e.percent) a, COUNT(*) n FROM sm_ob_evals e JOIN sm_ob_sessions s ON s.id = e.session_id WHERE e.status = 'submitted' AND s.school_year_id = ?", [$y]);
            $out['school'] = ['sessions' => array_sum($m), 'pending' => $m['pending'] ?? 0, 'scheduled' => $m['scheduled'] ?? 0, 'completed' => $m['completed'] ?? 0, 'cancelled' => $m['cancelled'] ?? 0, 'declined' => $m['declined'] ?? 0,
                'evals' => (int) $a->n, 'avg_percent' => $a->a !== null ? round((float) $a->a, 1) : null,
                'teachers_total' => (int) DB::selectOne('SELECT COUNT(*) n FROM sm_teachers')->n];
        }
        return response()->json($out);
    }

    /* ---------- lịch dự giờ ---------- */
    public function sessions(Request $r)
    {
        [$st, $tid, $admin] = $this->who($r); $scope = (string) $r->query('scope', $admin && !$tid ? 'all' : 'mine');
        abort_if($scope === 'all' && !$admin, 403, 'Chỉ Ban giám hiệu / giáo vụ xem được toàn trường.');
        if (!$admin) abort_unless($tid > 0, 422, 'Tài khoản này chưa gắn với giáo viên nào.');
        $w = ['1=1']; $b = [];
        if ($scope === 'taught') { $w[] = 's.observed_id = ?'; $b[] = $tid; }
        elseif ($scope === 'observe') { $w[] = 'EXISTS (SELECT 1 FROM sm_ob_observers o WHERE o.session_id = s.id AND o.teacher_id = ?)'; $b[] = $tid; }
        elseif ($scope === 'mine') { $w[] = '(s.observed_id = ? OR EXISTS (SELECT 1 FROM sm_ob_observers o WHERE o.session_id = s.id AND o.teacher_id = ?))'; array_push($b, $tid, $tid); }
        if ($q = trim((string) $r->query('q', ''))) { $w[] = '(s.title LIKE ? OR s.subject LIKE ? OR s.class_name LIKE ? OR t.full_name LIKE ?)'; array_push($b, "%$q%", "%$q%", "%$q%", "%$q%"); }
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $r->query('from', ''))) { $w[] = 's.lesson_date >= ?'; $b[] = $r->query('from'); }
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $r->query('to', ''))) { $w[] = 's.lesson_date <= ?'; $b[] = $r->query('to'); }
        if (in_array($r->query('kind'), array_keys(self::KINDS), true)) { $w[] = 's.kind = ?'; $b[] = $r->query('kind'); }
        $ev = (string) $r->query('eval', '');
        if ($ev === 'todo' || $ev === 'submitted') {
            $cond = $ev === 'todo' ? "(e.id IS NULL OR e.status = 'draft') AND s2.status IN ('scheduled','completed')" : "e.status = 'submitted'";
            $w[] = "EXISTS (SELECT 1 FROM sm_ob_observers o LEFT JOIN sm_ob_evals e ON e.session_id = o.session_id AND e.observer_id = o.teacher_id JOIN sm_ob_sessions s2 ON s2.id = o.session_id WHERE o.session_id = s.id AND o.teacher_id = ? AND o.status = 'accepted' AND $cond)"; $b[] = $tid;
        }
        $base = ' FROM sm_ob_sessions s LEFT JOIN sm_teachers t ON t.id = s.observed_id WHERE ' . implode(' AND ', $w);
        $counts = ['all' => 0]; foreach (DB::select('SELECT s.status, COUNT(*) n' . $base . ' GROUP BY s.status', $b) as $x) { $counts[$x->status] = (int) $x->n; $counts['all'] += (int) $x->n; }
        $counts['open'] = ($counts['pending'] ?? 0) + ($counts['scheduled'] ?? 0);
        $stt = (string) $r->query('status', '');
        if ($stt === 'open') $w[] = "s.status IN ('pending','scheduled')"; elseif (in_array($stt, ['pending', 'scheduled', 'completed', 'cancelled', 'declined'], true)) { $w[] = 's.status = ?'; $b[] = $stt; }
        $base = ' FROM sm_ob_sessions s LEFT JOIN sm_teachers t ON t.id = s.observed_id WHERE ' . implode(' AND ', $w);
        $total = (int) DB::selectOne('SELECT COUNT(*) n' . $base, $b)->n; $per = max(5, min(100, (int) $r->query('per', 20))); $page = max(1, (int) $r->query('page', 1));
        $order = in_array($stt, ['open', 'pending', 'scheduled'], true) ? 's.lesson_date ASC, s.period ASC' : 's.lesson_date DESC, s.period ASC';
        $ids = array_map(fn ($x) => (int) $x->id, DB::select('SELECT s.id' . $base . " ORDER BY $order LIMIT $per OFFSET " . (($page - 1) * $per), $b));
        $ob = $this->observersOf($ids); $data = [];
        foreach ($ids as $id) $data[] = $this->fmt($this->sess($id), $ob[$id] ?? [], $tid, $admin, (int) $st->id);
        return response()->json(['counts' => $counts, 'meta' => ['total' => $total, 'page' => $page, 'per' => $per, 'pages' => max(1, (int) ceil($total / $per))], 'data' => $data]);
    }
    public function sessionShow(Request $r, $id)
    {
        [$st, $tid, $admin] = $this->who($r); $s = $this->sess((int) $id); abort_unless($this->canSee($s, $tid, $admin), 403, 'Bạn không có quyền xem buổi dự giờ này.');
        $ob = $this->observersOf([(int) $id]);
        $cm = DB::select('SELECT id, staff_id, author, body, created_at FROM sm_ob_comments WHERE session_id = ? ORDER BY id', [(int) $id]);
        $links = ['timetable' => '/teacher/schedule', 'attendance' => $s->class_subject_id ? '/teacher/attendance' : null, 'notifications' => '/teacher/notifications'];
        return response()->json(['data' => $this->fmt($s, $ob[(int) $id] ?? [], $tid, $admin, (int) $st->id), 'links' => $links,
            'comments' => array_map(fn ($c) => ['id' => (int) $c->id, 'author' => $c->author, 'body' => $c->body, 'created_at' => $this->iso($c->created_at), 'mine' => (int) $c->staff_id === (int) $st->id], $cm)]);
    }
    public function sessionStore(Request $r)
    {
        [$st, $tid, $admin] = $this->who($r);
        $v = $r->validate(['title' => 'required|string|min:3|max:200', 'lesson_date' => 'required|date', 'kind' => 'required|in:periodic,demo,topic,surprise,review', 'period' => 'nullable|integer|min:1|max:15',
            'observed_id' => 'nullable|integer', 'class_subject_id' => 'nullable|integer', 'room' => 'nullable|string|max:40', 'objective' => 'nullable|string|max:2000', 'subject' => 'nullable|string|max:120', 'class_name' => 'nullable|string|max:40', 'observer_ids' => 'nullable|array']);
        $date = date('Y-m-d', strtotime($v['lesson_date'])); $today = $this->today();
        abort_if($date < date('Y-m-d', strtotime($today . ' -30 day')), 422, 'Ngày dự giờ không được cách quá 30 ngày trong quá khứ.');
        abort_if($date > date('Y-m-d', strtotime($today . ' +365 day')), 422, 'Ngày dự giờ quá xa.');
        $period = isset($v['period']) ? (int) $v['period'] : null;
        $observedId = (int) ($v['observed_id'] ?? 0); $observers = array_values(array_unique(array_map('intval', (array) $r->input('observer_ids', []))));
        if ($admin) { $mode = 'assign'; abort_unless($observedId > 0 && $observers, 422, 'Hãy chọn giáo viên được dự và ít nhất một người dự giờ.'); }
        else {
            abort_unless($tid > 0, 422, 'Tài khoản này chưa gắn với giáo viên nào.');
            if ($observedId === 0 || $observedId === $tid) { $mode = 'invite'; $observedId = $tid; abort_unless($observers, 422, 'Hãy chọn đồng nghiệp bạn mời dự giờ.'); }
            else { $mode = 'request'; $observers = [$tid]; }
        }
        $observers = array_values(array_filter($observers, fn ($x) => $x > 0 && $x !== $observedId));
        abort_unless($observers, 422, 'Người dự giờ phải khác giáo viên được dự.');
        abort_unless(DB::table('sm_teachers')->where('id', $observedId)->exists(), 422, 'Không tìm thấy giáo viên được dự giờ.');
        foreach ($observers as $o) abort_unless(DB::table('sm_teachers')->where('id', $o)->exists(), 422, 'Có người dự giờ không tồn tại.');
        $cs = null; $csId = (int) ($v['class_subject_id'] ?? 0);
        if ($csId > 0) {
            $cs = DB::selectOne('SELECT cs.id, cs.class_id, c.name AS class_name, s.name AS subject FROM sm_class_subjects cs JOIN sm_classes c ON c.id = cs.class_id JOIN sm_subjects s ON s.id = cs.subject_id WHERE cs.id = ? AND cs.teacher_id = ?', [$csId, $observedId]);
            abort_unless($cs, 422, 'Lớp – môn đã chọn không thuộc giáo viên được dự giờ.');
        }
        abort_unless($cs || trim((string) ($v['subject'] ?? '')) !== '', 422, 'Hãy chọn tiết dạy trong thời khóa biểu hoặc nhập môn học.');
        abort_if($period !== null && DB::table('sm_ob_sessions')->where('observed_id', $observedId)->where('lesson_date', $date)->where('period', $period)->whereIn('status', ['pending', 'scheduled'])->exists(), 422, 'Tiết dạy này đã có người đăng ký dự giờ.');
        if (!$r->boolean('force')) {
            $bz = $this->busy($observers, $date, $period);
            if ($bz) return response()->json(['message' => 'Trùng tiết dạy: ' . implode('; ', $bz) . '.', 'conflict' => true], 422);
        }
        $now = $this->utc();
        $sid = DB::table('sm_ob_sessions')->insertGetId(['school_year_id' => $this->yearId(), 'observed_id' => $observedId, 'class_id' => $cs->class_id ?? null, 'class_subject_id' => $cs->id ?? null,
            'class_name' => $cs->class_name ?? ($v['class_name'] ?? null), 'subject' => $cs->subject ?? ($v['subject'] ?? null), 'kind' => $v['kind'], 'title' => trim($v['title']), 'objective' => $v['objective'] ?? null,
            'lesson_date' => $date, 'period' => $period, 'room' => $v['room'] ?? null, 'status' => $mode === 'request' ? 'pending' : 'scheduled', 'initiator' => $mode === 'request' ? 'observer' : ($mode === 'invite' ? 'observed' : 'admin'),
            'created_by' => $st->id, 'created_by_name' => $st->name, 'created_at' => $now, 'updated_at' => $now]);
        foreach ($observers as $o) DB::table('sm_ob_observers')->insert(['session_id' => $sid, 'teacher_id' => $o, 'status' => $mode === 'invite' ? 'invited' : 'accepted', 'responded_at' => $mode === 'invite' ? null : $now, 'created_at' => $now]);
        $when = $this->dm($date) . ($period ? " · tiết $period" : ''); $link = '/teacher/observations/lich?open=' . $sid; $name = $mode === 'invite' ? $this->teacherName($observedId) : ($mode === 'request' ? $this->teacherName($tid) : $st->name);
        if ($mode === 'request') $this->notify($observedId, "$name xin dự giờ bài “{$v['title']}”", "Ngày $when. Vui lòng xác nhận hoặc từ chối trong mục Lịch dự giờ.", $link, 'high', $date);
        elseif ($mode === 'invite') foreach ($observers as $o) $this->notify($o, "$name mời bạn dự giờ bài “{$v['title']}”", "Ngày $when. Hãy nhận lời hoặc từ chối.", $link, 'high', $date);
        else { $this->notify($observedId, "Bạn được phân công dự giờ: “{$v['title']}”", "Ngày $when do {$st->name} lên lịch.", $link, 'high', $date); foreach ($observers as $o) $this->notify($o, "Bạn được phân công dự giờ bài “{$v['title']}”", "Giáo viên " . $this->teacherName($observedId) . ", ngày $when.", $link, 'high', $date); }
        return response()->json(['id' => $sid, 'status' => $mode === 'request' ? 'pending' : 'scheduled', 'message' => $mode === 'request' ? 'Đã gửi đề nghị dự giờ, chờ giáo viên được dự xác nhận.' : 'Đã lên lịch dự giờ và gửi thông báo cho những người liên quan.'], 201);
    }
    public function sessionUpdate(Request $r, $id)
    {
        [$st, $tid, $admin] = $this->who($r); $s = $this->sess((int) $id);
        $f = $this->fmt($s, [], $tid, $admin, (int) $st->id); abort_unless($f['can_edit'], 403, 'Bạn không được sửa buổi dự giờ này.');
        $v = $r->validate(['title' => 'required|string|min:3|max:200', 'lesson_date' => 'required|date', 'kind' => 'required|in:periodic,demo,topic,surprise,review', 'period' => 'nullable|integer|min:1|max:15', 'room' => 'nullable|string|max:40', 'objective' => 'nullable|string|max:2000']);
        $date = date('Y-m-d', strtotime($v['lesson_date'])); $period = isset($v['period']) ? (int) $v['period'] : null; $changed = $date !== $s->lesson_date || $period !== ($s->period !== null ? (int) $s->period : null);
        if ($changed) {
            abort_if($date < date('Y-m-d', strtotime($this->today() . ' -30 day')), 422, 'Ngày dự giờ không được cách quá 30 ngày trong quá khứ.');
            abort_if($period !== null && DB::table('sm_ob_sessions')->where('observed_id', $s->observed_id)->where('lesson_date', $date)->where('period', $period)->whereIn('status', ['pending', 'scheduled'])->where('id', '<>', $s->id)->exists(), 422, 'Tiết dạy này đã có người đăng ký dự giờ.');
            if (!$r->boolean('force')) {
                $ids = array_map(fn ($x) => (int) $x->teacher_id, DB::select('SELECT teacher_id FROM sm_ob_observers WHERE session_id = ? AND status <> \'declined\'', [$s->id]));
                $bz = $this->busy($ids, $date, $period); if ($bz) return response()->json(['message' => 'Trùng tiết dạy: ' . implode('; ', $bz) . '.', 'conflict' => true], 422);
            }
        }
        $up = ['title' => trim($v['title']), 'kind' => $v['kind'], 'lesson_date' => $date, 'period' => $period, 'room' => $v['room'] ?? null, 'objective' => $v['objective'] ?? null, 'updated_at' => $this->utc()];
        if ($changed && $s->initiator === 'observer' && $tid !== (int) $s->observed_id) $up['status'] = 'pending';   // người xin dự đổi lịch → phải xác nhận lại
        DB::table('sm_ob_sessions')->where('id', $s->id)->update($up);
        if ($changed) {
            $when = $this->dm($date) . ($period ? " · tiết $period" : ''); $link = '/teacher/observations/lich?open=' . $s->id;
            $targets = array_map(fn ($x) => (int) $x->teacher_id, DB::select("SELECT teacher_id FROM sm_ob_observers WHERE session_id = ? AND status <> 'declined'", [$s->id])); $targets[] = (int) $s->observed_id;
            foreach (array_unique($targets) as $t) if ($t !== $tid) $this->notify($t, "Đổi lịch dự giờ bài “{$up['title']}”", "Lịch mới: $when.", $link, 'high', $date);
        }
        return response()->json(['message' => $changed ? 'Đã đổi lịch và thông báo cho mọi người.' : 'Đã cập nhật buổi dự giờ.']);
    }
    public function sessionRespond(Request $r, $id)
    {
        [$st, $tid, $admin] = $this->need($r); $s = $this->sess((int) $id); $act = (string) $r->input('action'); $note = trim((string) $r->input('note', ''));
        abort_unless(in_array($act, ['accept', 'decline'], true), 422, 'Thao tác không hợp lệ.');
        abort_if($act === 'decline' && mb_strlen($note) < 3, 422, 'Hãy nhập lý do từ chối (ít nhất 3 ký tự).');
        abort_unless(in_array($s->status, ['pending', 'scheduled'], true), 422, 'Buổi dự giờ này không còn chờ phản hồi.');
        $now = $this->utc(); $link = '/teacher/observations/lich?open=' . $s->id; $mine = DB::table('sm_ob_observers')->where('session_id', $s->id)->where('teacher_id', $tid)->first();
        if ((int) $s->observed_id === $tid && $s->status === 'pending') {
            DB::table('sm_ob_sessions')->where('id', $s->id)->update(['status' => $act === 'accept' ? 'scheduled' : 'declined', 'cancel_note' => $act === 'decline' ? $note : null, 'updated_at' => $now]);
            foreach (DB::select('SELECT teacher_id FROM sm_ob_observers WHERE session_id = ?', [$s->id]) as $o)
                $this->notify((int) $o->teacher_id, ($act === 'accept' ? 'Đã đồng ý' : 'Từ chối') . ' đề nghị dự giờ bài “' . $s->title . '”', $act === 'accept' ? $s->observed_name . ' đã xác nhận, ngày ' . $this->dm($s->lesson_date) . '.' : "Lý do: $note", $link, 'normal', $s->lesson_date);
            return response()->json(['message' => $act === 'accept' ? 'Đã xác nhận cho đồng nghiệp dự giờ.' : 'Đã từ chối đề nghị dự giờ.']);
        }
        abort_unless($mine && $mine->status === 'invited', 403, 'Bạn không có lời mời dự giờ nào cần phản hồi ở buổi này.');
        DB::table('sm_ob_observers')->where('id', $mine->id)->update(['status' => $act === 'accept' ? 'accepted' : 'declined', 'note' => $act === 'decline' ? $note : null, 'responded_at' => $now]);
        if (!DB::table('sm_ob_observers')->where('session_id', $s->id)->where('status', '<>', 'declined')->exists()) DB::table('sm_ob_sessions')->where('id', $s->id)->update(['status' => 'declined', 'updated_at' => $now]);
        $this->notify((int) $s->observed_id, $st->name . ($act === 'accept' ? ' nhận lời dự giờ' : ' từ chối dự giờ') . " bài “{$s->title}”", $act === 'decline' ? "Lý do: $note" : 'Ngày ' . $this->dm($s->lesson_date) . '.', $link, 'normal', $s->lesson_date);
        return response()->json(['message' => $act === 'accept' ? 'Đã nhận lời dự giờ.' : 'Đã từ chối lời mời.']);
    }
    public function sessionCancel(Request $r, $id)
    {
        [$st, $tid, $admin] = $this->who($r); $s = $this->sess((int) $id); $f = $this->fmt($s, [], $tid, $admin, (int) $st->id); abort_unless($f['can_edit'], 403, 'Bạn không được hủy buổi dự giờ này.');
        $note = trim((string) $r->input('note', '')); abort_if(mb_strlen($note) < 3, 422, 'Hãy nhập lý do hủy.');
        DB::table('sm_ob_sessions')->where('id', $s->id)->update(['status' => 'cancelled', 'cancel_note' => $note, 'updated_at' => $this->utc()]);
        $targets = array_map(fn ($x) => (int) $x->teacher_id, DB::select('SELECT teacher_id FROM sm_ob_observers WHERE session_id = ?', [$s->id])); $targets[] = (int) $s->observed_id;
        foreach (array_unique($targets) as $t) if ($t !== $tid) $this->notify($t, "Hủy buổi dự giờ bài “{$s->title}”", "Ngày " . $this->dm($s->lesson_date) . ". Lý do: $note", '/teacher/observations/lich?open=' . $s->id, 'high', $s->lesson_date);
        return response()->json(['message' => 'Đã hủy buổi dự giờ.']);
    }
    public function commentAdd(Request $r, $id)
    {
        [$st, $tid, $admin] = $this->who($r); $s = $this->sess((int) $id); abort_unless($this->canSee($s, $tid, $admin), 403, 'Bạn không có quyền.');
        $body = trim((string) $r->input('body', '')); abort_if(mb_strlen($body) < 1 || mb_strlen($body) > 1500, 422, 'Nội dung trao đổi từ 1 đến 1500 ký tự.');
        $cid = DB::table('sm_ob_comments')->insertGetId(['session_id' => $s->id, 'staff_id' => $st->id, 'author' => $st->name, 'body' => $body, 'created_at' => $this->utc()]);
        return response()->json(['id' => $cid, 'message' => 'Đã gửi.'], 201);
    }

    /* ---------- phiếu đánh giá ---------- */
    private function criteriaFor(int $templateId, int $evalId = 0): array
    {
        $rows = DB::select('SELECT c.id, c.grp, c.name, c.hint, c.weight, c.active, sc.score, sc.note FROM sm_ob_criteria c LEFT JOIN sm_ob_scores sc ON sc.criterion_id = c.id AND sc.eval_id = ? WHERE c.template_id = ? AND (c.active = 1 OR sc.id IS NOT NULL) ORDER BY c.sort, c.id', [$evalId, $templateId]);
        return array_map(fn ($c) => ['id' => (int) $c->id, 'group' => $c->grp, 'name' => $c->name, 'hint' => $c->hint, 'weight' => (float) $c->weight, 'score' => $c->score !== null ? (int) $c->score : null, 'note' => $c->note], $rows);
    }
    private function evalOut(?object $e): ?array
    {
        return $e ? ['id' => (int) $e->id, 'status' => $e->status, 'strengths' => $e->strengths, 'weaknesses' => $e->weaknesses, 'suggestions' => $e->suggestions, 'percent' => $e->percent !== null ? (float) $e->percent : null, 'rating' => $e->rating,
            'submitted_at' => $this->iso($e->submitted_at), 'ack_at' => $this->iso($e->ack_at), 'reply' => $e->reply] : null;
    }
    public function evalForm(Request $r, $sid)
    {
        [$st, $tid, $admin] = $this->need($r); $s = $this->sess((int) $sid);
        $mine = DB::table('sm_ob_observers')->where('session_id', $s->id)->where('teacher_id', $tid)->first(); abort_unless($mine && $mine->status === 'accepted', 403, 'Bạn không phải người dự giờ của buổi này.');
        abort_unless(in_array($s->status, ['scheduled', 'completed'], true), 422, 'Buổi dự giờ chưa được xác nhận hoặc đã bị hủy.');
        abort_if($s->lesson_date > $this->today(), 422, 'Chưa đến ngày dự giờ (' . $this->dm($s->lesson_date) . '). Bạn điền phiếu từ ngày đó.');
        $e = DB::table('sm_ob_evals')->where('session_id', $s->id)->where('observer_id', $tid)->first();
        $tpl = $e ? DB::table('sm_ob_templates')->where('id', $e->template_id)->first() : DB::selectOne("SELECT * FROM sm_ob_templates WHERE status = 'active' ORDER BY is_default DESC, id LIMIT 1");
        abort_unless($tpl, 422, 'Chưa có bộ phiếu dự giờ nào. Hãy nhờ giáo vụ tạo trong mục Tiêu chí.');
        $ob = $this->observersOf([(int) $s->id]);
        return response()->json(['session' => $this->fmt($s, $ob[(int) $s->id] ?? [], $tid, $admin, (int) $st->id), 'template' => ['id' => (int) $tpl->id, 'name' => $tpl->name], 'criteria' => $this->criteriaFor((int) $tpl->id, $e ? (int) $e->id : 0), 'eval' => $this->evalOut($e), 'locked' => $e && $e->ack_at !== null]);
    }
    public function evalSave(Request $r, $sid)
    {
        [$st, $tid, $admin] = $this->need($r); $s = $this->sess((int) $sid);
        $mine = DB::table('sm_ob_observers')->where('session_id', $s->id)->where('teacher_id', $tid)->first(); abort_unless($mine && $mine->status === 'accepted', 403, 'Bạn không phải người dự giờ của buổi này.');
        abort_unless(in_array($s->status, ['scheduled', 'completed'], true), 422, 'Buổi dự giờ chưa được xác nhận hoặc đã bị hủy.');
        abort_if($s->lesson_date > $this->today(), 422, 'Chưa đến ngày dự giờ.');
        $e = DB::table('sm_ob_evals')->where('session_id', $s->id)->where('observer_id', $tid)->first(); abort_if($e && $e->ack_at, 422, 'Giáo viên được dự đã xem và tiếp thu phiếu này nên không sửa được nữa.');
        $tpl = $e ? (int) $e->template_id : (int) DB::selectOne("SELECT id FROM sm_ob_templates WHERE status = 'active' ORDER BY is_default DESC, id LIMIT 1")->id;
        $crit = []; foreach (DB::select('SELECT id, weight FROM sm_ob_criteria WHERE template_id = ?', [$tpl]) as $c) $crit[(int) $c->id] = (float) $c->weight;
        $submit = $r->boolean('submit'); $in = []; foreach ((array) $r->input('scores', []) as $x) { $cid = (int) ($x['criterion_id'] ?? 0); if (!isset($crit[$cid])) continue;
            $sc = ($x['score'] ?? null) === null || $x['score'] === '' ? null : (int) $x['score']; abort_if($sc !== null && ($sc < 1 || $sc > 4), 422, 'Điểm mỗi tiêu chí chỉ từ 1 đến 4.'); $in[$cid] = ['score' => $sc, 'note' => mb_substr(trim((string) ($x['note'] ?? '')), 0, 500) ?: null]; }
        $sw = 0; $tw = 0; $scored = 0; foreach ($in as $cid => $x) if ($x['score'] !== null) { $sw += $x['score'] * $crit[$cid]; $tw += 4 * $crit[$cid]; $scored++; }
        $pct = $tw > 0 ? round($sw / $tw * 100, 2) : null;
        $str = trim((string) $r->input('strengths', '')); $weak = trim((string) $r->input('weaknesses', '')); $sug = trim((string) $r->input('suggestions', ''));
        if ($submit) {
            $activeCount = (int) DB::selectOne('SELECT COUNT(*) n FROM sm_ob_criteria WHERE template_id = ? AND active = 1', [$tpl])->n;
            abort_if($scored < max(1, (int) ceil($activeCount * 0.7)), 422, "Cần chấm ít nhất 70% tiêu chí ($scored/$activeCount) mới nộp được phiếu; tiêu chí không áp dụng có thể để trống.");
            abort_if(mb_strlen($str) < 5, 422, 'Hãy ghi ít nhất một ưu điểm của tiết dạy.'); abort_if(mb_strlen($sug) < 5, 422, 'Hãy ghi góp ý / đề xuất cải tiến cho đồng nghiệp.');
        }
        $now = $this->utc(); $first = !$e || $e->status !== 'submitted';
        $row = ['template_id' => $tpl, 'strengths' => $str ?: null, 'weaknesses' => $weak ?: null, 'suggestions' => $sug ?: null, 'percent' => $pct, 'rating' => $this->rating($pct), 'updated_at' => $now];
        if ($submit) { $row['status'] = 'submitted'; if ($first) $row['submitted_at'] = $now; } elseif (!$e) $row['status'] = 'draft';
        if ($e) { DB::table('sm_ob_evals')->where('id', $e->id)->update($row); $eid = (int) $e->id; }
        else { $eid = DB::table('sm_ob_evals')->insertGetId($row + ['session_id' => $s->id, 'observer_id' => $tid, 'created_at' => $now]); }
        DB::table('sm_ob_scores')->where('eval_id', $eid)->delete();
        foreach ($in as $cid => $x) DB::table('sm_ob_scores')->insert(['eval_id' => $eid, 'criterion_id' => $cid, 'score' => $x['score'], 'note' => $x['note']]);
        if ($submit) {
            $left = (int) DB::selectOne("SELECT COUNT(*) n FROM sm_ob_observers o LEFT JOIN sm_ob_evals e ON e.session_id = o.session_id AND e.observer_id = o.teacher_id WHERE o.session_id = ? AND o.status = 'accepted' AND (e.id IS NULL OR e.status <> 'submitted')", [$s->id])->n;
            DB::table('sm_ob_sessions')->where('id', $s->id)->update(['status' => $left === 0 ? 'completed' : 'scheduled', 'updated_at' => $now]);
            if ($first) $this->notify((int) $s->observed_id, "Có nhận xét mới cho bài “{$s->title}”", "{$st->name}: " . $this->rating($pct) . " ($pct%). Hãy xem và phản hồi / lập kế hoạch cải tiến.", '/teacher/observations/ket-qua?eval=' . $eid, 'high');
        }
        return response()->json(['id' => $eid, 'percent' => $pct, 'rating' => $this->rating($pct), 'status' => $submit ? 'submitted' : 'draft', 'message' => $submit ? 'Đã nộp phiếu nhận xét và thông báo cho giáo viên được dự.' : 'Đã lưu nháp phiếu.']);
    }
    public function evalShow(Request $r, $id)
    {
        [$st, $tid, $admin] = $this->who($r); $e = DB::table('sm_ob_evals')->where('id', (int) $id)->first(); abort_unless($e, 404, 'Không tìm thấy phiếu.');
        $s = $this->sess((int) $e->session_id); $isObserved = $tid > 0 && (int) $s->observed_id === $tid;
        abort_unless($admin || (int) $e->observer_id === $tid || ($isObserved && $e->status === 'submitted'), 403, 'Bạn không có quyền xem phiếu này.');
        $ob = $this->observersOf([(int) $s->id]); $tpl = DB::table('sm_ob_templates')->where('id', $e->template_id)->first();
        $acts = DB::select('SELECT id, content, due_date, status, done_at FROM sm_ob_actions WHERE eval_id = ? ORDER BY id', [(int) $e->id]);
        return response()->json(['session' => $this->fmt($s, $ob[(int) $s->id] ?? [], $tid, $admin, (int) $st->id), 'template' => ['id' => (int) $tpl->id, 'name' => $tpl->name], 'observer' => $this->teacherName((int) $e->observer_id), 'criteria' => $this->criteriaFor((int) $e->template_id, (int) $e->id), 'eval' => $this->evalOut($e),
            'can_ack' => $isObserved && $e->status === 'submitted', 'actions' => array_map(fn ($a) => ['id' => (int) $a->id, 'content' => $a->content, 'due_date' => $a->due_date, 'status' => $a->status, 'done_at' => $this->iso($a->done_at)], $acts)]);
    }
    public function evalAck(Request $r, $id)
    {
        [$st, $tid] = $this->need($r); $e = DB::table('sm_ob_evals')->where('id', (int) $id)->first(); abort_unless($e && $e->status === 'submitted', 404, 'Không tìm thấy phiếu.');
        $s = $this->sess((int) $e->session_id); abort_unless((int) $s->observed_id === $tid, 403, 'Chỉ giáo viên được dự giờ mới phản hồi được.');
        $reply = trim((string) $r->input('reply', '')); abort_if(mb_strlen($reply) > 2000, 422, 'Phản hồi tối đa 2000 ký tự.');
        $first = $e->ack_at === null;
        DB::table('sm_ob_evals')->where('id', $e->id)->update(['reply' => $reply ?: null, 'ack_at' => $e->ack_at ?: $this->utc(), 'updated_at' => $this->utc()]);
        if ($first) $this->notify((int) $e->observer_id, $this->teacherName($tid) . " đã xem nhận xét bài “{$s->title}”", $reply ? 'Phản hồi: ' . mb_substr($reply, 0, 150) : 'Giáo viên đã tiếp thu góp ý của bạn.', '/teacher/observations/lich?open=' . $s->id);
        return response()->json(['message' => $first ? 'Đã xác nhận đã xem và gửi phản hồi.' : 'Đã cập nhật phản hồi.']);
    }

    /* ---------- kết quả của tôi + kế hoạch cải tiến ---------- */
    public function results(Request $r)
    {
        [$st, $tid] = $this->need($r); $yr = (string) $r->query('year', 'current'); $y = $this->yearId(); $yw = $yr === 'all' ? '' : ' AND s.school_year_id = ' . ($yr === 'current' ? $y : (int) $yr);
        $list = DB::select("SELECT e.id, e.percent, e.rating, e.submitted_at, e.ack_at, s.id AS sid, s.title, s.lesson_date, s.subject, s.class_name, s.kind, t.full_name AS observer_name,
              (SELECT COUNT(*) FROM sm_ob_actions a WHERE a.eval_id = e.id) AS acts, (SELECT COUNT(*) FROM sm_ob_actions a WHERE a.eval_id = e.id AND a.status = 'open') AS acts_open
            FROM sm_ob_evals e JOIN sm_ob_sessions s ON s.id = e.session_id LEFT JOIN sm_teachers t ON t.id = e.observer_id WHERE s.observed_id = ? AND e.status = 'submitted'$yw ORDER BY s.lesson_date DESC, e.id DESC", [$tid]);
        $groups = DB::select("SELECT c.grp, AVG(sc.score) a, COUNT(*) n FROM sm_ob_scores sc JOIN sm_ob_evals e ON e.id = sc.eval_id JOIN sm_ob_sessions s ON s.id = e.session_id JOIN sm_ob_criteria c ON c.id = sc.criterion_id
            WHERE e.status = 'submitted' AND s.observed_id = ? AND sc.score IS NOT NULL$yw GROUP BY c.grp ORDER BY c.grp", [$tid]);
        $weak = DB::select("SELECT c.name, c.grp, AVG(sc.score) a FROM sm_ob_scores sc JOIN sm_ob_evals e ON e.id = sc.eval_id JOIN sm_ob_sessions s ON s.id = e.session_id JOIN sm_ob_criteria c ON c.id = sc.criterion_id
            WHERE e.status = 'submitted' AND s.observed_id = ? AND sc.score IS NOT NULL$yw GROUP BY c.id, c.name, c.grp ORDER BY a ASC, c.id LIMIT 3", [$tid]);
        $strong = DB::select("SELECT c.name, c.grp, AVG(sc.score) a FROM sm_ob_scores sc JOIN sm_ob_evals e ON e.id = sc.eval_id JOIN sm_ob_sessions s ON s.id = e.session_id JOIN sm_ob_criteria c ON c.id = sc.criterion_id
            WHERE e.status = 'submitted' AND s.observed_id = ? AND sc.score IS NOT NULL$yw GROUP BY c.id, c.name, c.grp ORDER BY a DESC, c.id LIMIT 3", [$tid]);
        $dist = ['Tốt' => 0, 'Khá' => 0, 'Đạt' => 0, 'Chưa đạt' => 0]; $sum = 0; foreach ($list as $x) { $dist[$x->rating] = ($dist[$x->rating] ?? 0) + 1; $sum += (float) $x->percent; }
        $given = (int) DB::selectOne("SELECT COUNT(*) n FROM sm_ob_evals e JOIN sm_ob_sessions s ON s.id = e.session_id WHERE e.observer_id = ? AND e.status = 'submitted'$yw", [$tid])->n;
        $years = DB::select('SELECT * FROM sm_school_years ORDER BY id DESC');
        $pc = fn ($a) => round((float) $a / 4 * 100, 1);
        return response()->json(['summary' => ['count' => count($list), 'avg_percent' => $list ? round($sum / count($list), 1) : null, 'avg_rating' => $list ? $this->rating($sum / count($list)) : null, 'unack' => count(array_filter($list, fn ($x) => $x->ack_at === null)), 'given' => $given, 'distribution' => $dist],
            'groups' => array_map(fn ($g) => ['name' => $g->grp, 'percent' => $pc($g->a), 'n' => (int) $g->n], $groups),
            'weakest' => array_map(fn ($g) => ['name' => $g->name, 'group' => $g->grp, 'percent' => $pc($g->a)], $weak), 'strongest' => array_map(fn ($g) => ['name' => $g->name, 'group' => $g->grp, 'percent' => $pc($g->a)], $strong),
            'years' => array_map(fn ($y2) => ['id' => (int) $y2->id, 'name' => $this->yearLabel($y2)], $years),
            'data' => array_map(fn ($x) => ['id' => (int) $x->id, 'session_id' => (int) $x->sid, 'title' => $x->title, 'date' => $x->lesson_date, 'subject' => $x->subject, 'class_name' => $x->class_name, 'kind_label' => self::KINDS[$x->kind] ?? $x->kind, 'observer' => $x->observer_name,
                'percent' => (float) $x->percent, 'rating' => $x->rating, 'ack' => $x->ack_at !== null, 'actions' => (int) $x->acts, 'actions_open' => (int) $x->acts_open], $list)]);
    }
    public function actions(Request $r)
    {
        [$st, $tid] = $this->need($r); $stt = (string) $r->query('status', 'all'); $w = 'a.teacher_id = ?'; $b = [$tid];
        if (in_array($stt, ['open', 'done'], true)) { $w .= ' AND a.status = ?'; $b[] = $stt; }
        $rows = DB::select("SELECT a.*, s.title AS session_title FROM sm_ob_actions a LEFT JOIN sm_ob_sessions s ON s.id = a.session_id WHERE $w ORDER BY a.status = 'done', a.due_date IS NULL, a.due_date, a.id DESC", $b); $today = $this->today();
        $cnt = DB::selectOne("SELECT SUM(status = 'open') o, SUM(status = 'done') d FROM sm_ob_actions WHERE teacher_id = ?", [$tid]);
        return response()->json(['counts' => ['open' => (int) $cnt->o, 'done' => (int) $cnt->d], 'data' => array_map(fn ($a) => ['id' => (int) $a->id, 'content' => $a->content, 'due_date' => $a->due_date, 'status' => $a->status, 'done_at' => $this->iso($a->done_at),
            'overdue' => $a->status === 'open' && $a->due_date !== null && $a->due_date < $today, 'session_id' => $a->session_id ? (int) $a->session_id : null, 'eval_id' => $a->eval_id ? (int) $a->eval_id : null, 'session_title' => $a->session_title], $rows)]);
    }
    public function actionSave(Request $r, $id = null)
    {
        [$st, $tid] = $this->need($r); $content = trim((string) $r->input('content', '')); abort_if(mb_strlen($content) < 3 || mb_strlen($content) > 400, 422, 'Nội dung việc cải tiến từ 3 đến 400 ký tự.');
        $due = $r->input('due_date'); $due = $due ? date('Y-m-d', strtotime((string) $due)) : null; $now = $this->utc();
        if ($id) {
            $a = DB::table('sm_ob_actions')->where('id', (int) $id)->where('teacher_id', $tid)->first(); abort_unless($a, 404, 'Không tìm thấy việc cải tiến.');
            $up = ['content' => $content, 'due_date' => $due, 'updated_at' => $now]; if ($r->input('status') !== null) { $stt = $r->input('status') === 'done' ? 'done' : 'open'; $up['status'] = $stt; $up['done_at'] = $stt === 'done' ? ($a->done_at ?: $now) : null; }
            DB::table('sm_ob_actions')->where('id', $a->id)->update($up); return response()->json(['id' => (int) $a->id, 'message' => 'Đã cập nhật.']);
        }
        $eid = (int) $r->input('eval_id', 0); $sid = null;
        if ($eid) { $e = DB::table('sm_ob_evals')->where('id', $eid)->first(); abort_unless($e, 422, 'Phiếu không tồn tại.'); $s = $this->sess((int) $e->session_id); abort_unless((int) $s->observed_id === $tid, 403, 'Phiếu này không phải của bạn.'); $sid = (int) $s->id; }
        $nid = DB::table('sm_ob_actions')->insertGetId(['teacher_id' => $tid, 'session_id' => $sid, 'eval_id' => $eid ?: null, 'content' => $content, 'due_date' => $due, 'status' => 'open', 'created_at' => $now, 'updated_at' => $now]);
        return response()->json(['id' => $nid, 'message' => 'Đã thêm vào kế hoạch cải tiến.'], 201);
    }
    public function actionDelete(Request $r, $id)
    {
        [$st, $tid] = $this->need($r); abort_unless(DB::table('sm_ob_actions')->where('id', (int) $id)->where('teacher_id', $tid)->delete() > 0, 404, 'Không tìm thấy việc cải tiến.');
        return response()->json(['message' => 'Đã xóa.']);
    }

    /* ---------- bộ tiêu chí & cài đặt ---------- */
    private function settingsArr(): array
    {
        $o = ['quota_observe' => 18, 'quota_taught' => 2]; foreach (DB::select('SELECT k, v FROM sm_ob_settings') as $x) if (isset($o[$x->k])) $o[$x->k] = (int) $x->v; return $o;
    }
    public function settings(Request $r) { $this->who($r); return response()->json($this->settingsArr()); }
    public function settingsSave(Request $r)
    {
        $this->adminOnly($r); foreach (['quota_observe', 'quota_taught'] as $k) { $v = (int) $r->input($k, -1); abort_if($v < 0 || $v > 200, 422, 'Chỉ tiêu phải từ 0 đến 200.');
            DB::table('sm_ob_settings')->where('k', $k)->exists() ? DB::table('sm_ob_settings')->where('k', $k)->update(['v' => (string) $v]) : DB::table('sm_ob_settings')->insert(['k' => $k, 'v' => (string) $v]); }
        return response()->json(['message' => 'Đã lưu chỉ tiêu dự giờ.'] + $this->settingsArr());
    }
    public function templates(Request $r)
    {
        [$st, $tid, $admin] = $this->who($r);
        $rows = DB::select('SELECT t.*, (SELECT COUNT(*) FROM sm_ob_criteria c WHERE c.template_id = t.id AND c.active = 1) AS n, (SELECT COUNT(*) FROM sm_ob_evals e WHERE e.template_id = t.id) AS used FROM sm_ob_templates t ' . ($admin ? '' : "WHERE t.status = 'active' ") . 'ORDER BY t.is_default DESC, t.id');
        return response()->json(['data' => array_map(fn ($t) => ['id' => (int) $t->id, 'name' => $t->name, 'description' => $t->description, 'is_default' => (bool) $t->is_default, 'status' => $t->status, 'criteria' => (int) $t->n, 'used' => (int) $t->used], $rows), 'settings' => $this->settingsArr(), 'is_admin' => $admin]);
    }
    public function templateShow(Request $r, $id)
    {
        $this->who($r); $t = DB::table('sm_ob_templates')->where('id', (int) $id)->first(); abort_unless($t, 404, 'Không tìm thấy bộ phiếu.');
        return response()->json(['data' => ['id' => (int) $t->id, 'name' => $t->name, 'description' => $t->description, 'is_default' => (bool) $t->is_default, 'status' => $t->status], 'criteria' => $this->criteriaFor((int) $t->id)]);
    }
    public function templateSave(Request $r, $id = null)
    {
        [$st] = $this->adminOnly($r); $name = trim((string) $r->input('name', '')); abort_if(mb_strlen($name) < 3 || mb_strlen($name) > 160, 422, 'Tên bộ phiếu từ 3 đến 160 ký tự.');
        $crit = (array) $r->input('criteria', []); abort_if(count($crit) < 3, 422, 'Bộ phiếu cần ít nhất 3 tiêu chí.'); abort_if(count($crit) > 40, 422, 'Tối đa 40 tiêu chí.');
        $clean = []; foreach ($crit as $i => $c) { $g = trim((string) ($c['group'] ?? '')); $n = trim((string) ($c['name'] ?? '')); $w = (float) ($c['weight'] ?? 1);
            abort_if($g === '' || mb_strlen($n) < 3, 422, 'Tiêu chí thứ ' . ($i + 1) . ' thiếu nhóm hoặc nội dung.'); abort_if($w < 0.5 || $w > 5, 422, 'Trọng số mỗi tiêu chí từ 0.5 đến 5.');
            $clean[] = ['id' => (int) ($c['id'] ?? 0), 'grp' => mb_substr($g, 0, 140), 'name' => mb_substr($n, 0, 300), 'hint' => mb_substr(trim((string) ($c['hint'] ?? '')), 0, 300) ?: null, 'weight' => $w, 'sort' => $i + 1]; }
        $now = $this->utc();
        if ($id) { $t = DB::table('sm_ob_templates')->where('id', (int) $id)->first(); abort_unless($t, 404, 'Không tìm thấy bộ phiếu.'); $stt = $r->input('status') === 'archived' ? 'archived' : 'active'; abort_if($stt === 'archived' && $t->is_default, 422, 'Không lưu trữ được bộ phiếu mặc định.');
            DB::table('sm_ob_templates')->where('id', $t->id)->update(['name' => $name, 'description' => mb_substr(trim((string) $r->input('description', '')), 0, 400) ?: null, 'status' => $stt, 'updated_at' => $now]); $tid2 = (int) $t->id; }
        else $tid2 = DB::table('sm_ob_templates')->insertGetId(['name' => $name, 'description' => mb_substr(trim((string) $r->input('description', '')), 0, 400) ?: null, 'is_default' => 0, 'status' => 'active', 'created_by' => $st->id, 'created_at' => $now, 'updated_at' => $now]);
        $keep = []; foreach ($clean as $c) {
            $row = ['grp' => $c['grp'], 'name' => $c['name'], 'hint' => $c['hint'], 'weight' => $c['weight'], 'sort' => $c['sort'], 'active' => 1];
            if ($c['id'] > 0 && DB::table('sm_ob_criteria')->where('id', $c['id'])->where('template_id', $tid2)->exists()) { DB::table('sm_ob_criteria')->where('id', $c['id'])->update($row); $keep[] = $c['id']; }
            else $keep[] = DB::table('sm_ob_criteria')->insertGetId($row + ['template_id' => $tid2]);
        }
        foreach (DB::select('SELECT id FROM sm_ob_criteria WHERE template_id = ? AND active = 1', [$tid2]) as $x) if (!in_array((int) $x->id, $keep, true)) DB::table('sm_ob_criteria')->where('id', $x->id)->update(['active' => 0]);   // ẩn, không xóa để giữ điểm cũ
        return response()->json(['id' => $tid2, 'message' => $id ? 'Đã lưu bộ phiếu.' : 'Đã tạo bộ phiếu mới.'], $id ? 200 : 201);
    }
    public function templateDefault(Request $r, $id)
    {
        $this->adminOnly($r); $t = DB::table('sm_ob_templates')->where('id', (int) $id)->first(); abort_unless($t, 404, 'Không tìm thấy bộ phiếu.'); abort_if($t->status !== 'active', 422, 'Bộ phiếu đã lưu trữ.');
        DB::table('sm_ob_templates')->where('is_default', 1)->update(['is_default' => 0]); DB::table('sm_ob_templates')->where('id', $t->id)->update(['is_default' => 1]);
        return response()->json(['message' => 'Đã đặt làm bộ phiếu mặc định.']);
    }

    /* ---------- báo cáo (Ban giám hiệu / giáo vụ) ---------- */
    public function report(Request $r)
    {
        $this->adminOnly($r); $yr = (string) $r->query('year', 'current'); $y = $yr === 'all' ? 0 : ($yr === 'current' ? $this->yearId() : (int) $yr); $yw = $y ? ' AND s.school_year_id = ' . $y : '';
        $stt = []; foreach (DB::select("SELECT s.status, COUNT(*) n FROM sm_ob_sessions s WHERE 1=1$yw GROUP BY s.status") as $x) $stt[$x->status] = (int) $x->n;
        $kind = []; foreach (DB::select("SELECT s.kind, COUNT(*) n FROM sm_ob_sessions s WHERE s.status <> 'cancelled'$yw GROUP BY s.kind") as $x) $kind[] = ['kind' => $x->kind, 'label' => self::KINDS[$x->kind] ?? $x->kind, 'n' => (int) $x->n];
        $dist = ['Tốt' => 0, 'Khá' => 0, 'Đạt' => 0, 'Chưa đạt' => 0]; foreach (DB::select("SELECT e.rating, COUNT(*) n FROM sm_ob_evals e JOIN sm_ob_sessions s ON s.id = e.session_id WHERE e.status = 'submitted'$yw GROUP BY e.rating") as $x) if (isset($dist[$x->rating])) $dist[$x->rating] = (int) $x->n;
        $avg = DB::selectOne("SELECT AVG(e.percent) a FROM sm_ob_evals e JOIN sm_ob_sessions s ON s.id = e.session_id WHERE e.status = 'submitted'$yw")->a;
        $months = DB::select("SELECT DATE_FORMAT(s.lesson_date, '%Y-%m') ym, COUNT(*) n FROM sm_ob_sessions s WHERE s.status <> 'cancelled'$yw GROUP BY ym ORDER BY ym");
        $crit = DB::select("SELECT c.grp, AVG(sc.score) a FROM sm_ob_scores sc JOIN sm_ob_evals e ON e.id = sc.eval_id JOIN sm_ob_sessions s ON s.id = e.session_id JOIN sm_ob_criteria c ON c.id = sc.criterion_id WHERE e.status = 'submitted' AND sc.score IS NOT NULL$yw GROUP BY c.grp ORDER BY c.grp");
        $set = $this->settingsArr();
        $rows = DB::select("SELECT t.id, t.full_name,
              (SELECT COUNT(DISTINCT e.session_id) FROM sm_ob_evals e JOIN sm_ob_sessions s ON s.id = e.session_id WHERE e.observer_id = t.id AND e.status = 'submitted' AND s.status <> 'cancelled'$yw) AS observer_n,
              (SELECT COUNT(DISTINCT e.session_id) FROM sm_ob_evals e JOIN sm_ob_sessions s ON s.id = e.session_id WHERE s.observed_id = t.id AND e.status = 'submitted'$yw) AS taught_n,
              (SELECT AVG(e.percent) FROM sm_ob_evals e JOIN sm_ob_sessions s ON s.id = e.session_id WHERE s.observed_id = t.id AND e.status = 'submitted'$yw) AS avg_percent,
              (SELECT COUNT(*) FROM sm_ob_sessions s WHERE s.observed_id = t.id AND s.status IN ('pending','scheduled')$yw) AS upcoming
            FROM sm_teachers t ORDER BY t.full_name");
        $teachers = array_map(fn ($x) => ['id' => (int) $x->id, 'name' => $x->full_name, 'observer_n' => (int) $x->observer_n, 'taught_n' => (int) $x->taught_n, 'upcoming' => (int) $x->upcoming,
            'avg_percent' => $x->avg_percent !== null ? round((float) $x->avg_percent, 1) : null, 'avg_rating' => $this->rating($x->avg_percent !== null ? (float) $x->avg_percent : null),
            'observe_ok' => (int) $x->observer_n >= $set['quota_observe'], 'taught_ok' => (int) $x->taught_n >= $set['quota_taught']], $rows);
        $years = DB::select('SELECT * FROM sm_school_years ORDER BY id DESC');
        return response()->json(['totals' => ['sessions' => array_sum($stt), 'by_status' => $stt, 'evals' => array_sum($dist), 'avg_percent' => $avg !== null ? round((float) $avg, 1) : null, 'avg_rating' => $this->rating($avg !== null ? (float) $avg : null),
                'teachers' => count($teachers), 'below_observe' => count(array_filter($teachers, fn ($t) => !$t['observe_ok'])), 'below_taught' => count(array_filter($teachers, fn ($t) => !$t['taught_ok']))],
            'settings' => $set, 'by_kind' => $kind, 'distribution' => $dist, 'by_month' => array_map(fn ($m) => ['m' => $m->ym, 'n' => (int) $m->n], $months),
            'groups' => array_map(fn ($g) => ['name' => $g->grp, 'percent' => round((float) $g->a / 4 * 100, 1)], $crit), 'teachers' => $teachers,
            'years' => array_map(fn ($y2) => ['id' => (int) $y2->id, 'name' => $this->yearLabel($y2)], $years)]);
    }
}
