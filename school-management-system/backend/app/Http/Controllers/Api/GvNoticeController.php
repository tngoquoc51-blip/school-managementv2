<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Module "Thông báo" của Ban Giám hiệu: /api/gv/notices/*  (+ 3 endpoint công khai cho các cổng khác)
 * Bảng: sm_nt_notices, sm_nt_reads, sm_nt_history, sm_nt_templates, sm_nt_settings.
 * Quyền (middleware BghAccess): Hiệu trưởng, Phó hiệu trưởng, Quản trị.
 *  - Phó hiệu trưởng: khi bật "cần duyệt" thì thông báo gửi đi sẽ chờ Hiệu trưởng duyệt.
 *  - Duyệt / từ chối: Hiệu trưởng và Quản trị.
 * Thời gian lưu theo UTC; giao diện tự đổi sang giờ địa phương.
 */
class GvNoticeController extends Controller
{
    private const APPROVERS = ['super_admin', 'principal'];
    private const CATS = [
        'general' => 'Thông báo chung', 'study' => 'Học tập & chuyên môn', 'exam' => 'Thi & kiểm tra', 'meeting' => 'Họp & sự kiện',
        'fee' => 'Học phí', 'holiday' => 'Lịch nghỉ', 'discipline' => 'Nề nếp & kỷ luật', 'policy' => 'Quy định & văn bản',
    ];
    private const PRIORITIES = ['normal', 'high', 'urgent'];
    private const STATUSES = ['draft', 'pending', 'scheduled', 'sent', 'rejected', 'archived'];
    private const TYPES = ['student', 'teacher', 'parent', 'staff'];
    private const VN_OFFSET = 7; // giờ, dùng để gom theo ngày

    private function db() { return DB::connection(); }
    private function now(): string { return now()->format('Y-m-d H:i:s'); }

    private function fail(string $msg, int $code = 422, array $errors = [])
    {
        $b = ['message' => $msg];
        if ($errors) $b['errors'] = $errors;
        return response()->json($b, $code);
    }

    private function me(Request $r): array
    {
        $s = (array) $r->attributes->get('sm_staff');
        return ['u' => mb_substr((string) ($s['username'] ?? 'staff'), 0, 40), 'n' => mb_substr((string) ($s['name'] ?? 'Ban Giám hiệu'), 0, 80), 'role' => (string) ($s['role'] ?? '')];
    }

    private function canApprove(array $me): bool { return in_array($me['role'], self::APPROVERS, true); }

    // ---------- Cài đặt ----------
    private function settings(): array
    {
        $d = ['require_approval' => '0', 'default_expire_days' => '30', 'auto_archive_days' => '120', 'signature' => 'Ban Giám hiệu'];
        foreach ($this->db()->select('SELECT k, v FROM sm_nt_settings') as $row) $d[$row->k] = $row->v;
        return $d;
    }

    public function settingsGet() { return response()->json(['data' => $this->settings()]); }

    public function settingsUpdate(Request $r)
    {
        $me = $this->me($r);
        if (!$this->canApprove($me)) return $this->fail('Chỉ Hiệu trưởng hoặc Quản trị mới được đổi cài đặt.', 403);
        $in = [
            'require_approval' => $r->boolean('require_approval') ? '1' : '0',
            'default_expire_days' => (string) max(0, min(365, (int) $r->input('default_expire_days', 30))),
            'auto_archive_days' => (string) max(0, min(1000, (int) $r->input('auto_archive_days', 120))),
            'signature' => mb_substr(trim((string) $r->input('signature', 'Ban Giám hiệu')), 0, 80) ?: 'Ban Giám hiệu',
        ];
        foreach ($in as $k => $v) $this->db()->statement('INSERT INTO sm_nt_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [$k, $v]);
        return response()->json(['data' => $this->settings(), 'message' => 'Đã lưu cài đặt.']);
    }

    // ---------- Tiện ích dữ liệu ----------
    private function yearId(): int
    {
        $row = $this->db()->selectOne('SELECT id FROM sm_school_years WHERE is_current = 1 ORDER BY id DESC LIMIT 1')
            ?: $this->db()->selectOne('SELECT id FROM sm_school_years ORDER BY id DESC LIMIT 1');
        return (int) ($row->id ?? 0);
    }

    private function csvInts($v, int $min = 1, int $max = 100000): string
    {
        $arr = is_array($v) ? $v : explode(',', (string) $v);
        $out = [];
        foreach ($arr as $x) { $i = (int) $x; if ($i >= $min && $i <= $max) $out[$i] = $i; }
        ksort($out);
        return implode(',', $out);
    }

    private function parseTime($v): ?string
    {
        if ($v === null || $v === '') return null;
        try { return Carbon::parse((string) $v)->utc()->format('Y-m-d H:i:s'); } catch (\Throwable $e) { return null; }
    }

    private function nextCode(): string
    {
        $y = now()->format('Y');
        $last = $this->db()->selectOne("SELECT code FROM sm_nt_notices WHERE code LIKE ? ORDER BY id DESC LIMIT 1", ["TB-$y-%"]);
        $n = $last ? ((int) substr($last->code, -4)) + 1 : 1;
        return sprintf('TB-%s-%04d', $y, $n);
    }

    private function hist(int $id, string $action, string $actor, ?string $note = null): void
    {
        $this->db()->insert('INSERT INTO sm_nt_history (notice_id, action, actor, note, created_at) VALUES (?,?,?,?,?)',
            [$id, $action, mb_substr($actor, 0, 80), $note !== null ? mb_substr($note, 0, 300) : null, $this->now()]);
    }

    /** Điều kiện lớp/khối (hợp: thuộc khối HOẶC thuộc lớp chỉ định). Trả '' nếu gửi tất cả. */
    private function classCond(array $n, array &$b): string
    {
        $g = array_filter(array_map('intval', explode(',', (string) ($n['grades'] ?? ''))));
        $c = array_filter(array_map('intval', explode(',', (string) ($n['class_ids'] ?? ''))));
        $parts = [];
        if ($g) { $parts[] = 'c.grade IN (' . implode(',', array_fill(0, count($g), '?')) . ')'; array_push($b, ...array_values($g)); }
        if ($c) { $parts[] = 'c.id IN (' . implode(',', array_fill(0, count($c), '?')) . ')'; array_push($b, ...array_values($c)); }
        return $parts ? ' AND (' . implode(' OR ', $parts) . ')' : '';
    }

    /** Số người nhận theo từng nhóm */
    private function audience(array $n): array
    {
        $d = $this->db();
        $out = ['teachers' => 0, 'students' => 0, 'parents' => 0, 'staff' => 0];
        if (!empty($n['to_teachers'])) $out['teachers'] = (int) $d->selectOne('SELECT COUNT(*) c FROM sm_teachers')->c;
        if (!empty($n['to_students']) || !empty($n['to_parents'])) {
            $b = [$this->yearId()];
            $sql = 'SELECT COUNT(*) c FROM sm_enrollments e JOIN sm_classes c ON c.id = e.class_id WHERE e.school_year_id = ?' . $this->classCond($n, $b);
            $cnt = (int) $d->selectOne($sql, $b)->c;
            if (!empty($n['to_students'])) $out['students'] = $cnt;
            if (!empty($n['to_parents'])) $out['parents'] = $cnt;
        }
        if (!empty($n['to_staff'])) $out['staff'] = (int) $d->selectOne('SELECT COUNT(*) c FROM sm_staff_accounts')->c;
        $out['total'] = $out['teachers'] + $out['students'] + $out['parents'] + $out['staff'];
        return $out;
    }

    private function classNames(string $ids): array
    {
        $ids = array_filter(array_map('intval', explode(',', $ids)));
        if (!$ids) return [];
        $rows = $this->db()->select('SELECT id, name FROM sm_classes WHERE id IN (' . implode(',', array_fill(0, count($ids), '?')) . ') ORDER BY grade, name', array_values($ids));
        return array_map(fn ($r) => ['id' => (int) $r->id, 'name' => $r->name], $rows);
    }

    private function audienceLabel(array $n): string
    {
        $p = [];
        if ($n['to_teachers']) $p[] = 'Giáo viên';
        if ($n['to_students']) $p[] = 'Học sinh';
        if ($n['to_parents']) $p[] = 'Phụ huynh';
        if ($n['to_staff']) $p[] = 'Nhân viên';
        $s = implode(', ', $p) ?: '—';
        if (($n['to_students'] || $n['to_parents'])) {
            if ($n['grades'] !== '') $s .= ' · khối ' . str_replace(',', ', ', $n['grades']);
            if ($n['class_ids'] !== '') $s .= ' · ' . count(array_filter(explode(',', $n['class_ids']))) . ' lớp chọn';
        }
        return $s;
    }

    private function fmt($row, bool $full = false): array
    {
        $n = (array) $row;
        $links = [];
        if (!empty($n['links'])) { $j = json_decode((string) $n['links'], true); if (is_array($j)) $links = $j; }
        $exp = $n['expires_at'] ?? null;
        $o = [
            'id' => (int) $n['id'], 'code' => $n['code'], 'title' => $n['title'],
            'excerpt' => mb_substr(trim(preg_replace('/\s+/u', ' ', (string) $n['body'])), 0, 160),
            'category' => $n['category'], 'category_label' => self::CATS[$n['category']] ?? $n['category'],
            'priority' => $n['priority'], 'status' => $n['status'],
            'to_teachers' => (int) $n['to_teachers'], 'to_students' => (int) $n['to_students'], 'to_parents' => (int) $n['to_parents'], 'to_staff' => (int) $n['to_staff'],
            'grades' => $n['grades'] === '' ? [] : array_map('intval', explode(',', $n['grades'])),
            'class_ids' => $n['class_ids'] === '' ? [] : array_map('intval', explode(',', $n['class_ids'])),
            'audience_label' => $this->audienceLabel($n),
            'pinned' => (int) $n['pinned'], 'require_ack' => (int) $n['require_ack'], 'links' => $links,
            'scheduled_at' => $n['scheduled_at'], 'sent_at' => $n['sent_at'], 'expires_at' => $exp,
            'expired' => $exp ? Carbon::parse($exp, 'UTC')->isPast() : false,
            'last_reminded_at' => $n['last_reminded_at'],
            'recipients_total' => (int) $n['recipients_total'],
            'reads_count' => isset($n['reads_count']) ? (int) $n['reads_count'] : null,
            'ack_count' => isset($n['ack_count']) ? (int) $n['ack_count'] : null,
            'created_by' => $n['created_by'], 'created_by_name' => $n['created_by_name'],
            'approved_by' => $n['approved_by'], 'approved_at' => $n['approved_at'], 'review_note' => $n['review_note'],
            'created_at' => $n['created_at'], 'updated_at' => $n['updated_at'],
        ];
        if ($full) { $o['body'] = $n['body']; $o['classes'] = $this->classNames($n['class_ids']); }
        return $o;
    }

    private const SELECT = 'n.*, (SELECT COUNT(*) FROM sm_nt_reads r WHERE r.notice_id = n.id) AS reads_count, (SELECT COUNT(*) FROM sm_nt_reads r WHERE r.notice_id = n.id AND r.ack_at IS NOT NULL) AS ack_count';

    private function find(int $id)
    {
        return $this->db()->selectOne('SELECT ' . self::SELECT . ' FROM sm_nt_notices n WHERE n.id = ?', [$id]);
    }

    // ---------- Lên lịch tự động & dọn dẹp ----------
    private function dispatchDue(): void
    {
        if (!Cache::add('nt_dispatch_lock', 1, 15)) return;
        try {
            $d = $this->db();
            $due = $d->select("SELECT * FROM sm_nt_notices WHERE status = 'scheduled' AND scheduled_at <= ? ORDER BY scheduled_at LIMIT 50", [$this->now()]);
            foreach ($due as $row) {
                $n = (array) $row;
                $tot = $this->audience($n)['total'];
                $d->update("UPDATE sm_nt_notices SET status = 'sent', sent_at = scheduled_at, recipients_total = ?, updated_at = ? WHERE id = ? AND status = 'scheduled'", [$tot, $this->now(), $n['id']]);
                $this->hist((int) $n['id'], 'sent', 'Hệ thống', 'Đến giờ hẹn, thông báo đã được gửi tự động.');
            }
            $days = (int) ($this->settings()['auto_archive_days'] ?? 0);
            if ($days > 0) {
                $d->update("UPDATE sm_nt_notices SET status = 'archived', updated_at = ? WHERE status = 'sent' AND pinned = 0 AND sent_at < ?", [$this->now(), now()->subDays($days)->format('Y-m-d H:i:s')]);
            }
        } catch (\Throwable $e) { /* không để lỗi nền làm hỏng request */ }
    }

    // ---------- Tổng quan ----------
    public function overview(Request $r)
    {
        $this->dispatchDue();
        $d = $this->db();
        $since30 = now()->subDays(30)->format('Y-m-d H:i:s');
        $off = self::VN_OFFSET;

        $cnt = [];
        foreach ($d->select('SELECT status, COUNT(*) c FROM sm_nt_notices GROUP BY status') as $x) $cnt[$x->status] = (int) $x->c;
        $sum = $d->selectOne("SELECT COUNT(*) sent30, COALESCE(SUM(recipients_total),0) rcp, COALESCE(SUM((SELECT COUNT(*) FROM sm_nt_reads r WHERE r.notice_id = n.id)),0) rd
                              FROM sm_nt_notices n WHERE n.status IN ('sent','archived') AND n.sent_at >= ?", [$since30]);
        $rate = ((int) $sum->rcp) > 0 ? round(min(100, ((int) $sum->rd) / ((int) $sum->rcp) * 100), 1) : 0;

        $days = [];
        for ($i = 13; $i >= 0; $i--) $days[Carbon::now('Asia/Ho_Chi_Minh')->subDays($i)->format('Y-m-d')] = ['d' => null, 'sent' => 0, 'reads' => 0];
        $since14 = now()->subDays(15)->format('Y-m-d H:i:s');
        foreach ($d->select("SELECT DATE(DATE_ADD(sent_at, INTERVAL $off HOUR)) d, COUNT(*) c FROM sm_nt_notices WHERE sent_at >= ? AND status IN ('sent','archived') GROUP BY d", [$since14]) as $x) if (isset($days[$x->d])) $days[$x->d]['sent'] = (int) $x->c;
        foreach ($d->select("SELECT DATE(DATE_ADD(read_at, INTERVAL $off HOUR)) d, COUNT(*) c FROM sm_nt_reads WHERE read_at >= ? GROUP BY d", [$since14]) as $x) if (isset($days[$x->d])) $days[$x->d]['reads'] = (int) $x->c;
        $series = [];
        foreach ($days as $k => $v) $series[] = ['d' => $k, 'sent' => $v['sent'], 'reads' => $v['reads']];

        $cats = [];
        foreach ($d->select("SELECT category, COUNT(*) c FROM sm_nt_notices WHERE status IN ('sent','archived') AND sent_at >= ? GROUP BY category ORDER BY c DESC", [$since30]) as $x)
            $cats[] = ['key' => $x->category, 'label' => self::CATS[$x->category] ?? $x->category, 'n' => (int) $x->c];

        $list = fn (string $where, array $b, string $order, int $lim) => array_map(fn ($x) => $this->fmt($x),
            $d->select('SELECT ' . self::SELECT . " FROM sm_nt_notices n WHERE $where ORDER BY $order LIMIT $lim", $b));

        return response()->json(['data' => [
            'kpi' => [
                'sent_30d' => (int) $sum->sent30, 'drafts' => $cnt['draft'] ?? 0, 'pending' => $cnt['pending'] ?? 0,
                'scheduled' => $cnt['scheduled'] ?? 0, 'rejected' => $cnt['rejected'] ?? 0, 'archived' => $cnt['archived'] ?? 0,
                'sent_total' => $cnt['sent'] ?? 0, 'read_rate' => $rate, 'reads_30d' => (int) $sum->rd, 'recipients_30d' => (int) $sum->rcp,
            ],
            'series' => $series, 'categories' => $cats,
            'pending' => $list("n.status = 'pending'", [], 'n.updated_at ASC', 5),
            'upcoming' => $list("n.status = 'scheduled'", [], 'n.scheduled_at ASC', 5),
            'recent' => $list("n.status = 'sent'", [], 'n.sent_at DESC', 6),
            'attention' => $list("n.status = 'sent' AND n.sent_at >= ? AND n.recipients_total > 0 AND (SELECT COUNT(*) FROM sm_nt_reads r WHERE r.notice_id = n.id) < n.recipients_total * 0.5", [now()->subDays(14)->format('Y-m-d H:i:s')], 'n.sent_at DESC', 4),
        ]]);
    }

    // ---------- Danh sách ----------
    public function index(Request $r)
    {
        $this->dispatchDue();
        $me = $this->me($r);
        $w = ['1=1']; $b = [];
        $st = (string) $r->query('status', 'all');
        if (in_array($st, self::STATUSES, true)) { $w[] = 'n.status = ?'; $b[] = $st; }
        if ($r->boolean('mine')) { $w[] = 'n.created_by = ?'; $b[] = $me['u']; }
        if (($c = (string) $r->query('category', '')) !== '' && isset(self::CATS[$c])) { $w[] = 'n.category = ?'; $b[] = $c; }
        if (($p = (string) $r->query('priority', '')) !== '' && in_array($p, self::PRIORITIES, true)) { $w[] = 'n.priority = ?'; $b[] = $p; }
        if (($q = trim((string) $r->query('q', ''))) !== '') {
            $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], mb_substr($q, 0, 80)) . '%';
            $w[] = '(n.title LIKE ? OR n.body LIKE ? OR n.code LIKE ? OR n.created_by_name LIKE ?)';
            array_push($b, $like, $like, $like, $like);
        }
        $where = implode(' AND ', $w);
        $per = max(5, min(50, (int) $r->query('per', 15)));
        $page = max(1, (int) $r->query('page', 1));
        $total = (int) $this->db()->selectOne("SELECT COUNT(*) c FROM sm_nt_notices n WHERE $where", $b)->c;
        $order = match ((string) $r->query('sort', 'new')) { 'old' => 'n.updated_at ASC', 'read' => 'reads_count DESC', default => 'n.pinned DESC, n.updated_at DESC' };
        $rows = $this->db()->select('SELECT ' . self::SELECT . " FROM sm_nt_notices n WHERE $where ORDER BY $order LIMIT $per OFFSET " . (($page - 1) * $per), $b);

        $counts = ['all' => 0];
        foreach ($this->db()->select('SELECT status, COUNT(*) c FROM sm_nt_notices GROUP BY status') as $x) { $counts[$x->status] = (int) $x->c; $counts['all'] += (int) $x->c; }
        return response()->json(['data' => array_map(fn ($x) => $this->fmt($x), $rows), 'meta' => ['total' => $total, 'page' => $page, 'per' => $per, 'pages' => max(1, (int) ceil($total / $per))], 'counts' => $counts]);
    }

    public function meta()
    {
        $y = $this->yearId();
        $classes = $this->db()->select('SELECT c.id, c.grade, c.name, (SELECT COUNT(*) FROM sm_enrollments e WHERE e.class_id = c.id AND e.school_year_id = c.school_year_id) AS students FROM sm_classes c WHERE c.school_year_id = ? ORDER BY c.grade, c.name', [$y]);
        return response()->json(['data' => [
            'categories' => array_map(fn ($k, $v) => ['key' => $k, 'label' => $v], array_keys(self::CATS), array_values(self::CATS)),
            'classes' => array_map(fn ($c) => ['id' => (int) $c->id, 'grade' => (int) $c->grade, 'name' => $c->name, 'students' => (int) $c->students], $classes),
            'settings' => $this->settings(),
        ]]);
    }

    public function audiencePreview(Request $r)
    {
        $n = [
            'to_teachers' => $r->boolean('to_teachers'), 'to_students' => $r->boolean('to_students'), 'to_parents' => $r->boolean('to_parents'), 'to_staff' => $r->boolean('to_staff'),
            'grades' => $this->csvInts($r->input('grades', []), 10, 12), 'class_ids' => $this->csvInts($r->input('class_ids', [])),
        ];
        return response()->json(['data' => $this->audience($n)]);
    }

    // ---------- Chi tiết ----------
    public function show(int $id)
    {
        $this->dispatchDue();
        $row = $this->find($id);
        if (!$row) return $this->fail('Không tìm thấy thông báo.', 404);
        $d = $this->db();
        $n = $this->fmt($row, true);
        $aud = $this->audience((array) $row);

        $reads = ['student' => 0, 'teacher' => 0, 'parent' => 0, 'staff' => 0];
        foreach ($d->select('SELECT user_type, COUNT(*) c FROM sm_nt_reads WHERE notice_id = ? GROUP BY user_type', [$id]) as $x) $reads[$x->user_type] = (int) $x->c;
        $groups = [
            ['key' => 'student', 'label' => 'Học sinh', 'total' => $aud['students'], 'read' => $reads['student']],
            ['key' => 'parent', 'label' => 'Phụ huynh', 'total' => $aud['parents'], 'read' => $reads['parent']],
            ['key' => 'teacher', 'label' => 'Giáo viên', 'total' => $aud['teachers'], 'read' => $reads['teacher']],
            ['key' => 'staff', 'label' => 'Nhân viên', 'total' => $aud['staff'], 'read' => $reads['staff']],
        ];
        $groups = array_values(array_filter($groups, fn ($g) => $g['total'] > 0 || $g['read'] > 0));

        // Theo lớp (học sinh + phụ huynh)
        $byClass = [];
        if ($aud['students'] > 0 || $aud['parents'] > 0) {
            $b = [$this->yearId()];
            $cond = $this->classCond((array) $row, $b);
            $cls = $d->select('SELECT c.name, c.grade, COUNT(*) total FROM sm_enrollments e JOIN sm_classes c ON c.id = e.class_id WHERE e.school_year_id = ?' . $cond . ' GROUP BY c.id, c.name, c.grade ORDER BY c.grade, c.name', $b);
            $rd = [];
            foreach ($d->select("SELECT class_name, COUNT(*) c FROM sm_nt_reads WHERE notice_id = ? AND user_type IN ('student','parent') AND class_name IS NOT NULL GROUP BY class_name", [$id]) as $x) $rd[$x->class_name] = (int) $x->c;
            $mult = ($n['to_students'] ? 1 : 0) + ($n['to_parents'] ? 1 : 0);
            foreach ($cls as $c) $byClass[] = ['name' => $c->name, 'grade' => (int) $c->grade, 'total' => (int) $c->total * max(1, $mult), 'read' => $rd[$c->name] ?? 0];
        }

        $off = self::VN_OFFSET;
        $timeline = array_map(fn ($x) => ['d' => $x->d, 'n' => (int) $x->c],
            $d->select("SELECT DATE(DATE_ADD(read_at, INTERVAL $off HOUR)) d, COUNT(*) c FROM sm_nt_reads WHERE notice_id = ? GROUP BY d ORDER BY d", [$id]));
        $history = array_map(fn ($x) => (array) $x, $d->select('SELECT action, actor, note, created_at FROM sm_nt_history WHERE notice_id = ? ORDER BY id DESC LIMIT 60', [$id]));

        return response()->json(['data' => ['notice' => $n, 'audience' => $aud, 'groups' => $groups, 'by_class' => $byClass, 'timeline' => $timeline, 'history' => $history]]);
    }

    public function reads(Request $r, int $id)
    {
        $w = ['notice_id = ?']; $b = [$id];
        if (in_array(($t = (string) $r->query('type', '')), self::TYPES, true)) { $w[] = 'user_type = ?'; $b[] = $t; }
        if ($r->boolean('ack')) $w[] = 'ack_at IS NOT NULL';
        if (($q = trim((string) $r->query('q', ''))) !== '') { $like = '%' . mb_substr($q, 0, 60) . '%'; $w[] = '(user_name LIKE ? OR user_key LIKE ? OR class_name LIKE ?)'; array_push($b, $like, $like, $like); }
        $where = implode(' AND ', $w);
        $per = max(5, min(100, (int) $r->query('per', 20))); $page = max(1, (int) $r->query('page', 1));
        $total = (int) $this->db()->selectOne("SELECT COUNT(*) c FROM sm_nt_reads WHERE $where", $b)->c;
        $rows = $this->db()->select("SELECT user_type, user_key, user_name, class_name, read_at, ack_at FROM sm_nt_reads WHERE $where ORDER BY read_at DESC LIMIT $per OFFSET " . (($page - 1) * $per), $b);
        return response()->json(['data' => array_map(fn ($x) => (array) $x, $rows), 'meta' => ['total' => $total, 'page' => $page, 'per' => $per, 'pages' => max(1, (int) ceil($total / $per))]]);
    }

    /** Danh sách chưa đọc (tính từ danh sách người nhận: học sinh / giáo viên) */
    public function unread(Request $r, int $id)
    {
        $row = $this->find($id);
        if (!$row) return $this->fail('Không tìm thấy thông báo.', 404);
        $n = (array) $row; $d = $this->db();
        $type = (string) $r->query('type', 'student');
        $out = [];
        if ($type === 'teacher') {
            if (!$n['to_teachers']) return response()->json(['data' => [], 'meta' => ['total' => 0]]);
            $rows = $d->select("SELECT t.code, t.full_name name, NULL class_name FROM sm_teachers t WHERE NOT EXISTS (SELECT 1 FROM sm_nt_reads r WHERE r.notice_id = ? AND r.user_type = 'teacher' AND r.user_key = t.code) ORDER BY t.full_name LIMIT 300", [$id]);
        } else {
            if (!$n['to_students'] && !$n['to_parents']) return response()->json(['data' => [], 'meta' => ['total' => 0]]);
            $ut = $type === 'parent' ? 'parent' : 'student';
            $b = [$id, $ut, $this->yearId()];
            $cond = $this->classCond($n, $b);
            if (($cn = trim((string) $r->query('class', ''))) !== '') { $cond .= ' AND c.name = ?'; $b[] = $cn; }
            $rows = $d->select("SELECT s.code, s.full_name name, c.name class_name FROM sm_enrollments e JOIN sm_students s ON s.id = e.student_id JOIN sm_classes c ON c.id = e.class_id
                                WHERE NOT EXISTS (SELECT 1 FROM sm_nt_reads r WHERE r.notice_id = ? AND r.user_type = ? AND r.user_key = s.code) AND e.school_year_id = ? $cond
                                ORDER BY c.grade, c.name, s.full_name LIMIT 300", $b);
        }
        foreach ($rows as $x) $out[] = ['code' => $x->code, 'name' => $x->name, 'class_name' => $x->class_name];
        return response()->json(['data' => $out, 'meta' => ['total' => count($out), 'capped' => count($out) >= 300]]);
    }

    public function export(int $id)
    {
        $row = $this->find($id);
        if (!$row) return $this->fail('Không tìm thấy thông báo.', 404);
        $rows = $this->db()->select('SELECT user_type, user_key, user_name, class_name, read_at, ack_at FROM sm_nt_reads WHERE notice_id = ? ORDER BY read_at', [$id]);
        $lbl = ['student' => 'Học sinh', 'teacher' => 'Giáo viên', 'parent' => 'Phụ huynh', 'staff' => 'Nhân viên'];
        $csv = "\xEF\xBB\xBF" . "Đối tượng,Mã,Họ tên,Lớp,Đọc lúc (UTC),Xác nhận lúc (UTC)\n";
        foreach ($rows as $x) {
            $f = fn ($v) => '"' . str_replace('"', '""', (string) $v) . '"';
            $csv .= implode(',', [$f($lbl[$x->user_type] ?? $x->user_type), $f($x->user_key), $f($x->user_name), $f($x->class_name), $f($x->read_at), $f($x->ack_at)]) . "\n";
        }
        return response($csv, 200, ['Content-Type' => 'text/csv; charset=UTF-8', 'Content-Disposition' => 'attachment; filename="' . $row->code . '-da-doc.csv"']);
    }

    // ---------- Soạn / sửa ----------
    private function clean(Request $r, bool $forDraft): array
    {
        $err = [];
        $title = trim((string) $r->input('title', ''));
        $body = trim((string) $r->input('body', ''));
        if (mb_strlen($title) < 3 || mb_strlen($title) > 150) $err['title'] = 'Tiêu đề từ 3 đến 150 ký tự.';
        if (mb_strlen($body) < ($forDraft ? 1 : 5) || mb_strlen($body) > 8000) $err['body'] = $forDraft ? 'Nội dung không được để trống.' : 'Nội dung từ 5 đến 8000 ký tự.';
        $cat = (string) $r->input('category', 'general'); if (!isset(self::CATS[$cat])) $cat = 'general';
        $pri = (string) $r->input('priority', 'normal'); if (!in_array($pri, self::PRIORITIES, true)) $pri = 'normal';
        $n = [
            'title' => $title, 'body' => $body, 'category' => $cat, 'priority' => $pri,
            'to_teachers' => $r->boolean('to_teachers') ? 1 : 0, 'to_students' => $r->boolean('to_students') ? 1 : 0,
            'to_parents' => $r->boolean('to_parents') ? 1 : 0, 'to_staff' => $r->boolean('to_staff') ? 1 : 0,
            'grades' => $this->csvInts($r->input('grades', []), 10, 12), 'class_ids' => $this->csvInts($r->input('class_ids', [])),
            'pinned' => $r->boolean('pinned') ? 1 : 0, 'require_ack' => $r->boolean('require_ack') ? 1 : 0,
            'scheduled_at' => $this->parseTime($r->input('scheduled_at')), 'expires_at' => $this->parseTime($r->input('expires_at')),
        ];
        if (!$forDraft && !($n['to_teachers'] || $n['to_students'] || $n['to_parents'] || $n['to_staff'])) $err['audience'] = 'Hãy chọn ít nhất một nhóm người nhận.';
        if ($n['expires_at'] && $n['scheduled_at'] && $n['expires_at'] <= $n['scheduled_at']) $err['expires_at'] = 'Thời điểm hết hạn phải sau thời điểm gửi.';
        if ($n['expires_at'] && $n['expires_at'] <= $this->now() && !$n['scheduled_at']) $err['expires_at'] = 'Thời điểm hết hạn phải ở tương lai.';
        $links = [];
        foreach ((array) $r->input('links', []) as $l) {
            $url = trim((string) ($l['url'] ?? '')); $lab = trim((string) ($l['label'] ?? ''));
            if ($url === '') continue;
            if (!preg_match('#^https?://#i', $url)) { $err['links'] = 'Liên kết phải bắt đầu bằng http:// hoặc https://'; break; }
            $links[] = ['label' => mb_substr($lab ?: $url, 0, 80), 'url' => mb_substr($url, 0, 300)];
            if (count($links) >= 5) break;
        }
        $n['links'] = $links ? json_encode($links, JSON_UNESCAPED_UNICODE) : null;
        return [$n, $err];
    }

    /** Quyết định trạng thái khi bấm gửi / hẹn giờ. @return array{0:string,1:array} [status, các cột cập nhật thêm] */
    private function sendState(array $me, array $n, string $why = 'send'): array
    {
        $needs = ($this->settings()['require_approval'] ?? '0') === '1' && $me['role'] === 'vice_principal';
        if ($needs) return ['pending', []];
        $at = $n['scheduled_at'] ?? null;
        if ($at && $at > Carbon::now()->addSeconds(60)->format('Y-m-d H:i:s')) return ['scheduled', []];
        return ['sent', ['sent_at' => $this->now(), 'scheduled_at' => null, 'recipients_total' => $this->audience($n)['total']]];
    }

    private function write(Request $r, ?int $id)
    {
        $me = $this->me($r);
        $wish = (string) $r->input('action', 'draft'); // draft | send
        if (!in_array($wish, ['draft', 'send'], true)) $wish = 'draft';
        [$n, $err] = $this->clean($r, $wish === 'draft');
        if ($err) return $this->fail('Vui lòng kiểm tra lại thông tin.', 422, $err);
        $d = $this->db(); $now = $this->now();
        $ext = [];
        if ($wish === 'draft') $status = 'draft';
        else [$status, $ext] = $this->sendState($me, $n);

        if ($id === null) {
            $code = $this->nextCode();
            for ($i = 0; $i < 3; $i++) {
                try {
                    $d->insert('INSERT INTO sm_nt_notices (code, title, body, category, priority, status, to_teachers, to_students, to_parents, to_staff, grades, class_ids, pinned, require_ack, links, scheduled_at, sent_at, expires_at, recipients_total, created_by, created_by_name, created_at, updated_at)
                                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                        [$code, $n['title'], $n['body'], $n['category'], $n['priority'], $status, $n['to_teachers'], $n['to_students'], $n['to_parents'], $n['to_staff'], $n['grades'], $n['class_ids'], $n['pinned'], $n['require_ack'], $n['links'],
                         array_key_exists('scheduled_at', $ext) ? $ext['scheduled_at'] : $n['scheduled_at'], $ext['sent_at'] ?? null, $n['expires_at'], $ext['recipients_total'] ?? 0, $me['u'], $me['n'], $now, $now]);
                    break;
                } catch (\Throwable $e) { if ($i === 2) throw $e; $code = $this->nextCode(); }
            }
            $nid = (int) $d->getPdo()->lastInsertId();
            $this->hist($nid, 'create', $me['n'], $status === 'draft' ? 'Lưu bản nháp' : null);
        } else {
            $cur = $this->find($id);
            if (!$cur) return $this->fail('Không tìm thấy thông báo.', 404);
            if (!in_array($cur->status, ['draft', 'rejected', 'scheduled'], true)) return $this->fail('Thông báo đã gửi hoặc đang chờ duyệt nên không thể sửa. Hãy thu hồi / nhân bản để soạn lại.', 409);
            if ($cur->created_by !== $me['u'] && !$this->canApprove($me)) return $this->fail('Bạn chỉ sửa được thông báo do mình soạn.', 403);
            $d->update('UPDATE sm_nt_notices SET title=?, body=?, category=?, priority=?, status=?, to_teachers=?, to_students=?, to_parents=?, to_staff=?, grades=?, class_ids=?, pinned=?, require_ack=?, links=?, scheduled_at=?, sent_at=?, expires_at=?, recipients_total=?, review_note=NULL, updated_at=? WHERE id=?',
                [$n['title'], $n['body'], $n['category'], $n['priority'], $status, $n['to_teachers'], $n['to_students'], $n['to_parents'], $n['to_staff'], $n['grades'], $n['class_ids'], $n['pinned'], $n['require_ack'], $n['links'],
                 array_key_exists('scheduled_at', $ext) ? $ext['scheduled_at'] : $n['scheduled_at'], $ext['sent_at'] ?? null, $n['expires_at'], $ext['recipients_total'] ?? 0, $now, $id]);
            $nid = $id;
            $this->hist($nid, 'edit', $me['n'], null);
        }
        if ($wish === 'send') {
            $label = ['pending' => 'Gửi đi chờ Hiệu trưởng duyệt', 'scheduled' => 'Hẹn giờ gửi', 'sent' => 'Gửi thông báo'][$status] ?? $status;
            $this->hist($nid, $status === 'sent' ? 'sent' : ($status === 'pending' ? 'submit' : 'schedule'), $me['n'], $label);
        }
        $msg = ['draft' => 'Đã lưu bản nháp.', 'pending' => 'Đã gửi đi và đang chờ Hiệu trưởng duyệt.', 'scheduled' => 'Đã hẹn giờ gửi thông báo.', 'sent' => 'Đã gửi thông báo thành công.'][$status];
        return response()->json(['data' => $this->fmt($this->find($nid), true), 'message' => $msg], $id === null ? 201 : 200);
    }

    public function store(Request $r) { return $this->write($r, null); }
    public function update(Request $r, int $id) { return $this->write($r, $id); }

    // ---------- Thao tác trạng thái ----------
    public function act(Request $r, int $id)
    {
        $me = $this->me($r);
        $row = $this->find($id);
        if (!$row) return $this->fail('Không tìm thấy thông báo.', 404);
        $n = (array) $row; $d = $this->db(); $now = $this->now();
        $a = (string) $r->input('action', '');
        $note = trim((string) $r->input('note', ''));
        $owner = $n['created_by'] === $me['u'] || $this->canApprove($me);
        $set = fn (string $st, array $more = []) => $d->update('UPDATE sm_nt_notices SET status = ?, updated_at = ?' . ($more ? ', ' . implode(', ', array_map(fn ($k) => "$k = ?", array_keys($more))) : '') . ' WHERE id = ?', array_merge([$st, $now], array_values($more), [$id]));

        switch ($a) {
            case 'send_now':
                if (!in_array($n['status'], ['draft', 'rejected', 'scheduled'], true)) return $this->fail('Thông báo này không ở trạng thái có thể gửi.', 409);
                if (!$owner) return $this->fail('Bạn không có quyền gửi thông báo này.', 403);
                if (!($n['to_teachers'] || $n['to_students'] || $n['to_parents'] || $n['to_staff'])) return $this->fail('Chưa chọn người nhận.', 422);
                if (mb_strlen(trim($n['body'])) < 5) return $this->fail('Nội dung quá ngắn.', 422);
                $n2 = $n; $n2['scheduled_at'] = null; // gửi ngay
                [$st, $ext] = $this->sendState($me, $n2);
                $set($st, array_merge(['scheduled_at' => null, 'review_note' => null], $ext));
                $this->hist($id, $st === 'sent' ? 'sent' : 'submit', $me['n'], $st === 'sent' ? 'Gửi ngay' : 'Gửi đi chờ duyệt');
                $msg = $st === 'sent' ? 'Đã gửi thông báo.' : 'Đã gửi đi và đang chờ Hiệu trưởng duyệt.';
                break;
            case 'approve':
                if (!$this->canApprove($me)) return $this->fail('Chỉ Hiệu trưởng mới được duyệt.', 403);
                if ($n['status'] !== 'pending') return $this->fail('Thông báo không ở trạng thái chờ duyệt.', 409);
                $sched = $n['scheduled_at'] && $n['scheduled_at'] > $now;
                if ($sched) { $set('scheduled', ['approved_by' => $me['n'], 'approved_at' => $now, 'review_note' => $note ?: null]); }
                else { $set('sent', ['approved_by' => $me['n'], 'approved_at' => $now, 'review_note' => $note ?: null, 'sent_at' => $now, 'scheduled_at' => null, 'recipients_total' => $this->audience($n)['total']]); }
                $this->hist($id, 'approve', $me['n'], $note ?: ($sched ? 'Duyệt, hẹn giờ gửi' : 'Duyệt và gửi'));
                $msg = $sched ? 'Đã duyệt, thông báo sẽ gửi đúng giờ hẹn.' : 'Đã duyệt và gửi thông báo.';
                break;
            case 'reject':
                if (!$this->canApprove($me)) return $this->fail('Chỉ Hiệu trưởng mới được từ chối.', 403);
                if ($n['status'] !== 'pending') return $this->fail('Thông báo không ở trạng thái chờ duyệt.', 409);
                if (mb_strlen($note) < 3) return $this->fail('Hãy nhập lý do từ chối để người soạn chỉnh sửa.', 422);
                $set('rejected', ['review_note' => mb_substr($note, 0, 300), 'approved_by' => $me['n'], 'approved_at' => $now]);
                $this->hist($id, 'reject', $me['n'], $note);
                $msg = 'Đã từ chối và trả lại cho người soạn.';
                break;
            case 'unschedule':
                if ($n['status'] !== 'scheduled') return $this->fail('Thông báo không ở trạng thái hẹn giờ.', 409);
                if (!$owner) return $this->fail('Bạn không có quyền.', 403);
                $set('draft', ['scheduled_at' => null]);
                $this->hist($id, 'unschedule', $me['n'], 'Hủy hẹn giờ, đưa về bản nháp');
                $msg = 'Đã hủy hẹn giờ, thông báo trở về bản nháp.';
                break;
            case 'archive':
                if ($n['status'] !== 'sent') return $this->fail('Chỉ thu hồi được thông báo đã gửi.', 409);
                if (!$owner) return $this->fail('Bạn không có quyền.', 403);
                $set('archived', ['pinned' => 0]);
                $this->hist($id, 'archive', $me['n'], $note ?: 'Thu hồi / lưu trữ (ẩn khỏi các cổng)');
                $msg = 'Đã thu hồi, thông báo không còn hiện ở các cổng.';
                break;
            case 'restore':
                if ($n['status'] !== 'archived') return $this->fail('Thông báo chưa được lưu trữ.', 409);
                if (!$owner) return $this->fail('Bạn không có quyền.', 403);
                $set('sent');
                $this->hist($id, 'restore', $me['n'], 'Khôi phục hiển thị');
                $msg = 'Đã khôi phục thông báo.';
                break;
            case 'pin':
            case 'unpin':
                if (!in_array($n['status'], ['sent', 'scheduled', 'draft'], true)) return $this->fail('Không thể ghim thông báo ở trạng thái này.', 409);
                $d->update('UPDATE sm_nt_notices SET pinned = ?, updated_at = ? WHERE id = ?', [$a === 'pin' ? 1 : 0, $now, $id]);
                $this->hist($id, $a, $me['n'], null);
                $msg = $a === 'pin' ? 'Đã ghim lên đầu.' : 'Đã bỏ ghim.';
                break;
            case 'remind':
                if ($n['status'] !== 'sent') return $this->fail('Chỉ nhắc lại được thông báo đã gửi.', 409);
                $d->update('UPDATE sm_nt_notices SET last_reminded_at = ?, updated_at = ? WHERE id = ?', [$now, $now, $id]);
                $this->hist($id, 'remind', $me['n'], $note ?: 'Nhắc lại những người chưa đọc');
                $msg = 'Đã nhắc lại. Thông báo được đẩy lên đầu danh sách của những người chưa đọc.';
                break;
            case 'duplicate':
                $code = $this->nextCode();
                $d->insert('INSERT INTO sm_nt_notices (code, title, body, category, priority, status, to_teachers, to_students, to_parents, to_staff, grades, class_ids, pinned, require_ack, links, expires_at, recipients_total, created_by, created_by_name, created_at, updated_at)
                            VALUES (?,?,?,?,?,\'draft\',?,?,?,?,?,?,0,?,?,NULL,0,?,?,?,?)',
                    [$code, mb_substr('Bản sao – ' . $n['title'], 0, 150), $n['body'], $n['category'], $n['priority'], $n['to_teachers'], $n['to_students'], $n['to_parents'], $n['to_staff'], $n['grades'], $n['class_ids'], $n['require_ack'], $n['links'], $me['u'], $me['n'], $now, $now]);
                $nid = (int) $d->getPdo()->lastInsertId();
                $this->hist($nid, 'create', $me['n'], 'Nhân bản từ ' . $n['code']);
                return response()->json(['data' => $this->fmt($this->find($nid), true), 'message' => 'Đã nhân bản thành bản nháp mới.'], 201);
            default:
                return $this->fail('Thao tác không hợp lệ.', 422);
        }
        return response()->json(['data' => $this->fmt($this->find($id), true), 'message' => $msg]);
    }

    public function destroy(Request $r, int $id)
    {
        $me = $this->me($r);
        $row = $this->find($id);
        if (!$row) return $this->fail('Không tìm thấy thông báo.', 404);
        if (!in_array($row->status, ['draft', 'rejected', 'archived'], true)) return $this->fail('Chỉ xóa được bản nháp, thông báo bị từ chối hoặc đã lưu trữ. Với thông báo đã gửi hãy thu hồi trước.', 409);
        if ($row->created_by !== $me['u'] && !$this->canApprove($me)) return $this->fail('Bạn chỉ xóa được thông báo do mình soạn.', 403);
        $d = $this->db();
        $d->delete('DELETE FROM sm_nt_reads WHERE notice_id = ?', [$id]);
        $d->delete('DELETE FROM sm_nt_history WHERE notice_id = ?', [$id]);
        $d->delete('DELETE FROM sm_nt_notices WHERE id = ?', [$id]);
        return response()->json(['message' => 'Đã xóa thông báo ' . $row->code . '.']);
    }

    // ---------- Thống kê ----------
    public function stats(Request $r)
    {
        $days = max(7, min(365, (int) $r->query('days', 30)));
        $since = now()->subDays($days)->format('Y-m-d H:i:s');
        $d = $this->db(); $off = self::VN_OFFSET;

        $top = array_map(fn ($x) => $this->fmt($x), $d->select('SELECT ' . self::SELECT . " FROM sm_nt_notices n WHERE n.status IN ('sent','archived') AND n.sent_at >= ? ORDER BY reads_count DESC, n.sent_at DESC LIMIT 8", [$since]));
        $low = array_map(fn ($x) => $this->fmt($x), $d->select('SELECT ' . self::SELECT . " FROM sm_nt_notices n WHERE n.status = 'sent' AND n.sent_at >= ? AND n.recipients_total > 0 ORDER BY (SELECT COUNT(*) FROM sm_nt_reads r WHERE r.notice_id = n.id) / n.recipients_total ASC LIMIT 6", [$since]));

        $cats = [];
        foreach ($d->select("SELECT n.category, COUNT(*) c, COALESCE(SUM(n.recipients_total),0) rcp, COALESCE(SUM((SELECT COUNT(*) FROM sm_nt_reads r WHERE r.notice_id = n.id)),0) rd
                             FROM sm_nt_notices n WHERE n.status IN ('sent','archived') AND n.sent_at >= ? GROUP BY n.category ORDER BY c DESC", [$since]) as $x)
            $cats[] = ['key' => $x->category, 'label' => self::CATS[$x->category] ?? $x->category, 'n' => (int) $x->c, 'recipients' => (int) $x->rcp, 'reads' => (int) $x->rd, 'rate' => ((int) $x->rcp) > 0 ? round(min(100, ((int) $x->rd) / ((int) $x->rcp) * 100), 1) : 0];

        $byType = [];
        foreach ($d->select("SELECT r.user_type t, COUNT(*) c FROM sm_nt_reads r JOIN sm_nt_notices n ON n.id = r.notice_id WHERE n.sent_at >= ? GROUP BY r.user_type", [$since]) as $x) $byType[$x->t] = (int) $x->c;

        $hours = array_fill(0, 24, 0);
        foreach ($d->select("SELECT HOUR(DATE_ADD(read_at, INTERVAL $off HOUR)) h, COUNT(*) c FROM sm_nt_reads WHERE read_at >= ? GROUP BY h", [$since]) as $x) $hours[(int) $x->h] = (int) $x->c;

        $speed = $d->selectOne("SELECT AVG(TIMESTAMPDIFF(MINUTE, n.sent_at, r.read_at)) m FROM sm_nt_reads r JOIN sm_nt_notices n ON n.id = r.notice_id WHERE n.sent_at >= ? AND r.read_at >= n.sent_at", [$since]);
        $senders = array_map(fn ($x) => ['name' => $x->created_by_name, 'n' => (int) $x->c], $d->select("SELECT created_by_name, COUNT(*) c FROM sm_nt_notices WHERE status IN ('sent','archived') AND sent_at >= ? GROUP BY created_by_name ORDER BY c DESC LIMIT 6", [$since]));
        $ack = $d->selectOne("SELECT COUNT(*) need, COALESCE(SUM((SELECT COUNT(*) FROM sm_nt_reads r WHERE r.notice_id = n.id AND r.ack_at IS NOT NULL)),0) done FROM sm_nt_notices n WHERE n.status IN ('sent','archived') AND n.require_ack = 1 AND n.sent_at >= ?", [$since]);

        return response()->json(['data' => [
            'days' => $days, 'top' => $top, 'low' => $low, 'categories' => $cats, 'by_type' => $byType, 'hours' => $hours,
            'avg_read_minutes' => $speed && $speed->m !== null ? (int) round((float) $speed->m) : null, 'senders' => $senders,
            'ack_notices' => (int) $ack->need, 'ack_total' => (int) $ack->done,
        ]]);
    }

    // ---------- Mẫu thông báo ----------
    public function templates()
    {
        $rows = $this->db()->select('SELECT * FROM sm_nt_templates ORDER BY uses DESC, name');
        return response()->json(['data' => array_map(fn ($x) => (array) $x + ['category_label' => self::CATS[$x->category] ?? $x->category], $rows)]);
    }

    private function tplData(Request $r): array
    {
        $err = [];
        $name = trim((string) $r->input('name', '')); $title = trim((string) $r->input('title', '')); $body = trim((string) $r->input('body', ''));
        if (mb_strlen($name) < 2 || mb_strlen($name) > 80) $err['name'] = 'Tên mẫu từ 2 đến 80 ký tự.';
        if (mb_strlen($title) < 3 || mb_strlen($title) > 150) $err['title'] = 'Tiêu đề từ 3 đến 150 ký tự.';
        if (mb_strlen($body) < 5 || mb_strlen($body) > 8000) $err['body'] = 'Nội dung từ 5 đến 8000 ký tự.';
        $cat = (string) $r->input('category', 'general'); if (!isset(self::CATS[$cat])) $cat = 'general';
        $pri = (string) $r->input('priority', 'normal'); if (!in_array($pri, self::PRIORITIES, true)) $pri = 'normal';
        return [[$name, $cat, $pri, $title, $body], $err];
    }

    public function templateStore(Request $r)
    {
        $me = $this->me($r); [$v, $err] = $this->tplData($r);
        if ($err) return $this->fail('Vui lòng kiểm tra lại thông tin.', 422, $err);
        if ($this->db()->selectOne('SELECT id FROM sm_nt_templates WHERE name = ?', [$v[0]])) return $this->fail('Tên mẫu đã tồn tại.', 422, ['name' => 'Tên mẫu đã tồn tại.']);
        $this->db()->insert('INSERT INTO sm_nt_templates (name, category, priority, title, body, created_by_name, created_at) VALUES (?,?,?,?,?,?,?)', [...$v, $me['n'], $this->now()]);
        return response()->json(['message' => 'Đã tạo mẫu.'], 201);
    }

    public function templateUpdate(Request $r, int $id)
    {
        [$v, $err] = $this->tplData($r);
        if ($err) return $this->fail('Vui lòng kiểm tra lại thông tin.', 422, $err);
        if ($this->db()->selectOne('SELECT id FROM sm_nt_templates WHERE name = ? AND id <> ?', [$v[0], $id])) return $this->fail('Tên mẫu đã tồn tại.', 422, ['name' => 'Tên mẫu đã tồn tại.']);
        $this->db()->update('UPDATE sm_nt_templates SET name=?, category=?, priority=?, title=?, body=? WHERE id=?', [...$v, $id]);
        return response()->json(['message' => 'Đã cập nhật mẫu.']);
    }

    public function templateDelete(int $id)
    {
        $this->db()->delete('DELETE FROM sm_nt_templates WHERE id = ?', [$id]);
        return response()->json(['message' => 'Đã xóa mẫu.']);
    }

    public function templateUse(int $id)
    {
        $this->db()->update('UPDATE sm_nt_templates SET uses = uses + 1 WHERE id = ?', [$id]);
        return response()->json(['message' => 'ok']);
    }

    // =====================================================================
    //  CÔNG KHAI: các cổng Giáo viên / Học sinh / Phụ huynh / Nhân viên đọc thông báo
    // =====================================================================

    /** Xác định người dùng: trả [loại, mã, tên, id lớp|null, khối|null, tên lớp|null] hoặc null nếu mã không tồn tại */
    private function resolveUser(string $type, string $key, string $classHint = ''): ?array
    {
        $d = $this->db(); $key = mb_substr(trim($key), 0, 40);
        if (!in_array($type, self::TYPES, true)) return null;
        if ($type === 'teacher') { $t = $d->selectOne('SELECT code, full_name FROM sm_teachers WHERE code = ?', [$key]); return $t ? ['teacher', $t->code, $t->full_name, null, null, null] : null; }
        if ($type === 'staff') { $t = $d->selectOne('SELECT username, full_name FROM sm_staff_accounts WHERE username = ?', [$key]); return $t ? ['staff', $t->username, $t->full_name, null, null, null] : null; }
        $s = $d->selectOne('SELECT s.code, s.full_name, c.id cid, c.grade, c.name cname FROM sm_students s LEFT JOIN sm_enrollments e ON e.student_id = s.id AND e.school_year_id = ? LEFT JOIN sm_classes c ON c.id = e.class_id WHERE s.code = ?', [$this->yearId(), $key]);
        return $s ? [$type, $s->code, $s->full_name, $s->cid ? (int) $s->cid : null, $s->grade ? (int) $s->grade : null, $s->cname] : null;
    }

    public function feed(Request $r)
    {
        $this->dispatchDue();
        $type = (string) $r->query('audience', 'student');
        if (!in_array($type, self::TYPES, true)) return $this->fail('Đối tượng không hợp lệ.', 422);
        $key = trim((string) $r->query('key', ''));
        $u = $key !== '' ? $this->resolveUser($type, $key) : null;
        $flag = ['student' => 'to_students', 'parent' => 'to_parents', 'teacher' => 'to_teachers', 'staff' => 'to_staff'][$type];
        $w = ["n.status = 'sent'", '(n.expires_at IS NULL OR n.expires_at > UTC_TIMESTAMP())', "n.$flag = 1"]; $b = [];
        if ($type === 'student' || $type === 'parent') {
            $cid = $u[3] ?? null; $gr = $u[4] ?? null;
            $cond = "(n.grades = '' AND n.class_ids = '')";
            if ($gr) { $cond .= ' OR FIND_IN_SET(?, n.grades)'; $b[] = $gr; }
            if ($cid) { $cond .= ' OR FIND_IN_SET(?, n.class_ids)'; $b[] = $cid; }
            $w[] = "($cond)";
        }
        $readSql = $u ? '(SELECT r.read_at FROM sm_nt_reads r WHERE r.notice_id = n.id AND r.user_type = ? AND r.user_key = ?)' : 'NULL';
        $args = $u ? [$type, $u[1]] : [];
        $rows = $this->db()->select("SELECT n.id, n.code, n.title, n.body, n.category, n.priority, n.pinned, n.require_ack, n.links, n.sent_at, n.expires_at, n.last_reminded_at, $readSql AS read_at,
                    " . ($u ? '(SELECT r.ack_at FROM sm_nt_reads r WHERE r.notice_id = n.id AND r.user_type = ? AND r.user_key = ?)' : 'NULL') . " AS ack_at
                    FROM sm_nt_notices n WHERE " . implode(' AND ', $w) . "
                    ORDER BY n.pinned DESC, FIELD(n.priority,'urgent','high','normal'), COALESCE(n.last_reminded_at, n.sent_at) DESC LIMIT 40", array_merge($args, $args, $b));
        $items = array_map(function ($x) {
            $x = (array) $x;
            $links = !empty($x['links']) ? (json_decode((string) $x['links'], true) ?: []) : [];
            return ['id' => (int) $x['id'], 'code' => $x['code'], 'title' => $x['title'], 'body' => $x['body'], 'category' => $x['category'], 'category_label' => self::CATS[$x['category']] ?? $x['category'],
                    'priority' => $x['priority'], 'pinned' => (int) $x['pinned'], 'require_ack' => (int) $x['require_ack'], 'links' => $links, 'sent_at' => $x['sent_at'],
                    'reminded' => $x['last_reminded_at'] !== null, 'read' => $x['read_at'] !== null, 'acked' => $x['ack_at'] !== null];
        }, $rows);
        return response()->json(['data' => $items, 'unread' => count(array_filter($items, fn ($i) => !$i['read'])), 'identified' => (bool) $u]);
    }

    public function markRead(Request $r, int $id)
    {
        $n = $this->db()->selectOne("SELECT id, require_ack FROM sm_nt_notices WHERE id = ? AND status = 'sent'", [$id]);
        if (!$n) return $this->fail('Thông báo không tồn tại hoặc đã thu hồi.', 404);
        $type = (string) $r->input('audience', 'student');
        $u = $this->resolveUser($type, (string) $r->input('key', ''));
        if (!$u) return $this->fail('Không xác định được người dùng.', 422);
        $now = $this->now(); $ack = $r->boolean('ack') && $n->require_ack ? $now : null;
        $this->db()->statement('INSERT INTO sm_nt_reads (notice_id, user_type, user_key, user_name, class_name, read_at, ack_at) VALUES (?,?,?,?,?,?,?)
                                ON DUPLICATE KEY UPDATE ack_at = COALESCE(sm_nt_reads.ack_at, VALUES(ack_at))', [$id, $u[0], $u[1], mb_substr($u[2], 0, 80), $u[5], $now, $ack]);
        return response()->json(['message' => 'ok']);
    }
}
