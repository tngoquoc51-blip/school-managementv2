<?php

namespace Modules\Evaluations\Repositories;

use Illuminate\Support\Facades\DB;
use Modules\Evaluations\Services\ScoringService;

/**
 * Truy vấn dữ liệu module Dự giờ & Đánh giá. Dùng SQL có tham số (an toàn SQL-injection).
 * Mọi hàm trả về mảng thuần (array) để dễ kiểm thử.
 */
class EvalRepository
{
    /** Phiếu đã nộp trở lên (không tính bản nháp). */
    public const VALID = "('submitted','acknowledged','disputed','closed')";

    /* ------------------------------------------------------------ tiện ích */

    public function rows(string $sql, array $b = []): array
    {
        return array_map(fn ($r) => (array) $r, DB::select($sql, $b));
    }

    public function one(string $sql, array $b = []): ?array
    {
        $r = DB::selectOne($sql, $b);
        return $r ? (array) $r : null;
    }

    public function value(string $sql, array $b = [], $default = null)
    {
        $r = $this->one($sql, $b);
        return $r ? array_values($r)[0] : $default;
    }

    public function insertId(string $sql, array $b = []): int
    {
        DB::insert($sql, $b);
        return (int) DB::getPdo()->lastInsertId();
    }

    private function in(array $ids): string
    {
        return implode(',', array_fill(0, max(1, count($ids)), '?'));
    }

    public function now(): string { return date('Y-m-d H:i:s'); }
    public function today(): string { return date('Y-m-d'); }

    /* --------------------------------------------------------- cấu hình & năm học */

    public function settings(): array
    {
        $out = ScoringService::DEFAULTS;
        foreach ($this->rows('SELECT k, v FROM sm_ev_settings') as $r) {
            $out[$r['k']] = $r['v'];
        }
        return $out;
    }

    public function setSetting(string $k, ?string $v, string $by): void
    {
        $exists = $this->value('SELECT COUNT(*) FROM sm_ev_settings WHERE k = ?', [$k], 0);
        if ($exists) {
            DB::update('UPDATE sm_ev_settings SET v = ?, updated_by = ?, updated_at = ? WHERE k = ?', [$v, $by, $this->now(), $k]);
        } else {
            DB::insert('INSERT INTO sm_ev_settings (k, v, updated_by, updated_at) VALUES (?,?,?,?)', [$k, $v, $by, $this->now()]);
        }
    }

    public function years(): array
    {
        return $this->rows('SELECT id, label, is_current FROM sm_school_years ORDER BY id DESC');
    }

    public function currentYearId(): int
    {
        return (int) ($this->value('SELECT id FROM sm_school_years WHERE is_current = 1 ORDER BY id DESC LIMIT 1')
            ?: $this->value('SELECT id FROM sm_school_years ORDER BY id DESC LIMIT 1', [], 0));
    }

    /** semester: 1, 2 hoặc 3 (cả năm). Trả về [điều kiện SQL, tham số] áp lên bảng có cột school_year_id + semester. */
    public function scope(string $alias, int $year, int $semester): array
    {
        $sql = "{$alias}.school_year_id = ?"; $b = [$year];
        if (in_array($semester, [1, 2], true)) {
            $sql .= " AND {$alias}.semester = ?"; $b[] = $semester;
        }
        return [$sql, $b];
    }

    /* ------------------------------------------------------------- danh mục tra cứu */

    public function lookups(): array
    {
        $y = $this->currentYearId();
        return [
            'year' => $this->one('SELECT id, label FROM sm_school_years WHERE id = ?', [$y]),
            'years' => $this->years(),
            'teachers' => $this->rows('SELECT t.id, t.code, t.full_name, t.gender, t.main_subject_id, s.name AS subject_name
                FROM sm_teachers t LEFT JOIN sm_subjects s ON s.id = t.main_subject_id ORDER BY t.full_name'),
            'subjects' => $this->rows('SELECT id, code, name FROM sm_subjects ORDER BY sort_order, name'),
            'classes' => $this->rows('SELECT id, grade, name FROM sm_classes WHERE school_year_id = ? ORDER BY grade, name', [$y]),
            'assignments' => $this->rows('SELECT cs.class_id, cs.subject_id, cs.teacher_id FROM sm_class_subjects cs
                JOIN sm_classes c ON c.id = cs.class_id WHERE c.school_year_id = ?', [$y]),
            'periods' => $this->rows('SELECT id, start_time, end_time FROM sm_periods ORDER BY id'),
            'rubrics' => $this->rows('SELECT r.id, r.code, r.name, r.is_active,
                (SELECT COUNT(*) FROM sm_ev_criteria c WHERE c.rubric_id = r.id) AS criteria_count
                FROM sm_ev_rubrics r WHERE r.is_active = 1 ORDER BY r.id'),
        ];
    }

    /** Gợi ý tiết dạy của GV vào một ngày (liên kết Thời khoá biểu). */
    public function slots(int $teacherId, string $date): array
    {
        $iso = (int) date('N', strtotime($date));       // 1 = Thứ hai … 7 = Chủ nhật
        if ($iso > 6) return [];
        return $this->rows('SELECT tt.period, tt.class_id, c.name AS class_name, cs.subject_id, s.name AS subject_name
            FROM sm_timetable tt
            JOIN sm_class_subjects cs ON cs.id = tt.class_subject_id AND cs.teacher_id = ?
            JOIN sm_classes c ON c.id = tt.class_id AND c.school_year_id = ?
            JOIN sm_subjects s ON s.id = cs.subject_id
            WHERE tt.weekday = ? ORDER BY tt.period', [$teacherId, $this->currentYearId(), $iso + 1]);
    }

    public function teacherExists(int $id): bool
    {
        return (bool) $this->value('SELECT COUNT(*) FROM sm_teachers WHERE id = ?', [$id], 0);
    }

    /* ------------------------------------------------------------------ tổng quan */

    public function overview(int $year, int $semester): array
    {
        $s = $this->settings();
        $today = $this->today();
        [$sc, $sb] = $this->scope('o', $year, $semester);
        [$pc, $pb] = $this->scope('p', $year, $semester);
        $valid = self::VALID;

        $plans = [];
        foreach ($this->rows("SELECT p.status, COUNT(*) AS c FROM sm_ev_plans p WHERE $pc GROUP BY p.status", $pb) as $r) {
            $plans[$r['status']] = (int) $r['c'];
        }

        $obs = $this->one("SELECT COUNT(*) AS total, ROUND(AVG(o.total_score), 1) AS avg_score,
                SUM(o.status = 'submitted') AS pending_ack, SUM(o.status = 'disputed') AS disputed
            FROM sm_ev_observations o WHERE $sc AND o.status IN $valid", $sb);
        $drafts = (int) $this->value("SELECT COUNT(*) FROM sm_ev_observations o WHERE $sc AND o.status = 'draft'", $sb, 0);

        $teachersTotal = (int) $this->value('SELECT COUNT(*) FROM sm_teachers', [], 0);
        $covered = (int) $this->value("SELECT COUNT(DISTINCT o.teacher_id) FROM sm_ev_observations o WHERE $sc AND o.status IN $valid", $sb, 0);
        $min = max(1, (int) $s['min_obs_per_semester']) * ($semester === 3 ? 2 : 1);
        $below = (int) $this->value("SELECT COUNT(*) FROM sm_teachers t WHERE
            (SELECT COUNT(*) FROM sm_ev_observations o WHERE o.teacher_id = t.id AND $sc AND o.status IN $valid) < ?", array_merge($sb, [$min]), 0);

        $ratings = ['excellent' => 0, 'good' => 0, 'pass' => 0, 'fail' => 0];
        foreach ($this->rows("SELECT o.rating, COUNT(*) AS c FROM sm_ev_observations o WHERE $sc AND o.status IN $valid AND o.rating IS NOT NULL GROUP BY o.rating", $sb) as $r) {
            $ratings[$r['rating']] = (int) $r['c'];
        }

        $monthly = $this->rows("SELECT DATE_FORMAT(o.observed_on, '%Y-%m') AS m, COUNT(*) AS c, ROUND(AVG(o.total_score), 1) AS a
            FROM sm_ev_observations o WHERE $sc AND o.status IN $valid GROUP BY DATE_FORMAT(o.observed_on, '%Y-%m') ORDER BY m", $sb);

        $bySubject = $this->rows("SELECT s.id, s.name, COUNT(*) AS c, ROUND(AVG(o.total_score), 1) AS a
            FROM sm_ev_observations o JOIN sm_teachers t ON t.id = o.teacher_id LEFT JOIN sm_subjects s ON s.id = t.main_subject_id
            WHERE $sc AND o.status IN $valid GROUP BY s.id, s.name ORDER BY a DESC", $sb);

        $teacherAgg = "SELECT t.id, t.code, t.full_name, s.name AS subject_name, COUNT(*) AS c, ROUND(AVG(o.total_score), 1) AS a
            FROM sm_ev_observations o JOIN sm_teachers t ON t.id = o.teacher_id LEFT JOIN sm_subjects s ON s.id = t.main_subject_id
            WHERE $sc AND o.status IN $valid GROUP BY t.id, t.code, t.full_name, s.name";
        $top = $this->rows($teacherAgg . ' ORDER BY a DESC, c DESC LIMIT 5', $sb);
        $bottom = $this->rows($teacherAgg . ' ORDER BY a ASC, c DESC LIMIT 5', $sb);

        $planSelect = "SELECT p.id, p.plan_date, p.period, p.kind, p.topic, p.observer_name, p.status,
                t.id AS teacher_id, t.full_name AS teacher_name, s.name AS subject_name, c.name AS class_name
            FROM sm_ev_plans p JOIN sm_teachers t ON t.id = p.teacher_id
            LEFT JOIN sm_subjects s ON s.id = p.subject_id LEFT JOIN sm_classes c ON c.id = p.class_id";
        $upcoming = $this->rows($planSelect . " WHERE p.status = 'scheduled' AND p.plan_date >= ? ORDER BY p.plan_date, p.period LIMIT 8", [$today]);
        $overdue = $this->rows($planSelect . " WHERE p.status = 'scheduled' AND p.plan_date < ? ORDER BY p.plan_date LIMIT 8", [$today]);
        $overdueCount = (int) $this->value("SELECT COUNT(*) FROM sm_ev_plans WHERE status = 'scheduled' AND plan_date < ?", [$today], 0);
        $upcoming7 = (int) $this->value("SELECT COUNT(*) FROM sm_ev_plans WHERE status = 'scheduled' AND plan_date BETWEEN ? AND ?",
            [$today, date('Y-m-d', strtotime('+7 days'))], 0);

        $followUp = $this->rows("SELECT o.id, o.code, o.observed_on, o.total_score, o.rating, t.full_name AS teacher_name, s.name AS subject_name
            FROM sm_ev_observations o JOIN sm_teachers t ON t.id = o.teacher_id LEFT JOIN sm_subjects s ON s.id = COALESCE(o.subject_id, t.main_subject_id)
            WHERE $sc AND o.status IN $valid AND o.rating IN ('fail', 'pass')
              AND NOT EXISTS (SELECT 1 FROM sm_ev_actions a WHERE a.observation_id = o.id)
            ORDER BY o.total_score ASC LIMIT 8", $sb);

        $actions = ['open' => 0, 'in_progress' => 0, 'done' => 0];
        foreach ($this->rows('SELECT status, COUNT(*) AS c FROM sm_ev_actions GROUP BY status') as $r) {
            $actions[$r['status']] = (int) $r['c'];
        }
        $actionsOverdue = (int) $this->value("SELECT COUNT(*) FROM sm_ev_actions WHERE status IN ('open','in_progress') AND due_date < ?", [$today], 0);

        return [
            'kpi' => [
                'plans_total' => array_sum($plans), 'plans_done' => $plans['done'] ?? 0, 'plans_scheduled' => $plans['scheduled'] ?? 0,
                'plans_cancelled' => $plans['cancelled'] ?? 0, 'plans_overdue' => $overdueCount, 'plans_next7' => $upcoming7,
                'obs_total' => (int) ($obs['total'] ?? 0), 'obs_avg' => $obs['avg_score'] !== null ? (float) $obs['avg_score'] : null,
                'obs_drafts' => $drafts, 'obs_pending_ack' => (int) ($obs['pending_ack'] ?? 0), 'obs_disputed' => (int) ($obs['disputed'] ?? 0),
                'teachers_total' => $teachersTotal, 'teachers_covered' => $covered, 'teachers_below_min' => $below, 'min_required' => $min,
                'actions_open' => ($actions['open'] ?? 0) + ($actions['in_progress'] ?? 0), 'actions_overdue' => $actionsOverdue,
            ],
            'ratings' => $ratings, 'monthly' => $monthly, 'by_subject' => $bySubject, 'top' => $top, 'bottom' => $bottom,
            'upcoming' => $upcoming, 'overdue' => $overdue, 'follow_up' => $followUp,
        ];
    }

    /* ------------------------------------------------------------------- lịch dự giờ */

    private function planBase(): string
    {
        return "SELECT p.*, t.code AS teacher_code, t.full_name AS teacher_name, s.name AS subject_name, c.name AS class_name,
                r.name AS rubric_name,
                (SELECT o.id FROM sm_ev_observations o WHERE o.plan_id = p.id ORDER BY o.id DESC LIMIT 1) AS observation_id,
                (SELECT o.status FROM sm_ev_observations o WHERE o.plan_id = p.id ORDER BY o.id DESC LIMIT 1) AS observation_status
            FROM sm_ev_plans p JOIN sm_teachers t ON t.id = p.teacher_id
            LEFT JOIN sm_subjects s ON s.id = p.subject_id LEFT JOIN sm_classes c ON c.id = p.class_id
            LEFT JOIN sm_ev_rubrics r ON r.id = p.rubric_id";
    }

    private function planFilters(array $f): array
    {
        $w = ['1 = 1']; $b = [];
        if (! empty($f['year'])) { $w[] = 'p.school_year_id = ?'; $b[] = (int) $f['year']; }
        if (! empty($f['semester']) && in_array((int) $f['semester'], [1, 2], true)) { $w[] = 'p.semester = ?'; $b[] = (int) $f['semester']; }
        if (! empty($f['teacher_id'])) { $w[] = 'p.teacher_id = ?'; $b[] = (int) $f['teacher_id']; }
        if (! empty($f['kind'])) { $w[] = 'p.kind = ?'; $b[] = $f['kind']; }
        if (! empty($f['from'])) { $w[] = 'p.plan_date >= ?'; $b[] = $f['from']; }
        if (! empty($f['to'])) { $w[] = 'p.plan_date <= ?'; $b[] = $f['to']; }
        if (! empty($f['q'])) {
            $w[] = '(t.full_name LIKE ? OR t.code LIKE ? OR p.topic LIKE ? OR p.observer_name LIKE ?)';
            $like = '%' . $f['q'] . '%'; array_push($b, $like, $like, $like, $like);
        }
        return [$w, $b];
    }

    public function plans(array $f, int $page, int $per): array
    {
        [$w, $b] = $this->planFilters($f);
        $counts = ['all' => 0, 'scheduled' => 0, 'done' => 0, 'cancelled' => 0, 'overdue' => 0];
        foreach ($this->rows('SELECT p.status, COUNT(*) AS c FROM sm_ev_plans p JOIN sm_teachers t ON t.id = p.teacher_id WHERE ' . implode(' AND ', $w) . ' GROUP BY p.status', $b) as $r) {
            $counts[$r['status']] = (int) $r['c']; $counts['all'] += (int) $r['c'];
        }
        $counts['overdue'] = (int) $this->value('SELECT COUNT(*) FROM sm_ev_plans p JOIN sm_teachers t ON t.id = p.teacher_id WHERE '
            . implode(' AND ', $w) . " AND p.status = 'scheduled' AND p.plan_date < ?", array_merge($b, [$this->today()]), 0);

        $status = $f['status'] ?? '';
        if ($status === 'overdue') { $w[] = "p.status = 'scheduled'"; $w[] = 'p.plan_date < ?'; $b[] = $this->today(); }
        elseif ($status !== '' && $status !== 'all') { $w[] = 'p.status = ?'; $b[] = $status; }

        $total = (int) $this->value('SELECT COUNT(*) FROM sm_ev_plans p JOIN sm_teachers t ON t.id = p.teacher_id WHERE ' . implode(' AND ', $w), $b, 0);
        $asc = ($f['order'] ?? '') === 'asc' || $status === 'scheduled';
        $per = max(1, min(200, $per)); $page = max(1, $page);
        $sql = $this->planBase() . ' WHERE ' . implode(' AND ', $w) . ' ORDER BY p.plan_date ' . ($asc ? 'ASC' : 'DESC') . ', p.period ASC, p.id DESC'
            . ' LIMIT ' . $per . ' OFFSET ' . (($page - 1) * $per);
        $items = $this->rows($sql, $b);
        $today = $this->today();
        foreach ($items as &$it) {
            $it['overdue'] = $it['status'] === 'scheduled' && $it['plan_date'] < $today;
        }
        return ['items' => $items, 'total' => $total, 'page' => $page, 'per_page' => $per, 'last_page' => max(1, (int) ceil($total / $per)), 'counts' => $counts];
    }

    public function plan(int $id): ?array
    {
        $r = $this->one($this->planBase() . ' WHERE p.id = ?', [$id]);
        if ($r) $r['overdue'] = $r['status'] === 'scheduled' && $r['plan_date'] < $this->today();
        return $r;
    }

    public function planConflict(int $teacherId, string $date, ?int $period, int $ignoreId = 0): ?array
    {
        if ($period === null) return null;
        return $this->one("SELECT id, observer_name FROM sm_ev_plans WHERE teacher_id = ? AND plan_date = ? AND period = ? AND status = 'scheduled' AND id <> ? LIMIT 1",
            [$teacherId, $date, $period, $ignoreId]);
    }

    public function createPlan(array $d): int
    {
        $n = $this->now();
        return $this->insertId('INSERT INTO sm_ev_plans (school_year_id, semester, teacher_id, class_id, subject_id, plan_date, period, kind, topic,
                rubric_id, observer_id, observer_name, status, note, created_by, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [$d['school_year_id'], $d['semester'], $d['teacher_id'], $d['class_id'], $d['subject_id'], $d['plan_date'], $d['period'], $d['kind'], $d['topic'],
                $d['rubric_id'], $d['observer_id'], $d['observer_name'], 'scheduled', $d['note'], $d['created_by'], $n, $n]);
    }

    public function updatePlan(int $id, array $d): void
    {
        DB::update('UPDATE sm_ev_plans SET teacher_id = ?, class_id = ?, subject_id = ?, plan_date = ?, period = ?, kind = ?, topic = ?, rubric_id = ?,
                observer_name = ?, note = ?, semester = ?, updated_at = ? WHERE id = ?',
            [$d['teacher_id'], $d['class_id'], $d['subject_id'], $d['plan_date'], $d['period'], $d['kind'], $d['topic'], $d['rubric_id'],
                $d['observer_name'], $d['note'], $d['semester'], $this->now(), $id]);
    }

    public function setPlanStatus(int $id, string $status, ?string $reason = null): void
    {
        DB::update('UPDATE sm_ev_plans SET status = ?, cancel_reason = ?, updated_at = ? WHERE id = ?', [$status, $reason, $this->now(), $id]);
    }

    public function postponePlan(int $id, string $date, ?int $period, string $reason): void
    {
        DB::update("UPDATE sm_ev_plans SET plan_date = ?, period = ?, postponed_count = postponed_count + 1, note = ?, updated_at = ? WHERE id = ?",
            [$date, $period, mb_substr('Dời lịch: ' . $reason, 0, 500), $this->now(), $id]);
    }

    public function deletePlan(int $id): void
    {
        DB::delete('DELETE FROM sm_ev_plans WHERE id = ?', [$id]);
    }

    /* ------------------------------------------------------------------ phiếu dự giờ */

    private function obsBase(): string
    {
        return "SELECT o.*, t.code AS teacher_code, t.full_name AS teacher_name, ms.name AS dept_name,
                s.name AS subject_name, c.name AS class_name, r.name AS rubric_name, r.code AS rubric_code
            FROM sm_ev_observations o JOIN sm_teachers t ON t.id = o.teacher_id
            LEFT JOIN sm_subjects ms ON ms.id = t.main_subject_id
            LEFT JOIN sm_subjects s ON s.id = COALESCE(o.subject_id, t.main_subject_id)
            LEFT JOIN sm_classes c ON c.id = o.class_id
            LEFT JOIN sm_ev_rubrics r ON r.id = o.rubric_id";
    }

    private function obsFilters(array $f): array
    {
        $w = ['1 = 1']; $b = [];
        if (! empty($f['year'])) { $w[] = 'o.school_year_id = ?'; $b[] = (int) $f['year']; }
        if (! empty($f['semester']) && in_array((int) $f['semester'], [1, 2], true)) { $w[] = 'o.semester = ?'; $b[] = (int) $f['semester']; }
        if (! empty($f['status'])) { $w[] = 'o.status = ?'; $b[] = $f['status']; }
        if (! empty($f['rating'])) { $w[] = 'o.rating = ?'; $b[] = $f['rating']; }
        if (! empty($f['teacher_id'])) { $w[] = 'o.teacher_id = ?'; $b[] = (int) $f['teacher_id']; }
        if (! empty($f['subject_id'])) { $w[] = 't.main_subject_id = ?'; $b[] = (int) $f['subject_id']; }
        if (! empty($f['kind'])) { $w[] = 'o.kind = ?'; $b[] = $f['kind']; }
        if (! empty($f['from'])) { $w[] = 'o.observed_on >= ?'; $b[] = $f['from']; }
        if (! empty($f['to'])) { $w[] = 'o.observed_on <= ?'; $b[] = $f['to']; }
        if (! empty($f['q'])) {
            $w[] = '(t.full_name LIKE ? OR t.code LIKE ? OR o.code LIKE ? OR o.topic LIKE ? OR o.observer_name LIKE ?)';
            $like = '%' . $f['q'] . '%'; array_push($b, $like, $like, $like, $like, $like);
        }
        return [$w, $b];
    }

    public function observations(array $f, int $page, int $per, bool $all = false): array
    {
        [$w, $b] = $this->obsFilters($f);
        $join = 'FROM sm_ev_observations o JOIN sm_teachers t ON t.id = o.teacher_id WHERE ';

        $counts = ['all' => 0, 'draft' => 0, 'submitted' => 0, 'acknowledged' => 0, 'disputed' => 0, 'closed' => 0];
        $wNoStatus = array_values(array_filter($w, fn ($x) => $x !== 'o.status = ?'));
        $bNoStatus = $b;
        if (! empty($f['status'])) {   // bỏ tham số của điều kiện status khỏi bộ đếm
            $idx = array_search('o.status = ?', $w, true);
            $pos = 0; foreach (array_slice($w, 0, $idx) as $x) { $pos += substr_count($x, '?'); }
            array_splice($bNoStatus, $pos, 1);
        }
        foreach ($this->rows('SELECT o.status, COUNT(*) AS c ' . $join . implode(' AND ', $wNoStatus) . ' GROUP BY o.status', $bNoStatus) as $r) {
            $counts[$r['status']] = (int) $r['c']; $counts['all'] += (int) $r['c'];
        }

        $total = (int) $this->value('SELECT COUNT(*) ' . $join . implode(' AND ', $w), $b, 0);
        $sortMap = ['date' => 'o.observed_on', 'score' => 'o.total_score', 'teacher' => 't.full_name', 'status' => 'o.status'];
        $col = $sortMap[$f['sort'] ?? 'date'] ?? 'o.observed_on';
        $dir = strtolower($f['dir'] ?? 'desc') === 'asc' ? 'ASC' : 'DESC';
        $sql = $this->obsBase() . ' WHERE ' . implode(' AND ', $w) . " ORDER BY $col $dir, o.id DESC";
        if (! $all) {
            $per = max(1, min(200, $per)); $page = max(1, $page);
            $sql .= ' LIMIT ' . $per . ' OFFSET ' . (($page - 1) * $per);
        }
        $items = $this->rows($sql, $b);
        return ['items' => $items, 'total' => $total, 'page' => $page, 'per_page' => $per, 'last_page' => max(1, (int) ceil($total / max(1, $per))), 'counts' => $counts];
    }

    public function observation(int $id): ?array
    {
        return $this->one($this->obsBase() . ' WHERE o.id = ?', [$id]);
    }

    public function criteria(int $rubricId): array
    {
        return $this->rows('SELECT id, rubric_id, group_name, name, description, weight, max_score, sort_order
            FROM sm_ev_criteria WHERE rubric_id = ? ORDER BY sort_order, id', [$rubricId]);
    }

    public function observationScores(int $obsId): array
    {
        $out = [];
        foreach ($this->rows('SELECT criterion_id, score, comment FROM sm_ev_obs_scores WHERE observation_id = ?', [$obsId]) as $r) {
            $out[(int) $r['criterion_id']] = $r;
        }
        return $out;
    }

    public function history(string $entityType, $entityId, int $limit = 30): array
    {
        try {
            return $this->rows('SELECT id, occurred_at, actor_name, action, summary, severity, status FROM sm_audit_logs
                WHERE entity_type = ? AND entity_id = ? ORDER BY id DESC LIMIT ' . (int) $limit, [$entityType, (string) $entityId]);
        } catch (\Throwable $e) {
            return [];
        }
    }

    public function createObservation(array $d): int
    {
        $n = $this->now();
        $id = $this->insertId('INSERT INTO sm_ev_observations (code, plan_id, school_year_id, semester, teacher_id, class_id, subject_id, rubric_id,
                observed_on, period, kind, topic, students_present, duration_min, status, observer_id, observer_name, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            ['TMP' . bin2hex(random_bytes(6)), $d['plan_id'], $d['school_year_id'], $d['semester'], $d['teacher_id'], $d['class_id'], $d['subject_id'], $d['rubric_id'],
                $d['observed_on'], $d['period'], $d['kind'], $d['topic'], $d['students_present'], $d['duration_min'], 'draft', $d['observer_id'], $d['observer_name'], $n, $n]);
        $code = 'DG' . date('y') . str_pad((string) $id, 5, '0', STR_PAD_LEFT);
        DB::update('UPDATE sm_ev_observations SET code = ? WHERE id = ?', [$code, $id]);
        return $id;
    }

    public function updateObservationMeta(int $id, array $d): void
    {
        DB::update('UPDATE sm_ev_observations SET teacher_id = ?, class_id = ?, subject_id = ?, observed_on = ?, period = ?, kind = ?, topic = ?,
                students_present = ?, duration_min = ?, strengths = ?, weaknesses = ?, suggestions = ?, observer_name = ?, semester = ?,
                total_score = ?, rating = ?, updated_at = ? WHERE id = ?',
            [$d['teacher_id'], $d['class_id'], $d['subject_id'], $d['observed_on'], $d['period'], $d['kind'], $d['topic'], $d['students_present'],
                $d['duration_min'], $d['strengths'], $d['weaknesses'], $d['suggestions'], $d['observer_name'], $d['semester'],
                $d['total_score'], $d['rating'], $this->now(), $id]);
    }

    /** Thay toàn bộ điểm tiêu chí của một phiếu (trong một giao dịch). */
    public function replaceScores(int $obsId, array $scores): void
    {
        DB::transaction(function () use ($obsId, $scores) {
            DB::delete('DELETE FROM sm_ev_obs_scores WHERE observation_id = ?', [$obsId]);
            foreach ($scores as $cid => $row) {
                DB::insert('INSERT INTO sm_ev_obs_scores (observation_id, criterion_id, score, comment) VALUES (?,?,?,?)',
                    [$obsId, (int) $cid, (int) $row['score'], $row['comment'] ?? null]);
            }
        });
    }

    public function setObservationStatus(int $id, string $status, array $extra = []): void
    {
        $sets = ['status = ?', 'updated_at = ?']; $b = [$status, $this->now()];
        foreach ($extra as $col => $val) { $sets[] = "$col = ?"; $b[] = $val; }
        $b[] = $id;
        DB::update('UPDATE sm_ev_observations SET ' . implode(', ', $sets) . ' WHERE id = ?', $b);
    }

    public function deleteObservation(int $id): void
    {
        DB::transaction(function () use ($id) {
            DB::delete('DELETE FROM sm_ev_obs_scores WHERE observation_id = ?', [$id]);
            DB::update('UPDATE sm_ev_actions SET observation_id = NULL WHERE observation_id = ?', [$id]);
            DB::delete('DELETE FROM sm_ev_observations WHERE id = ?', [$id]);
        });
    }

    public function markPlanDone(?int $planId): void
    {
        if ($planId) {
            DB::update("UPDATE sm_ev_plans SET status = 'done', updated_at = ? WHERE id = ? AND status = 'scheduled'", [$this->now(), $planId]);
        }
    }

    public function observationForPlan(int $planId): ?array
    {
        return $this->one('SELECT id, code, status FROM sm_ev_observations WHERE plan_id = ? ORDER BY id DESC LIMIT 1', [$planId]);
    }

    /* --------------------------------------------------------------------- giáo viên */

    public function teachers(array $f, int $year, int $semester): array
    {
        $s = $this->settings();
        [$sc, $sb] = $this->scope('o', $year, $semester);
        $valid = self::VALID;
        $today = $this->today();
        $min = max(1, (int) $s['min_obs_per_semester']) * ($semester === 3 ? 2 : 1);

        $w = ['1 = 1']; $b = [];
        if (! empty($f['q'])) { $w[] = '(t.full_name LIKE ? OR t.code LIKE ?)'; $like = '%' . $f['q'] . '%'; array_push($b, $like, $like); }
        if (! empty($f['subject_id'])) { $w[] = 't.main_subject_id = ?'; $b[] = (int) $f['subject_id']; }

        $sql = "SELECT * FROM (
            SELECT t.id, t.code, t.full_name, t.gender, t.main_subject_id, s.name AS subject_name,
              (SELECT COUNT(*) FROM sm_ev_observations o WHERE o.teacher_id = t.id AND $sc AND o.status IN $valid) AS obs_count,
              (SELECT ROUND(AVG(o.total_score), 1) FROM sm_ev_observations o WHERE o.teacher_id = t.id AND $sc AND o.status IN $valid) AS obs_avg,
              (SELECT o.rating FROM sm_ev_observations o WHERE o.teacher_id = t.id AND o.status IN $valid ORDER BY o.observed_on DESC, o.id DESC LIMIT 1) AS last_rating,
              (SELECT o.observed_on FROM sm_ev_observations o WHERE o.teacher_id = t.id AND o.status IN $valid ORDER BY o.observed_on DESC, o.id DESC LIMIT 1) AS last_date,
              (SELECT COUNT(*) FROM sm_ev_plans p WHERE p.teacher_id = t.id AND p.status = 'scheduled' AND p.plan_date >= ?) AS upcoming,
              (SELECT COUNT(*) FROM sm_ev_actions a WHERE a.teacher_id = t.id AND a.status IN ('open','in_progress')) AS open_actions
            FROM sm_teachers t LEFT JOIN sm_subjects s ON s.id = t.main_subject_id
            WHERE " . implode(' AND ', $w) . ') x';
        $bind = array_merge($sb, $sb, [$today], $b);

        $cov = $f['coverage'] ?? '';
        $outer = [];
        if ($cov === 'none') $outer[] = 'obs_count = 0';
        elseif ($cov === 'below') { $outer[] = 'obs_count < ?'; $bind[] = $min; }
        elseif ($cov === 'ok') { $outer[] = 'obs_count >= ?'; $bind[] = $min; }
        if (! empty($f['rating'])) { $outer[] = 'last_rating = ?'; $bind[] = $f['rating']; }
        if ($outer) $sql .= ' WHERE ' . implode(' AND ', $outer);
        $sortMap = ['name' => 'full_name', 'avg' => 'obs_avg', 'count' => 'obs_count', 'last' => 'last_date'];
        $col = $sortMap[$f['sort'] ?? 'name'] ?? 'full_name';
        $dir = strtolower($f['dir'] ?? 'asc') === 'desc' ? 'DESC' : 'ASC';
        $sql .= " ORDER BY ($col IS NULL), $col $dir, full_name ASC";

        $items = $this->rows($sql, $bind);
        return ['items' => $items, 'min_required' => $min, 'total' => count($items)];
    }

    public function teacher(int $id): ?array
    {
        return $this->one('SELECT t.id, t.code, t.full_name, t.gender, t.main_subject_id, s.name AS subject_name
            FROM sm_teachers t LEFT JOIN sm_subjects s ON s.id = t.main_subject_id WHERE t.id = ?', [$id]);
    }

    public function teacherProfile(int $id, int $year): array
    {
        $valid = self::VALID;
        $obs = $this->rows("SELECT o.id, o.code, o.observed_on, o.semester, o.kind, o.topic, o.total_score, o.rating, o.status, o.observer_name,
                s.name AS subject_name, c.name AS class_name
            FROM sm_ev_observations o LEFT JOIN sm_teachers t ON t.id = o.teacher_id
            LEFT JOIN sm_subjects s ON s.id = COALESCE(o.subject_id, t.main_subject_id) LEFT JOIN sm_classes c ON c.id = o.class_id
            WHERE o.teacher_id = ? ORDER BY o.observed_on DESC, o.id DESC LIMIT 40", [$id]);
        $groups = $this->rows("SELECT c.group_name, ROUND(SUM(c.weight * sc.score / c.max_score) / SUM(c.weight) * 100, 1) AS pct, COUNT(DISTINCT o.id) AS n
            FROM sm_ev_observations o JOIN sm_ev_obs_scores sc ON sc.observation_id = o.id JOIN sm_ev_criteria c ON c.id = sc.criterion_id
            WHERE o.teacher_id = ? AND o.status IN $valid GROUP BY c.group_name ORDER BY MIN(c.sort_order)", [$id]);
        return [
            'teacher' => $this->teacher($id),
            'classes' => $this->rows('SELECT c.name AS class_name, s.name AS subject_name FROM sm_class_subjects cs
                JOIN sm_classes c ON c.id = cs.class_id AND c.school_year_id = ? JOIN sm_subjects s ON s.id = cs.subject_id
                WHERE cs.teacher_id = ? ORDER BY c.grade, c.name', [$year, $id]),
            'observations' => $obs,
            'groups' => $groups,
            'plans' => $this->rows("SELECT p.id, p.plan_date, p.period, p.kind, p.topic, p.status, p.observer_name FROM sm_ev_plans p
                WHERE p.teacher_id = ? AND p.status = 'scheduled' ORDER BY p.plan_date LIMIT 10", [$id]),
            'actions' => $this->rows('SELECT * FROM sm_ev_actions WHERE teacher_id = ? ORDER BY (status IN (\'done\',\'cancelled\')), due_date LIMIT 30', [$id]),
            'periodic' => $this->rows('SELECT * FROM sm_ev_periodic WHERE teacher_id = ? ORDER BY school_year_id DESC, semester', [$id]),
        ];
    }

    /* ------------------------------------------------------------- đánh giá định kỳ */

    public function periodic(int $year, int $semester, array $f = []): array
    {
        [$sc, $sb] = $this->scope('o', $year, $semester);
        $valid = self::VALID;
        $w = ['1 = 1']; $wb = [];
        if (! empty($f['q'])) { $w[] = '(t.full_name LIKE ? OR t.code LIKE ?)'; $like = '%' . $f['q'] . '%'; array_push($wb, $like, $like); }
        if (! empty($f['subject_id'])) { $w[] = 't.main_subject_id = ?'; $wb[] = (int) $f['subject_id']; }
        $bind = array_merge($sb, $sb, [$year, $semester], $wb);

        $rows = $this->rows("SELECT t.id AS teacher_id, t.code, t.full_name, s.name AS subject_name,
                (SELECT COUNT(*) FROM sm_ev_observations o WHERE o.teacher_id = t.id AND $sc AND o.status IN $valid) AS obs_count,
                (SELECT ROUND(AVG(o.total_score), 2) FROM sm_ev_observations o WHERE o.teacher_id = t.id AND $sc AND o.status IN $valid) AS obs_avg,
                p.id AS id, p.score_professional, p.score_results, p.score_conduct, p.score_innovation, p.total_score, p.rating, p.comment,
                COALESCE(p.status, 'none') AS status, p.approved_by, p.approved_at
            FROM sm_teachers t LEFT JOIN sm_subjects s ON s.id = t.main_subject_id
            LEFT JOIN sm_ev_periodic p ON p.teacher_id = t.id AND p.school_year_id = ? AND p.semester = ?
            WHERE " . implode(' AND ', $w) . ' ORDER BY t.full_name', $bind);
        return $rows;
    }

    public function periodicRow(int $year, int $semester, int $teacherId): ?array
    {
        return $this->one('SELECT * FROM sm_ev_periodic WHERE school_year_id = ? AND semester = ? AND teacher_id = ?', [$year, $semester, $teacherId]);
    }

    public function observationStats(int $teacherId, int $year, int $semester): array
    {
        [$sc, $sb] = $this->scope('o', $year, $semester);
        $r = $this->one("SELECT COUNT(*) AS c, ROUND(AVG(o.total_score), 2) AS a FROM sm_ev_observations o
            WHERE o.teacher_id = ? AND $sc AND o.status IN " . self::VALID, array_merge([$teacherId], $sb));
        return ['count' => (int) ($r['c'] ?? 0), 'avg' => isset($r['a']) && $r['a'] !== null ? (float) $r['a'] : null];
    }

    public function savePeriodic(int $year, int $semester, int $teacherId, array $d): int
    {
        $row = $this->periodicRow($year, $semester, $teacherId);
        $n = $this->now();
        $cols = ['obs_count', 'score_observation', 'score_professional', 'score_results', 'score_conduct', 'score_innovation', 'total_score', 'rating', 'comment'];
        if ($row) {
            $sets = []; $b = [];
            foreach ($cols as $c) { if (array_key_exists($c, $d)) { $sets[] = "$c = ?"; $b[] = $d[$c]; } }
            $sets[] = 'updated_at = ?'; $b[] = $n; $b[] = $row['id'];
            DB::update('UPDATE sm_ev_periodic SET ' . implode(', ', $sets) . ' WHERE id = ?', $b);
            return (int) $row['id'];
        }
        return $this->insertId('INSERT INTO sm_ev_periodic (school_year_id, semester, teacher_id, obs_count, score_observation, score_professional, score_results,
                score_conduct, score_innovation, total_score, rating, comment, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [$year, $semester, $teacherId, $d['obs_count'] ?? 0, $d['score_observation'] ?? null, $d['score_professional'] ?? null, $d['score_results'] ?? null,
                $d['score_conduct'] ?? null, $d['score_innovation'] ?? null, $d['total_score'] ?? null, $d['rating'] ?? null, $d['comment'] ?? null, 'draft', $n, $n]);
    }

    public function setPeriodicStatus(int $id, string $status, ?string $by = null): void
    {
        if ($status === 'approved') {
            DB::update('UPDATE sm_ev_periodic SET status = ?, approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?', [$status, $by, $this->now(), $this->now(), $id]);
        } else {
            DB::update('UPDATE sm_ev_periodic SET status = ?, approved_by = NULL, approved_at = NULL, updated_at = ? WHERE id = ?', [$status, $this->now(), $id]);
        }
    }

    public function periodicById(int $id): ?array
    {
        return $this->one('SELECT p.*, t.full_name AS teacher_name FROM sm_ev_periodic p JOIN sm_teachers t ON t.id = p.teacher_id WHERE p.id = ?', [$id]);
    }

    /* ------------------------------------------------------------------ tiêu chí */

    public function rubrics(): array
    {
        return $this->rows('SELECT r.*, (SELECT COUNT(*) FROM sm_ev_criteria c WHERE c.rubric_id = r.id) AS criteria_count,
                (SELECT COALESCE(SUM(c.weight), 0) FROM sm_ev_criteria c WHERE c.rubric_id = r.id) AS weight_sum,
                (SELECT COUNT(*) FROM sm_ev_observations o WHERE o.rubric_id = r.id) AS used_count
            FROM sm_ev_rubrics r ORDER BY r.is_active DESC, r.id');
    }

    public function rubric(int $id): ?array
    {
        $r = $this->one('SELECT r.*, (SELECT COUNT(*) FROM sm_ev_observations o WHERE o.rubric_id = r.id) AS used_count FROM sm_ev_rubrics r WHERE r.id = ?', [$id]);
        if ($r) $r['criteria'] = $this->criteria($id);
        return $r;
    }

    public function rubricCodeExists(string $code, int $ignore = 0): bool
    {
        return (bool) $this->value('SELECT COUNT(*) FROM sm_ev_rubrics WHERE code = ? AND id <> ?', [$code, $ignore], 0);
    }

    public function saveRubric(?int $id, array $d, array $criteria, string $by): int
    {
        return DB::transaction(function () use ($id, $d, $criteria, $by) {
            $n = $this->now();
            if ($id) {
                DB::update('UPDATE sm_ev_rubrics SET name = ?, description = ?, updated_at = ? WHERE id = ?', [$d['name'], $d['description'], $n, $id]);
            } else {
                $id = $this->insertId('INSERT INTO sm_ev_rubrics (code, name, description, is_active, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
                    [$d['code'], $d['name'], $d['description'], 1, $by, $n, $n]);
            }
            if ($criteria !== null) {
                DB::delete('DELETE FROM sm_ev_criteria WHERE rubric_id = ?', [$id]);
                $i = 0;
                foreach ($criteria as $c) {
                    DB::insert('INSERT INTO sm_ev_criteria (rubric_id, group_name, name, description, weight, max_score, sort_order) VALUES (?,?,?,?,?,?,?)',
                        [$id, $c['group_name'], $c['name'], $c['description'] ?? null, $c['weight'], $c['max_score'] ?? 4, ++$i]);
                }
            }
            return $id;
        });
    }

    public function setRubricActive(int $id, bool $on): void
    {
        DB::update('UPDATE sm_ev_rubrics SET is_active = ?, updated_at = ? WHERE id = ?', [$on ? 1 : 0, $this->now(), $id]);
    }

    public function deleteRubric(int $id): void
    {
        DB::transaction(function () use ($id) {
            DB::delete('DELETE FROM sm_ev_criteria WHERE rubric_id = ?', [$id]);
            DB::delete('DELETE FROM sm_ev_rubrics WHERE id = ?', [$id]);
        });
    }

    /* ---------------------------------------------------------------- cải tiến */

    public function actions(array $f, int $page, int $per): array
    {
        $w = ['1 = 1']; $b = [];
        $today = $this->today();
        if (! empty($f['teacher_id'])) { $w[] = 'a.teacher_id = ?'; $b[] = (int) $f['teacher_id']; }
        if (! empty($f['observation_id'])) { $w[] = 'a.observation_id = ?'; $b[] = (int) $f['observation_id']; }
        if (! empty($f['q'])) { $w[] = '(a.title LIKE ? OR t.full_name LIKE ?)'; $like = '%' . $f['q'] . '%'; array_push($b, $like, $like); }
        $base = implode(' AND ', $w);

        $counts = ['all' => 0, 'open' => 0, 'in_progress' => 0, 'done' => 0, 'cancelled' => 0, 'overdue' => 0];
        foreach ($this->rows("SELECT a.status, COUNT(*) AS c FROM sm_ev_actions a JOIN sm_teachers t ON t.id = a.teacher_id WHERE $base GROUP BY a.status", $b) as $r) {
            $counts[$r['status']] = (int) $r['c']; $counts['all'] += (int) $r['c'];
        }
        $counts['overdue'] = (int) $this->value("SELECT COUNT(*) FROM sm_ev_actions a JOIN sm_teachers t ON t.id = a.teacher_id WHERE $base AND a.status IN ('open','in_progress') AND a.due_date < ?",
            array_merge($b, [$today]), 0);

        $status = $f['status'] ?? '';
        if ($status === 'overdue') { $w[] = "a.status IN ('open','in_progress')"; $w[] = 'a.due_date < ?'; $b[] = $today; }
        elseif ($status === 'active') { $w[] = "a.status IN ('open','in_progress')"; }
        elseif ($status !== '' && $status !== 'all') { $w[] = 'a.status = ?'; $b[] = $status; }

        $total = (int) $this->value('SELECT COUNT(*) FROM sm_ev_actions a JOIN sm_teachers t ON t.id = a.teacher_id WHERE ' . implode(' AND ', $w), $b, 0);
        $per = max(1, min(200, $per)); $page = max(1, $page);
        $items = $this->rows('SELECT a.*, t.full_name AS teacher_name, t.code AS teacher_code, o.code AS observation_code
            FROM sm_ev_actions a JOIN sm_teachers t ON t.id = a.teacher_id LEFT JOIN sm_ev_observations o ON o.id = a.observation_id
            WHERE ' . implode(' AND ', $w) . " ORDER BY (a.status IN ('done','cancelled')), (a.due_date IS NULL), a.due_date, a.id DESC LIMIT $per OFFSET " . (($page - 1) * $per), $b);
        foreach ($items as &$it) {
            $it['overdue'] = in_array($it['status'], ['open', 'in_progress'], true) && $it['due_date'] && $it['due_date'] < $today;
        }
        return ['items' => $items, 'total' => $total, 'page' => $page, 'per_page' => $per, 'last_page' => max(1, (int) ceil($total / $per)), 'counts' => $counts];
    }

    public function action(int $id): ?array
    {
        return $this->one('SELECT a.*, t.full_name AS teacher_name FROM sm_ev_actions a JOIN sm_teachers t ON t.id = a.teacher_id WHERE a.id = ?', [$id]);
    }

    public function createAction(array $d): int
    {
        $n = $this->now();
        return $this->insertId('INSERT INTO sm_ev_actions (observation_id, teacher_id, title, detail, priority, due_date, status, assigned_by, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)', [$d['observation_id'], $d['teacher_id'], $d['title'], $d['detail'], $d['priority'], $d['due_date'], 'open', $d['assigned_by'], $n, $n]);
    }

    public function updateAction(int $id, array $d): void
    {
        DB::update('UPDATE sm_ev_actions SET title = ?, detail = ?, priority = ?, due_date = ?, updated_at = ? WHERE id = ?',
            [$d['title'], $d['detail'], $d['priority'], $d['due_date'], $this->now(), $id]);
    }

    public function setActionStatus(int $id, string $status, ?string $note): void
    {
        DB::update('UPDATE sm_ev_actions SET status = ?, result_note = ?, completed_at = ?, updated_at = ? WHERE id = ?',
            [$status, $note, $status === 'done' ? $this->now() : null, $this->now(), $id]);
    }

    public function deleteAction(int $id): void
    {
        DB::delete('DELETE FROM sm_ev_actions WHERE id = ?', [$id]);
    }

    /* ---------------------------------------------------------------- báo cáo */

    public function report(int $year, int $semester): array
    {
        [$sc, $sb] = $this->scope('o', $year, $semester);
        $valid = self::VALID;
        $dept = $this->rows("SELECT s.id, s.name, COUNT(*) AS c, ROUND(AVG(o.total_score), 1) AS a,
                SUM(o.rating = 'excellent') AS excellent, SUM(o.rating = 'good') AS good, SUM(o.rating = 'pass') AS pass_, SUM(o.rating = 'fail') AS fail_,
                COUNT(DISTINCT o.teacher_id) AS teachers
            FROM sm_ev_observations o JOIN sm_teachers t ON t.id = o.teacher_id LEFT JOIN sm_subjects s ON s.id = t.main_subject_id
            WHERE $sc AND o.status IN $valid GROUP BY s.id, s.name ORDER BY a DESC", $sb);
        $deptTeachers = [];
        foreach ($this->rows('SELECT main_subject_id AS id, COUNT(*) AS n FROM sm_teachers GROUP BY main_subject_id') as $r) { $deptTeachers[(int) $r['id']] = (int) $r['n']; }
        foreach ($dept as &$d) { $d['teacher_total'] = $deptTeachers[(int) $d['id']] ?? 0; }

        $observers = $this->rows("SELECT COALESCE(o.observer_name, 'Chưa ghi') AS name, COUNT(*) AS c, ROUND(AVG(o.total_score), 1) AS a
            FROM sm_ev_observations o WHERE $sc AND o.status IN $valid GROUP BY COALESCE(o.observer_name, 'Chưa ghi') ORDER BY c DESC LIMIT 10", $sb);

        $criteria = $this->rows("SELECT c.id, c.name, c.group_name, ROUND(AVG(sc.score / c.max_score) * 100, 1) AS pct, COUNT(*) AS n
            FROM sm_ev_observations o JOIN sm_ev_obs_scores sc ON sc.observation_id = o.id JOIN sm_ev_criteria c ON c.id = sc.criterion_id
            WHERE $sc AND o.status IN $valid GROUP BY c.id, c.name, c.group_name ORDER BY pct ASC LIMIT 12", $sb);

        $kinds = $this->rows("SELECT o.kind, COUNT(*) AS c, ROUND(AVG(o.total_score), 1) AS a FROM sm_ev_observations o
            WHERE $sc AND o.status IN $valid GROUP BY o.kind", $sb);

        return ['by_dept' => $dept, 'observers' => $observers, 'weakest_criteria' => $criteria, 'kinds' => $kinds];
    }

    /* ----------------------------------------------------------- tìm GV theo tên nhanh */

    public function teacherName(int $id): ?string
    {
        return $this->value('SELECT full_name FROM sm_teachers WHERE id = ?', [$id]);
    }
}
