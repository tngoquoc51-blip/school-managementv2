<?php

namespace Modules\TeacherExam\Services;

use Illuminate\Support\Facades\DB;
use Modules\TeacherExam\Exceptions\ExamException;

/**
 * Nghiệp vụ "Kiểm tra" của giáo viên bộ môn:
 * bài kiểm tra, nhập điểm, đồng bộ sổ điểm, phân tích, lịch, tổng quan.
 */
class TeacherExamService
{
    public const ADMIN_ROLES = ['super_admin', 'principal', 'vice_principal', 'academic'];

    public const KINDS = [
        'tx15' => ['label' => 'Kiểm tra 15 phút', 'columns' => ['tx1', 'tx2', 'tx3', 'tx4'], 'minutes' => 15],
        'tx45' => ['label' => 'Kiểm tra 1 tiết', 'columns' => ['tx1', 'tx2', 'tx3', 'tx4'], 'minutes' => 45],
        'gk' => ['label' => 'Giữa học kỳ', 'columns' => ['gk'], 'minutes' => 90],
        'ck' => ['label' => 'Cuối học kỳ', 'columns' => ['ck'], 'minutes' => 90],
    ];

    public const COLUMNS = [
        'tx1' => 'Thường xuyên 1', 'tx2' => 'Thường xuyên 2', 'tx3' => 'Thường xuyên 3',
        'tx4' => 'Thường xuyên 4', 'gk' => 'Giữa kỳ', 'ck' => 'Cuối kỳ',
    ];

    public const STATUSES = ['draft' => 'Nháp', 'scheduled' => 'Đã lên lịch', 'grading' => 'Đang chấm', 'done' => 'Hoàn tất'];

    public const BANDS = [
        ['key' => 'excellent', 'label' => 'Giỏi (≥ 8.0)', 'min' => 8.0, 'color' => '#0E9F6E'],
        ['key' => 'good', 'label' => 'Khá (6.5 – 7.9)', 'min' => 6.5, 'color' => '#3B82F6'],
        ['key' => 'average', 'label' => 'Trung bình (5.0 – 6.4)', 'min' => 5.0, 'color' => '#F59E0B'],
        ['key' => 'weak', 'label' => 'Yếu (3.5 – 4.9)', 'min' => 3.5, 'color' => '#F97316'],
        ['key' => 'poor', 'label' => 'Kém (< 3.5)', 'min' => -1, 'color' => '#EF4444'],
    ];

    /* ------------------------------------------------------------------ */
    /* Ngữ cảnh                                                            */
    /* ------------------------------------------------------------------ */

    public function context(array $actor, ?int $teacherParam): array
    {
        $isAdmin = in_array($actor['role'], self::ADMIN_ROLES, true);
        $tid = ($isAdmin && $teacherParam) ? $teacherParam : $actor['teacher_id'];
        if (! $tid) {
            throw new ExamException('Tài khoản này chưa gắn với giáo viên bộ môn.', 403);
        }
        $teacher = DB::table('sm_teachers as t')->leftJoin('sm_subjects as s', 's.id', '=', 't.main_subject_id')
            ->where('t.id', $tid)->first(['t.id', 't.code', 't.full_name', 's.name as main_subject']);
        if (! $teacher) {
            throw new ExamException('Không tìm thấy giáo viên.', 404);
        }
        $year = DB::table('sm_school_years')->where('is_current', 1)->first() ?? DB::table('sm_school_years')->orderByDesc('id')->first();
        if (! $year) {
            throw new ExamException('Chưa cấu hình năm học.', 422);
        }
        $assignments = DB::table('sm_class_subjects as cs')
            ->join('sm_classes as c', 'c.id', '=', 'cs.class_id')
            ->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->where('cs.teacher_id', $tid)->where('c.school_year_id', $year->id)
            ->orderBy('c.grade')->orderBy('c.name')->orderBy('s.sort_order')
            ->get(['cs.id as cs_id', 'c.id as class_id', 'c.name as class_name', 'c.grade', 's.id as subject_id', 's.name as subject_name'])
            ->map(fn ($a) => (array) $a)->all();

        return ['actor' => $actor, 'teacher' => $teacher, 'year' => $year, 'assignments' => $assignments, 'is_admin' => $isAdmin];
    }

    private function semesters(object $year): array
    {
        return DB::table('sm_semesters')->where('school_year_id', $year->id)->orderBy('code')->get()->all();
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

    private function owns(array $ctx, int $classId, int $subjectId): bool
    {
        foreach ($ctx['assignments'] as $a) {
            if ((int) $a['class_id'] === $classId && (int) $a['subject_id'] === $subjectId) {
                return true;
            }
        }

        return false;
    }

    private function classStudents(array $ctx, int $classId)
    {
        return DB::table('sm_enrollments as e')->join('sm_students as s', 's.id', '=', 'e.student_id')
            ->where('e.class_id', $classId)->where('e.school_year_id', $ctx['year']->id)
            ->orderByRaw("SUBSTRING_INDEX(s.full_name, ' ', -1), s.full_name")->get(['s.id', 's.code', 's.full_name']);
    }

    private function log(array $ctx, string $action, string $summary): void
    {
        DB::table('sm_tch_activity')->insert([
            'teacher_id' => $ctx['teacher']->id, 'action' => $action, 'summary' => mb_substr($summary, 0, 255), 'created_at' => now(),
        ]);
    }

    public function meta(array $ctx): array
    {
        $y = $ctx['year'];
        $sems = $this->semesters($y);
        $cur = collect($sems)->firstWhere('is_current', 1);
        $subjects = collect($ctx['assignments'])->unique('subject_id')->map(fn ($a) => ['id' => (int) $a['subject_id'], 'name' => $a['subject_name']])->values();

        return [
            'teacher' => ['id' => (int) $ctx['teacher']->id, 'code' => $ctx['teacher']->code, 'full_name' => $ctx['teacher']->full_name, 'main_subject' => $ctx['teacher']->main_subject],
            'is_admin' => $ctx['is_admin'],
            'school_year' => ['id' => (int) $y->id, 'label' => $y->label, 'start_date' => $y->start_date, 'end_date' => $y->end_date],
            'semesters' => array_map(fn ($s) => ['code' => (int) $s->code, 'name' => $s->name, 'start_date' => $s->start_date, 'end_date' => $s->end_date, 'is_current' => (bool) $s->is_current], $sems),
            'current_semester' => $cur ? (int) $cur->code : 1,
            'assignments' => $ctx['assignments'],
            'subjects' => $subjects,
            'kinds' => collect(self::KINDS)->map(fn ($k, $key) => ['key' => $key] + $k)->values(),
            'columns' => self::COLUMNS,
            'statuses' => self::STATUSES,
            'bands' => self::BANDS,
            'today' => date('Y-m-d'),
        ];
    }

    /* ------------------------------------------------------------------ */
    /* Bài kiểm tra                                                        */
    /* ------------------------------------------------------------------ */

    private function testsQuery(array $ctx)
    {
        return DB::table('sm_tch_tests as t')
            ->join('sm_classes as c', 'c.id', '=', 't.class_id')
            ->join('sm_subjects as s', 's.id', '=', 't.subject_id')
            ->leftJoin(DB::raw('(SELECT test_id, COUNT(score) AS scored, SUM(absent) AS absent_n, AVG(score) AS avg_s FROM sm_tch_scores GROUP BY test_id) sc'), 'sc.test_id', '=', 't.id')
            ->where('t.teacher_id', $ctx['teacher']->id)->where('t.school_year_id', $ctx['year']->id)
            ->selectRaw('t.*, c.name AS class_name, c.grade, s.name AS subject_name, sc.scored, sc.absent_n, sc.avg_s,
                (SELECT COUNT(*) FROM sm_enrollments e WHERE e.class_id = t.class_id AND e.school_year_id = t.school_year_id) AS student_count');
    }

    private function fmtTest(object $r): array
    {
        $max = (float) $r->max_score;

        return [
            'id' => (int) $r->id, 'title' => $r->title, 'kind' => $r->kind, 'grade_column' => $r->grade_column,
            'test_date' => $r->test_date, 'start_time' => $r->start_time ? substr($r->start_time, 0, 5) : null,
            'duration_minutes' => (int) $r->duration_minutes, 'max_score' => $max, 'status' => $r->status, 'note' => $r->note,
            'paper_id' => $r->paper_id ? (int) $r->paper_id : null, 'synced_at' => $r->synced_at, 'semester' => (int) $r->semester,
            'class_id' => (int) $r->class_id, 'class_name' => $r->class_name, 'grade' => (int) $r->grade,
            'subject_id' => (int) $r->subject_id, 'subject_name' => $r->subject_name,
            'student_count' => (int) $r->student_count, 'scored' => (int) ($r->scored ?? 0), 'absent' => (int) ($r->absent_n ?? 0),
            'avg' => ($r->avg_s !== null && $max > 0) ? round((float) $r->avg_s / $max * 10, 2) : null,
        ];
    }

    public function tests(array $ctx, array $f): array
    {
        $q = $this->testsQuery($ctx);
        foreach (['class_id' => 't.class_id', 'subject_id' => 't.subject_id', 'status' => 't.status'] as $k => $col) {
            if (! empty($f[$k])) {
                $q->where($col, $f[$k]);
            }
        }
        if (! empty($f['semester'])) {
            $q->where('t.semester', (int) $f['semester']);
        }
        if (! empty($f['q'])) {
            $q->where('t.title', 'like', '%' . str_replace(['%', '_'], ['\%', '\_'], trim($f['q'])) . '%');
        }

        return $q->orderByDesc('t.test_date')->orderByDesc('t.id')->get()->map(fn ($r) => $this->fmtTest($r))->all();
    }

    private function findTest(array $ctx, int $id): object
    {
        $r = $this->testsQuery($ctx)->where('t.id', $id)->first();
        if (! $r) {
            throw new ExamException('Không tìm thấy bài kiểm tra.', 404);
        }

        return $r;
    }

    private function validateTestData(array $ctx, array $d, ?object $existing): array
    {
        $kind = $d['kind'];
        if (! isset(self::KINDS[$kind])) {
            throw new ExamException('Loại bài kiểm tra không hợp lệ.', 422);
        }
        if (! in_array($d['grade_column'], self::KINDS[$kind]['columns'], true)) {
            throw new ExamException('Cột điểm không phù hợp với loại bài kiểm tra.', 422);
        }
        $y = $ctx['year'];
        if ($d['test_date'] < $y->start_date || $d['test_date'] > $y->end_date) {
            throw new ExamException("Ngày kiểm tra phải trong năm học {$y->label}.", 422);
        }
        if (! empty($d['paper_id'])) {
            $ok = DB::table('sm_tch_papers')->where('id', $d['paper_id'])->where('teacher_id', $ctx['teacher']->id)->exists();
            if (! $ok) {
                throw new ExamException('Đề kiểm tra không tồn tại.', 422);
            }
        }

        return [
            'title' => trim($d['title']), 'kind' => $kind, 'grade_column' => $d['grade_column'], 'test_date' => $d['test_date'],
            'start_time' => $d['start_time'] ?: null, 'duration_minutes' => (int) $d['duration_minutes'],
            'max_score' => (float) $d['max_score'], 'paper_id' => $d['paper_id'] ?: null, 'note' => $d['note'] ?? null,
            'semester' => $this->semesterOf($ctx, $d['test_date']),
        ];
    }

    public function createTest(array $ctx, array $d): array
    {
        if (! $this->owns($ctx, (int) $d['class_id'], (int) $d['subject_id'])) {
            throw new ExamException('Bạn không được phân công dạy môn này ở lớp đã chọn.', 403);
        }
        $row = $this->validateTestData($ctx, $d, null) + [
            'teacher_id' => $ctx['teacher']->id, 'school_year_id' => $ctx['year']->id,
            'class_id' => $d['class_id'], 'subject_id' => $d['subject_id'],
            'status' => ($d['status'] ?? 'scheduled') === 'draft' ? 'draft' : 'scheduled',
            'created_at' => now(), 'updated_at' => now(),
        ];
        $id = DB::table('sm_tch_tests')->insertGetId($row);
        $this->log($ctx, 'test.create', "Tạo bài «{$row['title']}»");

        return ['id' => $id];
    }

    public function updateTest(array $ctx, int $id, array $d): void
    {
        $t = $this->findTest($ctx, $id);
        if ($t->status === 'done') {
            throw new ExamException('Bài đã hoàn tất. Hãy mở lại bài trước khi chỉnh sửa.', 409);
        }
        $row = $this->validateTestData($ctx, $d, $t);
        if ((float) $t->max_score !== $row['max_score'] && (int) ($t->scored ?? 0) > 0) {
            throw new ExamException('Bài đã có điểm nên không thể đổi thang điểm.', 409);
        }
        if (in_array($d['status'] ?? '', ['draft', 'scheduled'], true) && $t->status !== 'grading') {
            $row['status'] = $d['status'];
        }
        DB::table('sm_tch_tests')->where('id', $id)->update($row + ['updated_at' => now()]);
        $this->log($ctx, 'test.update', "Cập nhật bài «{$row['title']}»");
    }

    public function deleteTest(array $ctx, int $id): void
    {
        $t = $this->findTest($ctx, $id);
        if ($t->status === 'done' || $t->synced_at) {
            throw new ExamException('Không thể xóa bài đã hoàn tất hoặc đã đồng bộ vào sổ điểm.', 409);
        }
        DB::table('sm_tch_tests')->where('id', $id)->delete();
        $this->log($ctx, 'test.delete', "Xóa bài «{$t->title}»");
    }

    /* ------------------------------------------------------------------ */
    /* Nhập điểm                                                           */
    /* ------------------------------------------------------------------ */

    public function sheet(array $ctx, int $id): array
    {
        $t = $this->findTest($ctx, $id);
        $scores = DB::table('sm_tch_scores')->where('test_id', $id)->get()->keyBy('student_id');
        $col = $t->grade_column; // đã được kiểm tra trong tập cố định
        $current = DB::table('sm_grades')->where('class_id', $t->class_id)->where('school_year_id', $t->school_year_id)
            ->where('semester', $t->semester)->where('subject_id', $t->subject_id)->pluck($col, 'student_id');

        $students = $this->classStudents($ctx, (int) $t->class_id)->map(function ($s) use ($scores, $current) {
            $sc = $scores[$s->id] ?? null;

            return [
                'student_id' => (int) $s->id, 'code' => $s->code, 'full_name' => $s->full_name,
                'score' => $sc && $sc->score !== null ? (float) $sc->score : null,
                'absent' => (bool) ($sc->absent ?? false), 'note' => $sc->note ?? null,
                'current' => isset($current[$s->id]) && $current[$s->id] !== null ? (float) $current[$s->id] : null,
            ];
        })->all();

        return ['test' => $this->fmtTest($t), 'students' => $students];
    }

    public function saveScores(array $ctx, int $id, array $rows): array
    {
        $t = $this->findTest($ctx, $id);
        if ($t->status === 'done') {
            throw new ExamException('Bài đã hoàn tất. Hãy mở lại bài trước khi sửa điểm.', 409);
        }
        $allowed = $this->classStudents($ctx, (int) $t->class_id)->pluck('id')->flip();
        $max = (float) $t->max_score;
        $payload = [];
        foreach ($rows as $r) {
            $sid = (int) $r['student_id'];
            if (! isset($allowed[$sid])) {
                throw new ExamException('Có học sinh không thuộc lớp của bài kiểm tra.', 422);
            }
            $absent = ! empty($r['absent']);
            $score = ($absent || ! isset($r['score']) || $r['score'] === '' || $r['score'] === null) ? null : round((float) $r['score'], 1);
            if ($score !== null && ($score < 0 || $score > $max)) {
                throw new ExamException("Điểm phải nằm trong khoảng 0 – {$max}.", 422);
            }
            $payload[] = ['test_id' => $id, 'student_id' => $sid, 'score' => $score, 'absent' => $absent ? 1 : 0, 'note' => $r['note'] ?? null, 'updated_at' => now()];
        }
        DB::transaction(function () use ($payload, $id, $t) {
            if ($payload) {
                DB::table('sm_tch_scores')->upsert($payload, ['test_id', 'student_id'], ['score', 'absent', 'note', 'updated_at']);
            }
            if (in_array($t->status, ['draft', 'scheduled'], true)) {
                DB::table('sm_tch_tests')->where('id', $id)->update(['status' => 'grading']);
            }
            if ($t->synced_at) {
                DB::table('sm_tch_tests')->where('id', $id)->update(['synced_at' => null]);
            }
        });
        $this->log($ctx, 'score.save', "Lưu điểm «{$t->title}» lớp {$t->class_name} (" . count($payload) . ' học sinh)');

        return ['saved' => count($payload)];
    }

    public function setStatus(array $ctx, int $id, string $status): void
    {
        $t = $this->findTest($ctx, $id);
        if ($status === 'done') {
            $missing = (int) $t->student_count - (int) ($t->scored ?? 0) - (int) ($t->absent_n ?? 0);
            if ($missing > 0) {
                throw new ExamException("Còn {$missing} học sinh chưa có điểm hoặc chưa đánh dấu vắng.", 422);
            }
        } elseif (! in_array($status, ['grading', 'scheduled'], true)) {
            throw new ExamException('Trạng thái không hợp lệ.', 422);
        }
        DB::table('sm_tch_tests')->where('id', $id)->update(['status' => $status]);
        $this->log($ctx, 'test.status', ($status === 'done' ? 'Hoàn tất' : 'Mở lại') . " bài «{$t->title}»");
    }

    private function computeTbm(array $v): ?float
    {
        $tx = array_values(array_filter([$v['tx1'] ?? null, $v['tx2'] ?? null, $v['tx3'] ?? null, $v['tx4'] ?? null], fn ($x) => $x !== null));
        if (($v['gk'] ?? null) === null || ($v['ck'] ?? null) === null) {
            return null;
        }

        // Thông tư 22/2021: (ΣTX + 2×GK + 3×CK) / (số TX + 5)
        return round((array_sum(array_map('floatval', $tx)) + 2 * (float) $v['gk'] + 3 * (float) $v['ck']) / (count($tx) + 5), 1);
    }

    public function sync(array $ctx, int $id): array
    {
        $t = $this->findTest($ctx, $id);
        if ($t->status !== 'done') {
            throw new ExamException('Hãy hoàn tất bài kiểm tra trước khi đồng bộ vào sổ điểm.', 409);
        }
        $col = $t->grade_column;
        $max = (float) $t->max_score;
        $scores = DB::table('sm_tch_scores')->where('test_id', $id)->whereNotNull('score')->where('absent', 0)->get();
        $upd = $ins = 0;

        DB::transaction(function () use ($scores, $t, $col, $max, &$upd, &$ins) {
            foreach ($scores as $s) {
                $scaled = round((float) $s->score / $max * 10, 1);
                $key = ['student_id' => $s->student_id, 'school_year_id' => $t->school_year_id, 'semester' => $t->semester, 'subject_id' => $t->subject_id];
                $row = DB::table('sm_grades')->where($key)->first();
                if ($row) {
                    $vals = (array) $row;
                    $vals[$col] = $scaled;
                    $tbm = $this->computeTbm($vals);
                    DB::table('sm_grades')->where('id', $row->id)->update([$col => $scaled, 'tbm' => $tbm ?? $row->tbm, 'updated_at' => now()]);
                    $upd++;
                } else {
                    DB::table('sm_grades')->insert($key + ['class_id' => $t->class_id, 'teacher_id' => $t->teacher_id, $col => $scaled, 'tbm' => null, 'updated_at' => now()]);
                    $ins++;
                }
            }
            DB::table('sm_tch_tests')->where('id', $t->id)->update(['synced_at' => now()]);
        });
        $this->log($ctx, 'score.sync', "Đồng bộ «{$t->title}» vào sổ điểm cột " . strtoupper($col) . " ({$upd} cập nhật, {$ins} thêm mới)");

        return ['updated' => $upd, 'inserted' => $ins, 'column' => $col];
    }

    /* ------------------------------------------------------------------ */
    /* Phân tích                                                           */
    /* ------------------------------------------------------------------ */

    private function bandOf(float $v): string
    {
        foreach (self::BANDS as $b) {
            if ($v >= $b['min']) {
                return $b['key'];
            }
        }

        return 'poor';
    }

    public function analytics(array $ctx, int $id): array
    {
        $t = $this->findTest($ctx, $id);
        $max = (float) $t->max_score;
        $rows = DB::table('sm_tch_scores as sc')->join('sm_students as s', 's.id', '=', 'sc.student_id')
            ->where('sc.test_id', $id)->whereNotNull('sc.score')->get(['s.id', 's.code', 's.full_name', 'sc.score']);
        $vals = $rows->map(fn ($r) => round((float) $r->score / $max * 10, 2))->sort()->values()->all();
        $n = count($vals);
        $avg = $n ? array_sum($vals) / $n : null;
        $median = $n ? ($n % 2 ? $vals[intdiv($n, 2)] : ($vals[$n / 2 - 1] + $vals[$n / 2]) / 2) : null;
        $std = $n ? sqrt(array_sum(array_map(fn ($v) => ($v - $avg) ** 2, $vals)) / $n) : null;

        $bins = array_fill(0, 10, 0);
        $bands = array_fill_keys(array_column(self::BANDS, 'key'), 0);
        foreach ($vals as $v) {
            $bins[min(9, (int) floor($v))]++;
            $bands[$this->bandOf($v)]++;
        }

        $students = $rows->map(fn ($r) => ['student_id' => (int) $r->id, 'code' => $r->code, 'full_name' => $r->full_name, 'score10' => round((float) $r->score / $max * 10, 2)])->sortByDesc('score10')->values();

        $trend = DB::select('SELECT t.id, t.title, t.test_date, t.kind, AVG(sc.score / t.max_score * 10) AS avg_s, COUNT(sc.score) AS n
            FROM sm_tch_tests t JOIN sm_tch_scores sc ON sc.test_id = t.id AND sc.score IS NOT NULL
            WHERE t.teacher_id = ? AND t.class_id = ? AND t.subject_id = ? AND t.school_year_id = ?
            GROUP BY t.id, t.title, t.test_date, t.kind ORDER BY t.test_date, t.id',
            [$ctx['teacher']->id, $t->class_id, $t->subject_id, $t->school_year_id]);

        return [
            'test' => $this->fmtTest($t),
            'count' => $n, 'absent' => (int) ($t->absent_n ?? 0), 'ungraded' => max(0, (int) $t->student_count - $n - (int) ($t->absent_n ?? 0)),
            'avg' => $avg !== null ? round($avg, 2) : null, 'median' => $median !== null ? round($median, 2) : null,
            'min' => $n ? $vals[0] : null, 'max' => $n ? $vals[$n - 1] : null, 'std' => $std !== null ? round($std, 2) : null,
            'pass_rate' => $n ? round(count(array_filter($vals, fn ($v) => $v >= 5)) / $n * 100, 1) : null,
            'histogram' => $bins,
            'bands' => array_map(fn ($b) => ['key' => $b['key'], 'label' => $b['label'], 'color' => $b['color'], 'count' => $bands[$b['key']]], self::BANDS),
            'top' => $students->take(5)->all(),
            'bottom' => $students->reverse()->take(5)->values()->all(),
            'below5' => $students->filter(fn ($s) => $s['score10'] < 5)->count(),
            'trend' => array_map(fn ($x) => ['id' => (int) $x->id, 'title' => $x->title, 'test_date' => $x->test_date, 'kind' => $x->kind, 'avg' => round((float) $x->avg_s, 2), 'n' => (int) $x->n], $trend),
        ];
    }

    public function matrix(array $ctx, int $classId, int $subjectId, int $sem): array
    {
        if (! $this->owns($ctx, $classId, $subjectId)) {
            throw new ExamException('Bạn không được phân công dạy môn này ở lớp đã chọn.', 403);
        }
        $tests = DB::table('sm_tch_tests')->where('teacher_id', $ctx['teacher']->id)->where('school_year_id', $ctx['year']->id)
            ->where('class_id', $classId)->where('subject_id', $subjectId)->whereIn('status', ['grading', 'done'])
            ->when($sem > 0, fn ($q) => $q->where('semester', $sem))->orderBy('test_date')->orderBy('id')->get();
        $ids = $tests->pluck('id')->all();
        $map = [];
        if ($ids) {
            foreach (DB::table('sm_tch_scores')->whereIn('test_id', $ids)->get() as $s) {
                $map[$s->test_id][$s->student_id] = $s;
            }
        }
        $maxBy = $tests->pluck('max_score', 'id');
        $students = $this->classStudents($ctx, $classId)->map(function ($st) use ($tests, $map, $maxBy) {
            $cells = [];
            $sum = 0;
            $cnt = 0;
            foreach ($tests as $t) {
                $s = $map[$t->id][$st->id] ?? null;
                if ($s && $s->absent) {
                    $cells[] = ['v' => null, 'absent' => true];
                } elseif ($s && $s->score !== null) {
                    $v = round((float) $s->score / (float) $maxBy[$t->id] * 10, 1);
                    $cells[] = ['v' => $v, 'absent' => false];
                    $sum += $v;
                    $cnt++;
                } else {
                    $cells[] = ['v' => null, 'absent' => false];
                }
            }

            return ['student_id' => (int) $st->id, 'code' => $st->code, 'full_name' => $st->full_name, 'cells' => $cells, 'avg' => $cnt ? round($sum / $cnt, 2) : null];
        })->all();

        $colAvg = [];
        foreach ($tests as $i => $t) {
            $vs = array_filter(array_map(fn ($s) => $s['cells'][$i]['v'], $students), fn ($v) => $v !== null);
            $colAvg[] = $vs ? round(array_sum($vs) / count($vs), 2) : null;
        }

        return [
            'tests' => $tests->map(fn ($t) => ['id' => (int) $t->id, 'title' => $t->title, 'test_date' => $t->test_date, 'kind' => $t->kind])->all(),
            'students' => $students, 'column_avg' => $colAvg,
        ];
    }

    /* ------------------------------------------------------------------ */
    /* Lịch + tổng quan                                                    */
    /* ------------------------------------------------------------------ */

    /** Lịch kiểm tra chính thức do nhà trường lập (sm_exam_schedules) cho các lớp/môn tôi dạy */
    private function official(array $ctx, string $from, string $to): array
    {
        $rows = DB::select('SELECT es.id, es.exam_date, es.start_time, es.duration_minutes, es.exam_format,
                p.name AS period_name, p.code AS period_code, c.id AS class_id, c.name AS class_name, s.id AS subject_id, s.name AS subject_name
            FROM sm_exam_schedules es
            JOIN sm_exam_periods p ON p.id = es.exam_period_id
            JOIN sm_class_subjects cs ON cs.subject_id = es.subject_id AND cs.teacher_id = ?
            JOIN sm_classes c ON c.id = cs.class_id AND c.grade = es.grade AND c.school_year_id = p.school_year_id
            JOIN sm_subjects s ON s.id = es.subject_id
            WHERE p.school_year_id = ? AND es.exam_date BETWEEN ? AND ?
            ORDER BY es.exam_date, es.start_time, c.name', [$ctx['teacher']->id, $ctx['year']->id, $from, $to]);

        return array_map(fn ($r) => [
            'key' => 'o' . $r->id . '-' . $r->class_id, 'type' => 'official', 'date' => $r->exam_date,
            'start_time' => substr($r->start_time, 0, 5), 'duration_minutes' => (int) $r->duration_minutes,
            'title' => $r->period_name, 'sub' => $r->exam_format, 'class_id' => (int) $r->class_id, 'class_name' => $r->class_name,
            'subject_id' => (int) $r->subject_id, 'subject_name' => $r->subject_name, 'test_id' => null, 'status' => null,
        ], $rows);
    }

    public function calendar(array $ctx, string $from, string $to): array
    {
        $events = $this->official($ctx, $from, $to);
        $tests = $this->testsQuery($ctx)->whereBetween('t.test_date', [$from, $to])->get();
        foreach ($tests as $r) {
            $events[] = [
                'key' => 't' . $r->id, 'type' => 'test', 'date' => $r->test_date, 'start_time' => $r->start_time ? substr($r->start_time, 0, 5) : null,
                'duration_minutes' => (int) $r->duration_minutes, 'title' => $r->title, 'sub' => self::KINDS[$r->kind]['label'] ?? $r->kind,
                'class_id' => (int) $r->class_id, 'class_name' => $r->class_name, 'subject_id' => (int) $r->subject_id,
                'subject_name' => $r->subject_name, 'test_id' => (int) $r->id, 'status' => $r->status,
            ];
        }
        usort($events, fn ($a, $b) => [$a['date'], $a['start_time'] ?? ''] <=> [$b['date'], $b['start_time'] ?? '']);

        return $events;
    }

    public function overview(array $ctx, int $sem): array
    {
        $y = $ctx['year'];
        $today = date('Y-m-d');
        $tests = $this->tests($ctx, $sem > 0 ? ['semester' => $sem] : []);
        $official = $this->official($ctx, $y->start_date, $y->end_date);

        $upcoming = array_values(array_filter($official, fn ($e) => $e['date'] >= $today));
        $past = array_reverse(array_values(array_filter($official, fn ($e) => $e['date'] < $today)));

        $counts = ['draft' => 0, 'scheduled' => 0, 'grading' => 0, 'done' => 0];
        foreach ($tests as $t) {
            $counts[$t['status']]++;
        }
        $needGrading = array_values(array_filter($tests, fn ($t) => $t['test_date'] <= $today && in_array($t['status'], ['scheduled', 'grading'], true)));
        $upTests = array_values(array_filter($tests, fn ($t) => $t['test_date'] >= $today && in_array($t['status'], ['scheduled', 'draft'], true)));
        usort($upTests, fn ($a, $b) => $a['test_date'] <=> $b['test_date']);

        $semSql = $sem > 0 ? ' AND t.semester = ?' : '';
        $bind = [$ctx['teacher']->id, $y->id];
        if ($sem > 0) {
            $bind[] = $sem;
        }
        $classAvgs = DB::select("SELECT t.class_id, c.name AS class_name, c.grade, t.subject_id, s.name AS subject_name,
                AVG(sc.score / t.max_score * 10) AS avg_s, COUNT(sc.score) AS n,
                SUM(CASE WHEN sc.score / t.max_score * 10 >= 5 THEN 1 ELSE 0 END) AS pass_n
            FROM sm_tch_tests t JOIN sm_tch_scores sc ON sc.test_id = t.id AND sc.score IS NOT NULL
            JOIN sm_classes c ON c.id = t.class_id JOIN sm_subjects s ON s.id = t.subject_id
            WHERE t.teacher_id = ? AND t.school_year_id = ? $semSql
            GROUP BY t.class_id, c.name, c.grade, t.subject_id, s.name ORDER BY c.grade, c.name", $bind);

        $bandRows = DB::select("SELECT
                SUM(CASE WHEN v >= 8 THEN 1 ELSE 0 END) AS b1, SUM(CASE WHEN v >= 6.5 AND v < 8 THEN 1 ELSE 0 END) AS b2,
                SUM(CASE WHEN v >= 5 AND v < 6.5 THEN 1 ELSE 0 END) AS b3, SUM(CASE WHEN v >= 3.5 AND v < 5 THEN 1 ELSE 0 END) AS b4,
                SUM(CASE WHEN v < 3.5 THEN 1 ELSE 0 END) AS b5
            FROM (SELECT sc.score / t.max_score * 10 AS v FROM sm_tch_tests t JOIN sm_tch_scores sc ON sc.test_id = t.id AND sc.score IS NOT NULL
                  WHERE t.teacher_id = ? AND t.school_year_id = ? $semSql) x", $bind)[0] ?? null;
        $bandCounts = [(int) ($bandRows->b1 ?? 0), (int) ($bandRows->b2 ?? 0), (int) ($bandRows->b3 ?? 0), (int) ($bandRows->b4 ?? 0), (int) ($bandRows->b5 ?? 0)];

        return [
            'counts' => $counts + ['total' => count($tests)],
            'need_grading' => array_slice($needGrading, 0, 6),
            'upcoming_tests' => array_slice($upTests, 0, 5),
            'upcoming_official' => array_slice($upcoming, 0, 6),
            'past_official' => array_slice($past, 0, 4),
            'class_avgs' => array_map(fn ($r) => [
                'class_id' => (int) $r->class_id, 'class_name' => $r->class_name, 'subject_id' => (int) $r->subject_id, 'subject_name' => $r->subject_name,
                'avg' => round((float) $r->avg_s, 2), 'n' => (int) $r->n, 'pass_rate' => $r->n ? round($r->pass_n / $r->n * 100, 1) : null,
            ], $classAvgs),
            'bands' => array_map(fn ($b, $i) => ['key' => $b['key'], 'label' => $b['label'], 'color' => $b['color'], 'count' => $bandCounts[$i]], self::BANDS, array_keys(self::BANDS)),
            'questions' => (int) DB::table('sm_tch_questions')->where('teacher_id', $ctx['teacher']->id)->where('is_active', 1)->count(),
            'papers' => (int) DB::table('sm_tch_papers')->where('teacher_id', $ctx['teacher']->id)->count(),
            'recent' => array_slice(array_values(array_filter($tests, fn ($t) => in_array($t['status'], ['grading', 'done'], true))), 0, 5),
            'activity' => $this->activity($ctx, 8),
        ];
    }

    public function activity(array $ctx, int $limit = 40): array
    {
        return DB::table('sm_tch_activity')->where('teacher_id', $ctx['teacher']->id)->orderByDesc('id')->limit(min($limit, 100))
            ->get(['id', 'action', 'summary', 'created_at'])->all();
    }

    /* ------------------------------------------------------------------ */
    /* Ngân hàng câu hỏi                                                   */
    /* ------------------------------------------------------------------ */

    private function fmtQuestion(object $q): array
    {
        return [
            'id' => (int) $q->id, 'subject_id' => (int) $q->subject_id, 'subject_name' => $q->subject_name ?? null, 'grade' => (int) $q->grade,
            'kind' => $q->kind, 'difficulty' => $q->difficulty, 'topic' => $q->topic, 'content' => $q->content,
            'options' => $q->options ? json_decode($q->options, true) : null, 'answer' => $q->answer,
            'points' => (float) $q->points, 'is_active' => (bool) $q->is_active, 'created_at' => $q->created_at,
        ];
    }

    private function mySubjectIds(array $ctx): array
    {
        return array_values(array_unique(array_map(fn ($a) => (int) $a['subject_id'], $ctx['assignments'])));
    }

    public function questions(array $ctx, array $f): array
    {
        $page = max((int) ($f['page'] ?? 1), 1);
        $per = min(max((int) ($f['per_page'] ?? 15), 1), 100);
        $q = DB::table('sm_tch_questions as q')->join('sm_subjects as s', 's.id', '=', 'q.subject_id')->where('q.teacher_id', $ctx['teacher']->id);
        foreach (['subject_id' => 'q.subject_id', 'grade' => 'q.grade', 'kind' => 'q.kind', 'difficulty' => 'q.difficulty'] as $k => $col) {
            if (! empty($f[$k])) {
                $q->where($col, $f[$k]);
            }
        }
        if (isset($f['active']) && $f['active'] !== '') {
            $q->where('q.is_active', (int) $f['active']);
        }
        if (! empty($f['q'])) {
            $kw = '%' . str_replace(['%', '_'], ['\%', '\_'], trim($f['q'])) . '%';
            $q->where(fn ($w) => $w->where('q.content', 'like', $kw)->orWhere('q.topic', 'like', $kw));
        }
        $total = (clone $q)->count();
        $stats = (clone $q)->selectRaw("SUM(q.difficulty='easy') e, SUM(q.difficulty='medium') m, SUM(q.difficulty='hard') h")->first();
        $items = $q->orderByDesc('q.id')->forPage($page, $per)->get(['q.*', 's.name as subject_name'])->map(fn ($x) => $this->fmtQuestion($x))->all();

        return ['items' => $items, 'total' => $total, 'page' => $page, 'per_page' => $per,
            'by_difficulty' => ['easy' => (int) ($stats->e ?? 0), 'medium' => (int) ($stats->m ?? 0), 'hard' => (int) ($stats->h ?? 0)]];
    }

    private function questionData(array $ctx, array $d): array
    {
        if (! in_array((int) $d['subject_id'], $this->mySubjectIds($ctx), true)) {
            throw new ExamException('Bạn chỉ được soạn câu hỏi cho môn mình được phân công.', 403);
        }
        $options = null;
        if (in_array($d['kind'], ['mcq', 'truefalse'], true)) {
            $opts = array_values(array_filter(array_map('trim', $d['options'] ?? []), fn ($x) => $x !== ''));
            if (count($opts) < 2) {
                throw new ExamException('Câu trắc nghiệm cần ít nhất 2 phương án.', 422);
            }
            $options = json_encode($opts, JSON_UNESCAPED_UNICODE);
        }

        return [
            'subject_id' => (int) $d['subject_id'], 'grade' => (int) $d['grade'], 'kind' => $d['kind'], 'difficulty' => $d['difficulty'],
            'topic' => $d['topic'] ?? null, 'content' => trim($d['content']), 'options' => $options, 'answer' => $d['answer'] ?? null,
            'points' => (float) $d['points'], 'is_active' => ! empty($d['is_active']) ? 1 : 0,
        ];
    }

    public function createQuestion(array $ctx, array $d): array
    {
        $id = DB::table('sm_tch_questions')->insertGetId($this->questionData($ctx, $d) + ['teacher_id' => $ctx['teacher']->id, 'created_at' => now(), 'updated_at' => now()]);
        $this->log($ctx, 'question.create', 'Thêm câu hỏi vào ngân hàng đề');

        return ['id' => $id];
    }

    public function updateQuestion(array $ctx, int $id, array $d): void
    {
        $n = DB::table('sm_tch_questions')->where('id', $id)->where('teacher_id', $ctx['teacher']->id)->update($this->questionData($ctx, $d) + ['updated_at' => now()]);
        if (! $n && ! DB::table('sm_tch_questions')->where('id', $id)->where('teacher_id', $ctx['teacher']->id)->exists()) {
            throw new ExamException('Không tìm thấy câu hỏi.', 404);
        }
    }

    public function deleteQuestion(array $ctx, int $id): void
    {
        $q = DB::table('sm_tch_questions')->where('id', $id)->where('teacher_id', $ctx['teacher']->id)->first();
        if (! $q) {
            throw new ExamException('Không tìm thấy câu hỏi.', 404);
        }
        if (DB::table('sm_tch_paper_items')->where('question_id', $id)->exists()) {
            DB::table('sm_tch_questions')->where('id', $id)->update(['is_active' => 0]);
            throw new ExamException('Câu hỏi đang nằm trong đề đã soạn nên chỉ được ẩn, không xóa hẳn.', 409);
        }
        DB::table('sm_tch_questions')->where('id', $id)->delete();
    }

    /* ------------------------------------------------------------------ */
    /* Đề kiểm tra                                                         */
    /* ------------------------------------------------------------------ */

    /** Chọn ngẫu nhiên câu hỏi theo ma trận độ khó */
    public function generatePaper(array $ctx, array $d): array
    {
        if (! in_array((int) $d['subject_id'], $this->mySubjectIds($ctx), true)) {
            throw new ExamException('Bạn chỉ được tạo đề cho môn mình được phân công.', 403);
        }
        $picked = [];
        $shortage = [];
        $exclude = array_map('intval', $d['exclude'] ?? []);
        foreach (['easy', 'medium', 'hard'] as $lv) {
            $want = (int) ($d['matrix'][$lv] ?? 0);
            if ($want <= 0) {
                continue;
            }
            $q = DB::table('sm_tch_questions as q')->join('sm_subjects as s', 's.id', '=', 'q.subject_id')
                ->where('q.teacher_id', $ctx['teacher']->id)->where('q.is_active', 1)->where('q.subject_id', $d['subject_id'])
                ->where('q.grade', $d['grade'])->where('q.difficulty', $lv);
            if (! empty($d['kinds'])) {
                $q->whereIn('q.kind', $d['kinds']);
            }
            if ($exclude) {
                $q->whereNotIn('q.id', $exclude);
            }
            if (! empty($d['topic'])) {
                $q->where('q.topic', 'like', '%' . trim($d['topic']) . '%');
            }
            $rows = $q->inRandomOrder()->limit($want)->get(['q.*', 's.name as subject_name']);
            if ($rows->count() < $want) {
                $shortage[$lv] = $want - $rows->count();
            }
            foreach ($rows as $r) {
                $picked[] = $this->fmtQuestion($r);
            }
        }

        return ['items' => $picked, 'shortage' => $shortage, 'total_points' => round(array_sum(array_column($picked, 'points')), 1)];
    }

    public function createPaper(array $ctx, array $d): array
    {
        if (! in_array((int) $d['subject_id'], $this->mySubjectIds($ctx), true)) {
            throw new ExamException('Bạn chỉ được tạo đề cho môn mình được phân công.', 403);
        }
        $ids = array_map(fn ($i) => (int) $i['question_id'], $d['items']);
        $own = DB::table('sm_tch_questions')->whereIn('id', $ids)->where('teacher_id', $ctx['teacher']->id)->count();
        if ($own !== count(array_unique($ids))) {
            throw new ExamException('Có câu hỏi không thuộc ngân hàng của bạn.', 422);
        }
        $total = round(array_sum(array_map(fn ($i) => (float) $i['points'], $d['items'])), 1);

        $pid = DB::transaction(function () use ($ctx, $d, $total) {
            $pid = DB::table('sm_tch_papers')->insertGetId([
                'teacher_id' => $ctx['teacher']->id, 'subject_id' => $d['subject_id'], 'grade' => $d['grade'], 'title' => trim($d['title']),
                'duration_minutes' => (int) $d['duration_minutes'], 'total_points' => $total, 'created_at' => now(),
            ]);
            $rows = [];
            foreach (array_values($d['items']) as $i => $it) {
                $rows[] = ['paper_id' => $pid, 'question_id' => (int) $it['question_id'], 'position' => $i + 1, 'points' => (float) $it['points']];
            }
            DB::table('sm_tch_paper_items')->insert($rows);

            return $pid;
        });
        $this->log($ctx, 'paper.create', "Soạn đề «{$d['title']}» (" . count($d['items']) . ' câu)');

        return ['id' => $pid, 'total_points' => $total];
    }

    public function papers(array $ctx): array
    {
        return DB::table('sm_tch_papers as p')->join('sm_subjects as s', 's.id', '=', 'p.subject_id')
            ->where('p.teacher_id', $ctx['teacher']->id)
            ->selectRaw('p.id, p.title, p.grade, p.duration_minutes, p.total_points, p.created_at, s.name AS subject_name, p.subject_id,
                (SELECT COUNT(*) FROM sm_tch_paper_items i WHERE i.paper_id = p.id) AS question_count,
                (SELECT COUNT(*) FROM sm_tch_tests t WHERE t.paper_id = p.id) AS used_in')
            ->orderByDesc('p.id')->get()->map(fn ($r) => [
                'id' => (int) $r->id, 'title' => $r->title, 'grade' => (int) $r->grade, 'subject_id' => (int) $r->subject_id, 'subject_name' => $r->subject_name,
                'duration_minutes' => (int) $r->duration_minutes, 'total_points' => (float) $r->total_points,
                'question_count' => (int) $r->question_count, 'used_in' => (int) $r->used_in, 'created_at' => $r->created_at,
            ])->all();
    }

    public function paper(array $ctx, int $id): array
    {
        $p = DB::table('sm_tch_papers as p')->join('sm_subjects as s', 's.id', '=', 'p.subject_id')
            ->where('p.id', $id)->where('p.teacher_id', $ctx['teacher']->id)->first(['p.*', 's.name as subject_name']);
        if (! $p) {
            throw new ExamException('Không tìm thấy đề.', 404);
        }
        $items = DB::table('sm_tch_paper_items as i')->join('sm_tch_questions as q', 'q.id', '=', 'i.question_id')
            ->where('i.paper_id', $id)->orderBy('i.position')->get(['q.*', 'i.position', 'i.points as item_points']);

        return [
            'id' => (int) $p->id, 'title' => $p->title, 'subject_name' => $p->subject_name, 'grade' => (int) $p->grade,
            'duration_minutes' => (int) $p->duration_minutes, 'total_points' => (float) $p->total_points,
            'teacher_name' => $ctx['teacher']->full_name, 'school_year' => $ctx['year']->label,
            'items' => $items->map(fn ($q) => $this->fmtQuestion($q) + ['position' => (int) $q->position, 'points' => (float) $q->item_points])->all(),
        ];
    }

    public function deletePaper(array $ctx, int $id): void
    {
        $p = DB::table('sm_tch_papers')->where('id', $id)->where('teacher_id', $ctx['teacher']->id)->first();
        if (! $p) {
            throw new ExamException('Không tìm thấy đề.', 404);
        }
        if (DB::table('sm_tch_tests')->where('paper_id', $id)->exists()) {
            throw new ExamException('Đề đang được gắn với bài kiểm tra nên không thể xóa.', 409);
        }
        DB::table('sm_tch_papers')->where('id', $id)->delete();
        $this->log($ctx, 'paper.delete', "Xóa đề «{$p->title}»");
    }
}
