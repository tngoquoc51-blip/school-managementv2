<?php

namespace Modules\Emulation\Services;

use Illuminate\Support\Facades\DB;
use Modules\Emulation\Exceptions\EmuException;

/**
 * Toàn bộ nghiệp vụ Thi đua - Khen thưởng của GVCN.
 * Dùng DB facade trực tiếp trên các bảng sm_* thật của hệ thống.
 */
class EmulationService
{
    public const BASE_SCORE = 100;
    public const ADMIN_ROLES = ['super_admin', 'principal', 'vice_principal', 'academic'];
    public const REVIEW_ROLES = ['super_admin', 'principal', 'vice_principal'];
    public const ACTIVE_STATUSES = ['draft', 'submitted', 'approved'];

    public const TIERS = [
        ['key' => 'excellent', 'label' => 'Xuất sắc', 'min' => 120, 'color' => '#0E9F6E'],
        ['key' => 'good', 'label' => 'Tốt', 'min' => 105, 'color' => '#3B82F6'],
        ['key' => 'fair', 'label' => 'Khá', 'min' => 90, 'color' => '#8B5CF6'],
        ['key' => 'average', 'label' => 'Trung bình', 'min' => 75, 'color' => '#F59E0B'],
        ['key' => 'weak', 'label' => 'Cần cố gắng', 'min' => -9999, 'color' => '#EF4444'],
    ];

    public const CATEGORIES = [
        'discipline' => 'Nề nếp - Kỷ luật',
        'study' => 'Học tập',
        'movement' => 'Phong trào',
        'hygiene' => 'Vệ sinh - Môi trường',
        'attendance' => 'Chuyên cần',
    ];

    /* ------------------------------------------------------------------ */
    /* Ngữ cảnh: lớp + năm học + học kỳ                                    */
    /* ------------------------------------------------------------------ */

    public function context(array $actor, ?int $classId): array
    {
        $year = DB::table('sm_school_years')->where('is_current', 1)->first()
            ?? DB::table('sm_school_years')->orderByDesc('id')->first();
        if (! $year) {
            throw new EmuException('Chưa cấu hình năm học.', 422);
        }

        $isAdmin = in_array($actor['role'], self::ADMIN_ROLES, true);
        $q = DB::table('sm_classes as c')
            ->leftJoin('sm_teachers as t', 't.id', '=', 'c.homeroom_teacher_id')
            ->where('c.school_year_id', $year->id)
            ->select('c.id', 'c.name', 'c.grade', 'c.room', 'c.homeroom_teacher_id', 't.full_name as homeroom_name');

        if ($isAdmin) {
            $classId ? $q->where('c.id', $classId) : $q->orderBy('c.grade')->orderBy('c.name');
        } else {
            if (! $actor['teacher_id']) {
                throw new EmuException('Tài khoản này chưa gắn với giáo viên.', 403);
            }
            $q->where('c.homeroom_teacher_id', $actor['teacher_id']);
        }

        $class = $q->first();
        if (! $class) {
            throw new EmuException('Bạn chưa được phân công chủ nhiệm lớp nào trong năm học hiện tại.', 403);
        }

        return ['actor' => $actor, 'class' => $class, 'year' => $year, 'is_admin' => $isAdmin];
    }

    private function semesters(object $year): array
    {
        return DB::table('sm_semesters')->where('school_year_id', $year->id)->orderBy('code')->get()->all();
    }

    private function range(array $ctx, int $sem): array
    {
        $y = $ctx['year'];
        if ($sem > 0) {
            $s = DB::table('sm_semesters')->where('school_year_id', $y->id)->where('code', $sem)->first();
            if ($s && $s->start_date && $s->end_date) {
                return [$s->start_date, $s->end_date];
            }
        }

        return [$y->start_date, $y->end_date];
    }

    private function semesterOf(array $ctx, string $date): int
    {
        $sems = $this->semesters($ctx['year']);
        foreach ($sems as $s) {
            if ($s->start_date && $s->end_date && $date >= $s->start_date && $date <= $s->end_date) {
                return (int) $s->code;
            }
        }
        $first = $sems[0] ?? null;

        return ($first && $first->end_date && $date <= $first->end_date) ? 1 : 2;
    }

    private function tierFor(int $score): array
    {
        foreach (self::TIERS as $t) {
            if ($score >= $t['min']) {
                return $t;
            }
        }

        return self::TIERS[count(self::TIERS) - 1];
    }

    /* ------------------------------------------------------------------ */
    /* Meta                                                                */
    /* ------------------------------------------------------------------ */

    public function meta(array $ctx): array
    {
        $a = $ctx['actor'];
        $c = $ctx['class'];
        $y = $ctx['year'];
        $sems = $this->semesters($y);
        $cur = collect($sems)->firstWhere('is_current', 1);

        return [
            'actor' => [
                'name' => $a['name'],
                'role' => $a['role'],
                'teacher_id' => $a['teacher_id'],
                'is_admin' => $ctx['is_admin'],
                'can_review' => in_array($a['role'], self::REVIEW_ROLES, true),
                'can_edit_criteria' => $ctx['is_admin'],
            ],
            'class' => [
                'id' => (int) $c->id, 'name' => $c->name, 'grade' => (int) $c->grade, 'room' => $c->room,
                'homeroom_teacher' => $c->homeroom_name,
                'student_count' => DB::table('sm_enrollments')->where('class_id', $c->id)->where('school_year_id', $y->id)->count(),
            ],
            'classes' => $ctx['is_admin']
                ? DB::table('sm_classes')->where('school_year_id', $y->id)->orderBy('grade')->orderBy('name')->get(['id', 'name', 'grade'])
                : null,
            'school_year' => ['id' => (int) $y->id, 'label' => $y->label, 'start_date' => $y->start_date, 'end_date' => $y->end_date],
            'semesters' => array_map(fn ($s) => [
                'code' => (int) $s->code, 'name' => $s->name, 'start_date' => $s->start_date,
                'end_date' => $s->end_date, 'is_current' => (bool) $s->is_current,
            ], $sems),
            'current_semester' => $cur ? (int) $cur->code : 1,
            'base_score' => self::BASE_SCORE,
            'tiers' => self::TIERS,
            'categories' => self::CATEGORIES,
            'criteria' => DB::table('sm_emu_criteria')->orderBy('sort_order')->orderBy('id')->get(),
            'awards' => DB::table('sm_emu_awards')->where('is_active', 1)->orderBy('sort_order')->get(),
        ];
    }

    /* ------------------------------------------------------------------ */
    /* Học sinh + điểm thi đua + học lực + hạnh kiểm + chuyên cần           */
    /* ------------------------------------------------------------------ */

    public function studentRows(array $ctx, int $sem): array
    {
        $c = $ctx['class'];
        $y = $ctx['year'];
        $semSql = $sem > 0 ? ' AND semester = ?' : '';
        $bind = [$c->id, $y->id];
        if ($sem > 0) {
            $bind[] = $sem;
        }
        array_push($bind, $c->id, $y->id);

        $rows = DB::select("
            SELECT s.id, s.code, s.full_name, s.gender, s.birth_date,
                   COALESCE(r.total,0) AS pts, COALESCE(r.plus_pts,0) AS plus_pts,
                   COALESCE(r.minus_pts,0) AS minus_pts, COALESCE(r.cnt,0) AS cnt
            FROM sm_enrollments e
            JOIN sm_students s ON s.id = e.student_id
            LEFT JOIN (
                SELECT student_id, SUM(points) AS total,
                       SUM(CASE WHEN points > 0 THEN points ELSE 0 END) AS plus_pts,
                       SUM(CASE WHEN points < 0 THEN points ELSE 0 END) AS minus_pts,
                       COUNT(*) AS cnt
                FROM sm_emu_records
                WHERE voided_at IS NULL AND class_id = ? AND school_year_id = ? $semSql
                GROUP BY student_id
            ) r ON r.student_id = s.id
            WHERE e.class_id = ? AND e.school_year_id = ?
            ORDER BY SUBSTRING_INDEX(s.full_name, ' ', -1), s.full_name", $bind);

        $ids = array_map(fn ($r) => $r->id, $rows);
        if (! $ids) {
            return [];
        }

        $gpa = DB::table('sm_grades')
            ->where('class_id', $c->id)->where('school_year_id', $y->id)
            ->when($sem > 0, fn ($q) => $q->where('semester', $sem))
            ->whereNotNull('tbm')->groupBy('student_id')
            ->selectRaw('student_id, AVG(tbm) AS gpa')->pluck('gpa', 'student_id');

        $col = $sem === 1 ? 'hk1' : ($sem === 2 ? 'hk2' : 'year_result');
        $conduct = DB::table('sm_conduct')->where('school_year_id', $y->id)->whereIn('student_id', $ids)->pluck($col, 'student_id');

        [$from, $to] = $this->range($ctx, $sem);
        $att = [];
        $attRows = DB::table('sm_att_records')
            ->whereIn('student_id', $ids)->where('school_year_id', $y->id)
            ->whereBetween('att_date', [$from, $to])->whereIn('status', ['late', 'excused', 'unexcused'])
            ->groupBy('student_id', 'status')->selectRaw('student_id, status, COUNT(*) AS n')->get();
        foreach ($attRows as $r) {
            $att[$r->student_id][$r->status] = (int) $r->n;
        }

        $out = [];
        foreach ($rows as $r) {
            $score = self::BASE_SCORE + (int) $r->pts;
            $t = $this->tierFor($score);
            $out[] = [
                'id' => (int) $r->id, 'code' => $r->code, 'full_name' => $r->full_name, 'gender' => $r->gender,
                'birth_date' => $r->birth_date,
                'score' => $score, 'plus_points' => (int) $r->plus_pts, 'minus_points' => (int) $r->minus_pts,
                'record_count' => (int) $r->cnt, 'tier' => $t['key'], 'tier_label' => $t['label'],
                'gpa' => isset($gpa[$r->id]) ? round((float) $gpa[$r->id], 1) : null,
                'conduct' => $conduct[$r->id] ?? null,
                'absences' => [
                    'excused' => $att[$r->id]['excused'] ?? 0,
                    'unexcused' => $att[$r->id]['unexcused'] ?? 0,
                    'late' => $att[$r->id]['late'] ?? 0,
                ],
            ];
        }

        // Xếp hạng (đồng điểm cùng hạng)
        $sorted = $out;
        usort($sorted, fn ($a, $b) => $b['score'] <=> $a['score']);
        $rank = [];
        $last = null;
        $pos = 0;
        foreach ($sorted as $i => $s) {
            if ($s['score'] !== $last) {
                $pos = $i + 1;
                $last = $s['score'];
            }
            $rank[$s['id']] = $pos;
        }
        foreach ($out as &$s) {
            $s['rank'] = $rank[$s['id']];
        }

        return $out;
    }

    public function student(array $ctx, int $id, int $sem): array
    {
        $rows = $this->studentRows($ctx, $sem);
        $row = collect($rows)->firstWhere('id', $id);
        if (! $row) {
            throw new EmuException('Không tìm thấy học sinh trong lớp.', 404);
        }

        $perSem = [];
        foreach ([1, 2] as $s) {
            $r = collect($this->studentRows($ctx, $s))->firstWhere('id', $id);
            $perSem[] = ['semester' => $s, 'score' => $r['score'], 'gpa' => $r['gpa'], 'conduct' => $r['conduct'], 'rank' => $r['rank']];
        }

        $cats = DB::table('sm_emu_records as r')->join('sm_emu_criteria as c', 'c.id', '=', 'r.criterion_id')
            ->where('r.student_id', $id)->where('r.class_id', $ctx['class']->id)->where('r.school_year_id', $ctx['year']->id)
            ->whereNull('r.voided_at')->when($sem > 0, fn ($q) => $q->where('r.semester', $sem))
            ->groupBy('c.category')
            ->selectRaw('c.category, SUM(CASE WHEN r.points>0 THEN r.points ELSE 0 END) AS plus_pts, SUM(CASE WHEN r.points<0 THEN r.points ELSE 0 END) AS minus_pts')
            ->get()->map(fn ($x) => ['key' => $x->category, 'label' => self::CATEGORIES[$x->category] ?? $x->category, 'plus' => (int) $x->plus_pts, 'minus' => (int) $x->minus_pts]);

        return [
            'student' => $row,
            'per_semester' => $perSem,
            'categories' => $cats,
            'records' => $this->records($ctx, ['student_id' => $id, 'semester' => $sem, 'per_page' => 30])['items'],
            'proposals' => array_values(array_filter($this->proposals($ctx, -1, null), fn ($p) => $p['student_id'] === $id)),
        ];
    }

    /* ------------------------------------------------------------------ */
    /* Tổng quan + xếp hạng lớp                                            */
    /* ------------------------------------------------------------------ */

    public function classRanking(array $ctx, int $sem): array
    {
        $y = $ctx['year'];
        $semSql = $sem > 0 ? ' AND semester = ?' : '';
        $bind = [$y->id];
        if ($sem > 0) {
            $bind[] = $sem;
        }
        $bind[] = $y->id;

        $rows = DB::select("
            SELECT cl.id AS class_id, cl.name, cl.grade, COUNT(e.student_id) AS n,
                   ROUND(100 + COALESCE(SUM(r.total),0) / COUNT(e.student_id), 1) AS avg_score
            FROM sm_classes cl
            JOIN sm_enrollments e ON e.class_id = cl.id AND e.school_year_id = cl.school_year_id
            LEFT JOIN (
                SELECT student_id, SUM(points) AS total FROM sm_emu_records
                WHERE voided_at IS NULL AND school_year_id = ? $semSql GROUP BY student_id
            ) r ON r.student_id = e.student_id
            WHERE cl.school_year_id = ?
            GROUP BY cl.id, cl.name, cl.grade
            ORDER BY avg_score DESC, cl.name", $bind);

        $out = [];
        $gradeRank = [];
        foreach ($rows as $i => $r) {
            $g = (int) $r->grade;
            $gradeRank[$g] = ($gradeRank[$g] ?? 0) + 1;
            $out[] = [
                'class_id' => (int) $r->class_id, 'name' => $r->name, 'grade' => $g, 'students' => (int) $r->n,
                'avg_score' => (float) $r->avg_score, 'rank' => $i + 1, 'grade_rank' => $gradeRank[$g],
                'is_mine' => (int) $r->class_id === (int) $ctx['class']->id,
            ];
        }

        return $out;
    }

    public function overview(array $ctx, int $sem): array
    {
        $c = $ctx['class'];
        $y = $ctx['year'];
        $students = $this->studentRows($ctx, $sem);
        $n = max(count($students), 1);

        $tiers = [];
        foreach (self::TIERS as $t) {
            $tiers[$t['key']] = ['key' => $t['key'], 'label' => $t['label'], 'color' => $t['color'], 'count' => 0];
        }
        $plus = $minus = $records = 0;
        $sum = 0;
        foreach ($students as $s) {
            $tiers[$s['tier']]['count']++;
            $plus += $s['plus_points'];
            $minus += $s['minus_points'];
            $records += $s['record_count'];
            $sum += $s['score'];
        }

        $semBind = $sem > 0 ? [$sem] : [];
        $semSql = $sem > 0 ? ' AND r.semester = ?' : '';
        $base = [$c->id, $y->id];

        $trendRows = DB::select("
            SELECT YEARWEEK(r.record_date, 1) AS yw, MIN(r.record_date) AS d0,
                   SUM(CASE WHEN r.points > 0 THEN r.points ELSE 0 END) AS plus_pts,
                   SUM(CASE WHEN r.points < 0 THEN r.points ELSE 0 END) AS minus_pts
            FROM sm_emu_records r
            WHERE r.voided_at IS NULL AND r.class_id = ? AND r.school_year_id = ? $semSql
            GROUP BY YEARWEEK(r.record_date, 1) ORDER BY yw DESC LIMIT 14", array_merge($base, $semBind));
        $trend = array_reverse(array_map(fn ($t) => [
            'week' => date('Y-m-d', strtotime('monday this week', strtotime($t->d0))),
            'plus' => (int) $t->plus_pts, 'minus' => (int) $t->minus_pts, 'net' => (int) $t->plus_pts + (int) $t->minus_pts,
        ], $trendRows));

        $cats = DB::select("
            SELECT c.category, SUM(CASE WHEN r.points > 0 THEN r.points ELSE 0 END) AS plus_pts,
                   SUM(CASE WHEN r.points < 0 THEN r.points ELSE 0 END) AS minus_pts
            FROM sm_emu_records r JOIN sm_emu_criteria c ON c.id = r.criterion_id
            WHERE r.voided_at IS NULL AND r.class_id = ? AND r.school_year_id = ? $semSql
            GROUP BY c.category", array_merge($base, $semBind));
        $categories = [];
        foreach (self::CATEGORIES as $k => $label) {
            $hit = collect($cats)->firstWhere('category', $k);
            $categories[] = ['key' => $k, 'label' => $label, 'plus' => (int) ($hit->plus_pts ?? 0), 'minus' => (int) ($hit->minus_pts ?? 0)];
        }

        $topCriteria = DB::select("
            SELECT c.id, c.name, c.points, COUNT(*) AS n
            FROM sm_emu_records r JOIN sm_emu_criteria c ON c.id = r.criterion_id
            WHERE r.voided_at IS NULL AND r.class_id = ? AND r.school_year_id = ? $semSql
            GROUP BY c.id, c.name, c.points ORDER BY n DESC LIMIT 6", array_merge($base, $semBind));

        $props = DB::table('sm_emu_proposals')->where('class_id', $c->id)->where('school_year_id', $y->id)
            ->when($sem >= 0, fn ($q) => $q->where('semester', $sem))
            ->groupBy('status')->selectRaw('status, COUNT(*) AS n')->pluck('n', 'status');

        $ranking = $this->classRanking($ctx, $sem);
        $mine = collect($ranking)->firstWhere('is_mine', true);
        $byScore = $students;
        usort($byScore, fn ($a, $b) => $b['score'] <=> $a['score']);

        return [
            'class_avg' => round($sum / $n, 1),
            'class_rank' => [
                'school' => $mine['rank'] ?? null, 'school_total' => count($ranking),
                'grade' => $mine['grade_rank'] ?? null,
                'grade_total' => count(array_filter($ranking, fn ($r) => $r['grade'] === (int) $c->grade)),
            ],
            'totals' => [
                'students' => count($students), 'records' => $records, 'plus_points' => $plus, 'minus_points' => $minus,
                'net_points' => $plus + $minus,
                'draft' => (int) ($props['draft'] ?? 0), 'submitted' => (int) ($props['submitted'] ?? 0),
                'approved' => (int) ($props['approved'] ?? 0), 'rejected' => (int) ($props['rejected'] ?? 0),
            ],
            'tiers' => array_values($tiers),
            'categories' => $categories,
            'trend' => $trend,
            'top_criteria' => array_map(fn ($t) => ['id' => (int) $t->id, 'name' => $t->name, 'points' => (int) $t->points, 'count' => (int) $t->n], $topCriteria),
            'top_students' => array_slice($byScore, 0, 5),
            'attention' => array_slice(array_reverse($byScore), 0, 5),
            'recent' => $this->records($ctx, ['semester' => $sem, 'per_page' => 8])['items'],
        ];
    }

    /* ------------------------------------------------------------------ */
    /* Bản ghi thi đua                                                     */
    /* ------------------------------------------------------------------ */

    public function records(array $ctx, array $f): array
    {
        $page = max((int) ($f['page'] ?? 1), 1);
        $per = min(max((int) ($f['per_page'] ?? 20), 1), 100);
        $q = DB::table('sm_emu_records as r')
            ->join('sm_students as s', 's.id', '=', 'r.student_id')
            ->join('sm_emu_criteria as c', 'c.id', '=', 'r.criterion_id')
            ->leftJoin('sm_teachers as t', 't.id', '=', 'r.created_by')
            ->where('r.class_id', $ctx['class']->id)->where('r.school_year_id', $ctx['year']->id);

        ($f['status'] ?? 'active') === 'voided' ? $q->whereNotNull('r.voided_at') : $q->whereNull('r.voided_at');
        if (! empty($f['semester'])) {
            $q->where('r.semester', (int) $f['semester']);
        }
        if (! empty($f['student_id'])) {
            $q->where('r.student_id', (int) $f['student_id']);
        }
        if (! empty($f['criterion_id'])) {
            $q->where('r.criterion_id', (int) $f['criterion_id']);
        }
        if (($f['kind'] ?? '') === 'plus') {
            $q->where('r.points', '>', 0);
        } elseif (($f['kind'] ?? '') === 'minus') {
            $q->where('r.points', '<', 0);
        }
        if (! empty($f['from'])) {
            $q->where('r.record_date', '>=', $f['from']);
        }
        if (! empty($f['to'])) {
            $q->where('r.record_date', '<=', $f['to']);
        }
        if (! empty($f['q'])) {
            $kw = '%' . str_replace(['%', '_'], ['\%', '\_'], trim($f['q'])) . '%';
            $q->where(fn ($w) => $w->where('s.full_name', 'like', $kw)->orWhere('s.code', 'like', $kw)->orWhere('r.note', 'like', $kw));
        }

        $total = (clone $q)->count();
        $items = $q->orderByDesc('r.record_date')->orderByDesc('r.id')->forPage($page, $per)->get([
            'r.id', 'r.student_id', 's.full_name as student_name', 's.code as student_code', 'r.criterion_id',
            'c.name as criterion_name', 'c.category', 'r.points', 'r.record_date', 'r.note', 'r.semester',
            't.full_name as created_by_name', 'r.created_at', 'r.voided_at',
        ]);

        return ['items' => $items, 'total' => $total, 'page' => $page, 'per_page' => $per];
    }

    public function createRecords(array $ctx, array $d): array
    {
        $c = $ctx['class'];
        $y = $ctx['year'];
        $ids = array_values(array_unique(array_map('intval', $d['student_ids'])));
        $valid = DB::table('sm_enrollments')->where('class_id', $c->id)->where('school_year_id', $y->id)->whereIn('student_id', $ids)->pluck('student_id')->all();
        if (count($valid) !== count($ids)) {
            throw new EmuException('Có học sinh không thuộc lớp đang quản lý.', 422);
        }

        $crit = DB::table('sm_emu_criteria')->where('id', $d['criterion_id'])->where('is_active', 1)->first();
        if (! $crit) {
            throw new EmuException('Tiêu chí không tồn tại hoặc đã ngừng sử dụng.', 422);
        }

        $points = isset($d['points']) && $d['points'] !== null ? (int) $d['points'] : (int) $crit->points;
        if ($points === 0 || ($points > 0) !== ($crit->points > 0) || abs($points) > 50) {
            throw new EmuException('Điểm phải cùng dấu với tiêu chí và không vượt quá 50.', 422);
        }
        $note = trim((string) ($d['note'] ?? ''));
        if ($crit->points < 0 && $note === '') {
            throw new EmuException('Vui lòng ghi rõ lý do khi trừ điểm.', 422);
        }
        $date = $d['record_date'];
        if ($date < $y->start_date || $date > $y->end_date) {
            throw new EmuException("Ngày ghi nhận phải trong năm học {$y->label}.", 422);
        }

        $sem = $this->semesterOf($ctx, $date);
        $now = now();
        $rows = array_map(fn ($sid) => [
            'student_id' => $sid, 'class_id' => $c->id, 'school_year_id' => $y->id, 'semester' => $sem,
            'criterion_id' => $crit->id, 'points' => $points, 'record_date' => $date, 'note' => $note ?: null,
            'created_by' => $ctx['actor']['teacher_id'], 'created_at' => $now,
        ], $ids);

        DB::transaction(function () use ($rows, $ctx, $crit, $points, $ids) {
            DB::table('sm_emu_records')->insert($rows);
            $sign = $points > 0 ? '+' : '';
            $this->log($ctx, 'record.create', "Ghi nhận {$sign}{$points} điểm «{$crit->name}» cho " . count($ids) . ' học sinh');
        });

        return ['created' => count($ids), 'points' => $points, 'semester' => $sem];
    }

    private function findRecord(array $ctx, int $id): object
    {
        $r = DB::table('sm_emu_records')->where('id', $id)->where('class_id', $ctx['class']->id)->first();
        if (! $r) {
            throw new EmuException('Không tìm thấy bản ghi.', 404);
        }

        return $r;
    }

    public function voidRecord(array $ctx, int $id): void
    {
        $r = $this->findRecord($ctx, $id);
        if ($r->voided_at) {
            return;
        }
        DB::table('sm_emu_records')->where('id', $id)->update(['voided_at' => now(), 'voided_by' => $ctx['actor']['teacher_id']]);
        $this->log($ctx, 'record.void', "Thu hồi bản ghi {$r->points} điểm ngày " . date('d/m/Y', strtotime($r->record_date)));
    }

    public function restoreRecord(array $ctx, int $id): void
    {
        $this->findRecord($ctx, $id);
        DB::table('sm_emu_records')->where('id', $id)->update(['voided_at' => null, 'voided_by' => null]);
        $this->log($ctx, 'record.restore', 'Khôi phục một bản ghi thi đua đã thu hồi');
    }

    /* ------------------------------------------------------------------ */
    /* Gợi ý khen thưởng tự động                                           */
    /* ------------------------------------------------------------------ */

    public function suggestions(array $ctx, int $sem): array
    {
        $students = $this->studentRows($ctx, $sem);
        $awards = DB::table('sm_emu_awards')->where('is_active', 1)->where('auto_suggest', 1)->orderBy('sort_order')->get();
        $existing = DB::table('sm_emu_proposals')
            ->where('class_id', $ctx['class']->id)->where('school_year_id', $ctx['year']->id)->where('semester', $sem)
            ->whereIn('status', self::ACTIVE_STATUSES)->get(['student_id', 'award_id'])
            ->map(fn ($p) => $p->student_id . ':' . $p->award_id)->flip();

        $items = [];
        foreach ($awards as $a) {
            $allowed = $a->allowed_conduct ? array_map('trim', explode(',', $a->allowed_conduct)) : null;
            foreach ($students as $s) {
                $checks = [];
                $add = function (string $label, $value, bool $ok) use (&$checks) {
                    $checks[] = ['label' => $label, 'value' => $value, 'ok' => $ok];
                };
                if ($a->min_score !== null) {
                    $add("Điểm thi đua ≥ {$a->min_score}", $s['score'], $s['score'] >= $a->min_score);
                }
                if ($a->min_gpa !== null) {
                    $add("ĐTB ≥ {$a->min_gpa}", $s['gpa'], $s['gpa'] !== null && $s['gpa'] >= (float) $a->min_gpa);
                }
                if ($allowed) {
                    $add('Hạnh kiểm: ' . implode(' / ', $allowed), $s['conduct'], in_array($s['conduct'], $allowed, true));
                }
                if ($a->max_unexcused !== null) {
                    $add("Nghỉ không phép ≤ {$a->max_unexcused} buổi", $s['absences']['unexcused'], $s['absences']['unexcused'] <= $a->max_unexcused);
                }
                if ($a->min_plus_points !== null) {
                    $add("Điểm cộng ≥ {$a->min_plus_points}", $s['plus_points'], $s['plus_points'] >= $a->min_plus_points);
                }
                if (! $checks || collect($checks)->contains('ok', false)) {
                    continue;
                }
                $items[] = [
                    'student' => $s, 'award_id' => (int) $a->id, 'award_name' => $a->name, 'award_level' => $a->level,
                    'checks' => $checks, 'already' => isset($existing[$s['id'] . ':' . $a->id]),
                ];
            }
        }

        return $items;
    }

    /* ------------------------------------------------------------------ */
    /* Đề xuất khen thưởng                                                 */
    /* ------------------------------------------------------------------ */

    /** $sem = -1: mọi kỳ; $status: lọc trạng thái */
    public function proposals(array $ctx, int $sem, ?string $status): array
    {
        $rows = DB::table('sm_emu_proposals as p')
            ->join('sm_students as s', 's.id', '=', 'p.student_id')
            ->join('sm_emu_awards as a', 'a.id', '=', 'p.award_id')
            ->leftJoin('sm_teachers as t', 't.id', '=', 'p.proposed_by')
            ->where('p.class_id', $ctx['class']->id)->where('p.school_year_id', $ctx['year']->id)
            ->when($sem >= 0, fn ($q) => $q->where('p.semester', $sem))
            ->when($status, fn ($q) => $q->where('p.status', $status))
            ->orderByDesc('p.updated_at')->orderByDesc('p.id')
            ->get(['p.*', 's.full_name as student_name', 's.code as student_code', 'a.name as award_name', 'a.level as award_level', 't.full_name as proposed_by_name']);

        return $rows->map(fn ($p) => [
            'id' => (int) $p->id, 'student_id' => (int) $p->student_id, 'student_name' => $p->student_name, 'student_code' => $p->student_code,
            'award_id' => (int) $p->award_id, 'award_name' => $p->award_name, 'award_level' => $p->award_level,
            'semester' => (int) $p->semester, 'reason' => $p->reason, 'score' => $p->snap_score, 'gpa' => $p->snap_gpa !== null ? (float) $p->snap_gpa : null,
            'conduct' => $p->snap_conduct, 'status' => $p->status, 'proposed_by_name' => $p->proposed_by_name,
            'submitted_at' => $p->submitted_at, 'reviewed_by_name' => $p->reviewed_by_name, 'reviewed_at' => $p->reviewed_at,
            'review_note' => $p->review_note, 'decision_no' => $p->decision_no, 'created_at' => $p->created_at,
        ])->all();
    }

    public function createProposals(array $ctx, int $sem, array $items): array
    {
        $students = collect($this->studentRows($ctx, $sem))->keyBy('id');
        $created = $skipped = 0;

        DB::transaction(function () use ($ctx, $sem, $items, $students, &$created, &$skipped) {
            foreach ($items as $it) {
                $s = $students[(int) $it['student_id']] ?? null;
                $award = DB::table('sm_emu_awards')->where('id', $it['award_id'])->where('is_active', 1)->first();
                if (! $s || ! $award) {
                    throw new EmuException('Học sinh hoặc danh hiệu không hợp lệ.', 422);
                }
                $dup = DB::table('sm_emu_proposals')->where('student_id', $s['id'])->where('award_id', $award->id)
                    ->where('school_year_id', $ctx['year']->id)->where('semester', $sem)->whereIn('status', self::ACTIVE_STATUSES)->exists();
                if ($dup) {
                    $skipped++;
                    continue;
                }
                $reason = trim((string) ($it['reason'] ?? '')) ?: sprintf(
                    'Điểm thi đua %d, ĐTB %s, hạnh kiểm %s.', $s['score'], $s['gpa'] ?? 'chưa có', $s['conduct'] ?? 'chưa có'
                );
                DB::table('sm_emu_proposals')->insert([
                    'student_id' => $s['id'], 'class_id' => $ctx['class']->id, 'school_year_id' => $ctx['year']->id,
                    'semester' => $sem, 'award_id' => $award->id, 'reason' => $reason,
                    'snap_score' => $s['score'], 'snap_gpa' => $s['gpa'], 'snap_conduct' => $s['conduct'],
                    'status' => 'draft', 'proposed_by' => $ctx['actor']['teacher_id'],
                ]);
                $created++;
                $this->log($ctx, 'proposal.create', "Lập đề xuất «{$award->name}» cho {$s['full_name']}");
            }
        });

        return ['created' => $created, 'skipped' => $skipped];
    }

    private function findProposal(array $ctx, int $id): object
    {
        $p = DB::table('sm_emu_proposals')->where('id', $id)->where('class_id', $ctx['class']->id)->first();
        if (! $p) {
            throw new EmuException('Không tìm thấy đề xuất.', 404);
        }

        return $p;
    }

    public function updateProposal(array $ctx, int $id, string $reason): void
    {
        $p = $this->findProposal($ctx, $id);
        if (! in_array($p->status, ['draft', 'rejected'], true)) {
            throw new EmuException('Chỉ sửa được đề xuất ở trạng thái Nháp hoặc Bị từ chối.', 409);
        }
        DB::table('sm_emu_proposals')->where('id', $id)->update(['reason' => $reason]);
    }

    public function submitProposals(array $ctx, array $ids): int
    {
        $n = 0;
        DB::transaction(function () use ($ctx, $ids, &$n) {
            foreach ($ids as $id) {
                $p = $this->findProposal($ctx, (int) $id);
                if (! in_array($p->status, ['draft', 'rejected'], true)) {
                    continue;
                }
                if (! trim((string) $p->reason)) {
                    throw new EmuException('Đề xuất cần có lý do trước khi gửi Ban giám hiệu.', 422);
                }
                DB::table('sm_emu_proposals')->where('id', $p->id)->update(['status' => 'submitted', 'submitted_at' => now(), 'review_note' => null]);
                $n++;
            }
            if ($n) {
                $this->log($ctx, 'proposal.submit', "Gửi Ban giám hiệu duyệt {$n} đề xuất khen thưởng");
            }
        });

        return $n;
    }

    public function cancelProposal(array $ctx, int $id): void
    {
        $p = $this->findProposal($ctx, $id);
        if (! in_array($p->status, ['draft', 'submitted'], true)) {
            throw new EmuException('Không thể hủy đề xuất ở trạng thái hiện tại.', 409);
        }
        DB::table('sm_emu_proposals')->where('id', $id)->update(['status' => 'cancelled']);
        $this->log($ctx, 'proposal.cancel', 'Hủy một đề xuất khen thưởng');
    }

    public function destroyProposal(array $ctx, int $id): void
    {
        $p = $this->findProposal($ctx, $id);
        if (! in_array($p->status, ['draft', 'cancelled'], true)) {
            throw new EmuException('Chỉ xóa được đề xuất Nháp hoặc đã Hủy.', 409);
        }
        DB::table('sm_emu_proposals')->where('id', $id)->delete();
    }

    public function reviewProposal(array $ctx, int $id, string $decision, ?string $note, ?string $decisionNo): void
    {
        if (! in_array($ctx['actor']['role'], self::REVIEW_ROLES, true)) {
            throw new EmuException('Chỉ Ban giám hiệu mới có quyền duyệt khen thưởng.', 403);
        }
        $p = $this->findProposal($ctx, $id);
        if ($p->status !== 'submitted') {
            throw new EmuException('Đề xuất chưa ở trạng thái chờ duyệt.', 409);
        }
        if ($decision === 'rejected' && ! trim((string) $note)) {
            throw new EmuException('Vui lòng nhập lý do từ chối.', 422);
        }
        DB::table('sm_emu_proposals')->where('id', $id)->update([
            'status' => $decision, 'reviewed_by_name' => $ctx['actor']['name'], 'reviewed_at' => now(),
            'review_note' => $note, 'decision_no' => $decision === 'approved' ? $decisionNo : null,
        ]);
        $this->log($ctx, 'proposal.' . $decision, ($decision === 'approved' ? 'BGH đã duyệt' : 'BGH từ chối') . ' một đề xuất khen thưởng');
    }

    /* ------------------------------------------------------------------ */
    /* Tiêu chí                                                            */
    /* ------------------------------------------------------------------ */

    public function saveCriterion(array $ctx, ?int $id, array $d): void
    {
        if (! $ctx['is_admin']) {
            throw new EmuException('Bạn không có quyền chỉnh sửa tiêu chí thi đua.', 403);
        }
        $data = [
            'name' => $d['name'], 'category' => $d['category'], 'points' => (int) $d['points'],
            'is_active' => ! empty($d['is_active']) ? 1 : 0,
        ];
        if ($id) {
            DB::table('sm_emu_criteria')->where('id', $id)->update($data);
        } else {
            $data['code'] = 'TC' . strtoupper(substr(md5(uniqid('', true)), 0, 6));
            $data['sort_order'] = (int) DB::table('sm_emu_criteria')->max('sort_order') + 1;
            DB::table('sm_emu_criteria')->insert($data);
        }
        $this->log($ctx, 'criteria.save', ($id ? 'Cập nhật' : 'Thêm') . " tiêu chí «{$d['name']}»");
    }

    /* ------------------------------------------------------------------ */
    /* Nhật ký                                                             */
    /* ------------------------------------------------------------------ */

    public function activity(array $ctx, int $limit = 60): array
    {
        return DB::table('sm_emu_activity')->where('class_id', $ctx['class']->id)
            ->orderByDesc('id')->limit(min($limit, 200))->get(['id', 'actor_name', 'action', 'summary', 'created_at'])->all();
    }

    private function log(array $ctx, string $action, string $summary): void
    {
        DB::table('sm_emu_activity')->insert([
            'class_id' => $ctx['class']->id, 'school_year_id' => $ctx['year']->id,
            'actor_name' => $ctx['actor']['name'], 'action' => $action, 'summary' => mb_substr($summary, 0, 255), 'created_at' => now(),
        ]);
    }
}
