<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Nhận xét học sinh của giáo viên (cổng Giáo viên). Xác thực bằng token nhân viên (sm_staff_tokens),
 * mỗi giáo viên chỉ nhận xét học sinh thuộc lớp–môn do mình được phân công (sm_class_subjects).
 */
class TeacherCommentService
{
    public const RATINGS = ['excellent' => 'Tốt', 'good' => 'Khá', 'fair' => 'Đạt', 'weak' => 'Cần cố gắng'];
    public const KINDS = ['midterm' => 'Giữa kỳ', 'final' => 'Cuối kỳ', 'monthly' => 'Hằng tháng'];
    public const TAGS = [
        'hard_working' => 'Chăm chỉ', 'active' => 'Tích cực phát biểu', 'creative' => 'Sáng tạo', 'progress' => 'Có tiến bộ',
        'need_practice' => 'Cần luyện tập thêm', 'late_homework' => 'Hay nộp bài muộn', 'distracted' => 'Chưa tập trung', 'absent' => 'Vắng nhiều',
    ];
    private const SUGGEST = [
        'excellent' => 'Em học tập rất tốt, nắm vững kiến thức và chủ động trong giờ học. Hãy tiếp tục phát huy và thử sức với các bài nâng cao.',
        'good' => 'Em học khá, nghiêm túc và hoàn thành bài tập đầy đủ. Cần luyện thêm các dạng bài vận dụng để đạt kết quả cao hơn.',
        'fair' => 'Em nắm được kiến thức cơ bản nhưng còn nhầm lẫn khi làm bài. Cần ôn tập thường xuyên và làm thêm bài tập mỗi tuần.',
        'weak' => 'Em còn hổng kiến thức nền và chưa hoàn thành bài tập đều đặn. Đề nghị em gặp giáo viên để được hướng dẫn ôn tập.',
    ];

    /* ---------- danh tính & phạm vi ---------- */

    public function staff(Request $r): object
    {
        $token = $r->bearerToken();
        $row = $token ? DB::table('sm_staff_tokens as k')->join('sm_staff_accounts as a', 'a.id', '=', 'k.staff_id')
            ->where('k.token_hash', hash('sha256', $token))->where('k.expires_at', '>', now())
            ->first(['a.id', 'a.username', 'a.full_name', 'a.role', 'a.teacher_id']) : null;
        abort_unless($row, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
        abort_unless((int) $row->teacher_id > 0, 403, 'Tài khoản này chưa được liên kết với giáo viên.');

        return $row;
    }

    private function year(): int
    {
        return (int) (DB::table('sm_school_years')->where('is_current', 1)->value('id') ?: DB::table('sm_school_years')->max('id'));
    }

    private function currentSemester(int $year): int
    {
        return (int) (DB::table('sm_semesters')->where('school_year_id', $year)->where('is_current', 1)->value('code') ?: 1);
    }

    private function assignments(int $tid, int $year)
    {
        return DB::table('sm_class_subjects as cs')->join('sm_classes as c', 'c.id', '=', 'cs.class_id')->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->where('cs.teacher_id', $tid)->where('c.school_year_id', $year)->orderBy('c.grade')->orderBy('c.name')->orderBy('s.sort_order')
            ->get(['cs.id', 'cs.class_id', 'c.name as class_name', 'c.grade', 'cs.subject_id', 's.name as subject_name', 's.code as subject_code']);
    }

    private function owned(int $csId, int $tid, int $year): object
    {
        $cs = $this->assignments($tid, $year)->firstWhere('id', $csId);
        abort_unless($cs, 403, 'Bạn không được phân công dạy lớp – môn này.');

        return $cs;
    }

    private function period(string $kind, ?string $p): string
    {
        if ($kind === 'midterm') return 'GK';
        if ($kind === 'final') return 'CK';

        return ($p && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $p)) ? $p : date('Y-m');
    }

    private function students(object $cs, int $year)
    {
        return DB::table('sm_enrollments as e')->join('sm_students as st', 'st.id', '=', 'e.student_id')
            ->where('e.class_id', $cs->class_id)->where('e.school_year_id', $year)->orderBy('st.full_name')
            ->get(['st.id', 'st.code', 'st.full_name', 'st.gender']);
    }

    /* ---------- điểm & gợi ý ---------- */

    private function num($v): ?float
    {
        return $v === null ? null : (float) $v;
    }

    private function score(?object $g): ?float
    {
        if (! $g) return null;
        if ($g->tbm !== null) return (float) $g->tbm;
        $tx = array_filter([$g->tx1, $g->tx2, $g->tx3, $g->tx4], fn ($x) => $x !== null);
        $sum = array_sum(array_map('floatval', $tx)); $w = count($tx);
        if ($g->gk !== null) { $sum += 2 * (float) $g->gk; $w += 2; }
        if ($g->ck !== null) { $sum += 3 * (float) $g->ck; $w += 3; }

        return $w > 0 ? round($sum / $w, 1) : null;
    }

    private function trend(?object $g): ?string
    {
        if (! $g) return null;
        $tx = array_filter([$g->tx1, $g->tx2, $g->tx3, $g->tx4], fn ($x) => $x !== null);
        $txAvg = $tx ? array_sum(array_map('floatval', $tx)) / count($tx) : null;
        if ($g->ck !== null && $g->gk !== null) $d = (float) $g->ck - (float) $g->gk;
        elseif ($g->gk !== null && $txAvg !== null) $d = (float) $g->gk - $txAvg;
        else return null;

        return $d >= 1 ? 'up' : ($d <= -1 ? 'down' : 'flat');
    }

    private function suggest(?object $g): array
    {
        $score = $this->score($g);
        $trend = $this->trend($g);
        if ($score === null) return ['rating' => null, 'text' => null, 'trend' => $trend];
        $rating = $score >= 8 ? 'excellent' : ($score >= 6.5 ? 'good' : ($score >= 5 ? 'fair' : 'weak'));
        $text = self::SUGGEST[$rating];
        if ($trend === 'up') $text .= ' Em có tiến bộ rõ rệt trong thời gian gần đây.';
        if ($trend === 'down') $text .= ' Kết quả gần đây có dấu hiệu giảm, mong em điều chỉnh phương pháp học.';

        return ['rating' => $rating, 'text' => $text, 'trend' => $trend];
    }

    private function scoresOf(?object $g): array
    {
        return [
            'tx1' => $this->num($g->tx1 ?? null), 'tx2' => $this->num($g->tx2 ?? null), 'tx3' => $this->num($g->tx3 ?? null), 'tx4' => $this->num($g->tx4 ?? null),
            'gk' => $this->num($g->gk ?? null), 'ck' => $this->num($g->ck ?? null), 'tbm' => $this->num($g->tbm ?? null),
        ];
    }

    /* ---------- danh mục ---------- */

    public function meta(object $staff): array
    {
        $year = $this->year();

        return [
            'year_id' => $year, 'semester' => $this->currentSemester($year),
            'semesters' => DB::table('sm_semesters')->where('school_year_id', $year)->orderBy('code')->get(['code', 'name'])->all(),
            'assignments' => $this->assignments($staff->teacher_id, $year)->all(),
            'ratings' => self::RATINGS, 'kinds' => self::KINDS, 'tags' => self::TAGS,
        ];
    }

    /* ---------- danh sách soạn nhận xét ---------- */

    private function roster(object $cs, int $year, int $sem, string $kind, string $period): array
    {
        $students = $this->students($cs, $year);
        $ids = $students->pluck('id')->all();
        $grades = DB::table('sm_grades')->where('school_year_id', $year)->where('subject_id', $cs->subject_id)->where('semester', $sem)->whereIn('student_id', $ids)->get()->keyBy('student_id');
        $comments = DB::table('sm_student_comments')->where('school_year_id', $year)->where('subject_id', $cs->subject_id)->where('semester', $sem)
            ->where('kind', $kind)->where('period', $period)->whereIn('student_id', $ids)->get()->keyBy('student_id');

        return [$students, $grades, $comments];
    }

    public function rosterOut(object $staff, int $csId, int $sem, string $kind, ?string $period): array
    {
        $year = $this->year();
        $cs = $this->owned($csId, $staff->teacher_id, $year);
        $period = $this->period($kind, $period);
        [$students, $grades, $comments] = $this->roster($cs, $year, $sem, $kind, $period);

        return [
            'assignment' => $cs, 'period' => $period,
            'students' => $students->map(function ($s) use ($grades, $comments) {
                $g = $grades[$s->id] ?? null; $c = $comments[$s->id] ?? null;

                return [
                    'id' => $s->id, 'code' => $s->code, 'full_name' => $s->full_name, 'gender' => $s->gender,
                    'scores' => $this->scoresOf($g), 'score' => $this->score($g), 'suggest' => $this->suggest($g),
                    'comment' => $c ? ['id' => $c->id, 'rating' => $c->rating, 'content' => $c->content, 'tags' => $c->tags, 'status' => $c->status, 'updated_at' => $c->updated_at, 'published_at' => $c->published_at, 'kind' => $c->kind, 'period' => $c->period] : null,
                ];
            })->values()->all(),
        ];
    }

    /* ---------- ghi nhận xét ---------- */

    public function save(object $staff, array $d): object
    {
        $year = $this->year();
        $cs = $this->owned((int) $d['class_subject_id'], $staff->teacher_id, $year);
        abort_unless(DB::table('sm_enrollments')->where('student_id', $d['student_id'])->where('class_id', $cs->class_id)->where('school_year_id', $year)->exists(), 422, 'Học sinh không thuộc lớp này.');
        $period = $this->period($d['kind'], $d['period'] ?? null);
        $tags = implode(',', array_values(array_intersect(array_keys(self::TAGS), $d['tags'] ?? [])));
        $status = ($d['status'] ?? 'draft') === 'published' ? 'published' : 'draft';
        $now = now();
        $key = ['student_id' => (int) $d['student_id'], 'subject_id' => $cs->subject_id, 'school_year_id' => $year, 'semester' => (int) $d['semester'], 'kind' => $d['kind'], 'period' => $period];
        $existing = DB::table('sm_student_comments')->where($key)->first();
        $row = [
            'class_id' => $cs->class_id, 'teacher_id' => $staff->teacher_id, 'rating' => $d['rating'], 'content' => trim($d['content']),
            'tags' => $tags ?: null, 'status' => $status, 'published_at' => $status === 'published' ? ($existing->published_at ?? $now) : null, 'updated_at' => $now,
        ];
        if ($existing) {
            DB::table('sm_student_comments')->where('id', $existing->id)->update($row);
            $id = $existing->id;
        } else {
            $id = DB::table('sm_student_comments')->insertGetId($key + $row + ['created_at' => $now]);
        }

        return DB::table('sm_student_comments')->find($id);
    }

    public function saveMany(object $staff, array $items): int
    {
        return DB::transaction(function () use ($staff, $items) {
            foreach ($items as $it) $this->save($staff, $it);

            return count($items);
        });
    }

    public function setStatus(object $staff, int $csId, int $sem, string $kind, ?string $period, string $to): int
    {
        $year = $this->year();
        $cs = $this->owned($csId, $staff->teacher_id, $year);
        $publish = $to === 'published';

        return DB::table('sm_student_comments')->where('school_year_id', $year)->where('class_id', $cs->class_id)->where('subject_id', $cs->subject_id)
            ->where('semester', $sem)->where('kind', $kind)->where('period', $this->period($kind, $period))->where('status', $publish ? 'draft' : 'published')
            ->update(['status' => $publish ? 'published' : 'draft', 'published_at' => $publish ? now() : null, 'updated_at' => now()]);
    }

    public function remove(object $staff, int $id): void
    {
        abort_unless(DB::table('sm_student_comments')->where('id', $id)->where('teacher_id', $staff->teacher_id)->delete(), 404, 'Không tìm thấy nhận xét.');
    }

    /* ---------- tổng quan ---------- */

    public function overview(object $staff, int $sem, string $kind, ?string $period): array
    {
        $year = $this->year();
        $period = $this->period($kind, $period);
        $progress = []; $tot = ['students' => 0, 'written' => 0, 'draft' => 0, 'published' => 0];
        foreach ($this->assignments($staff->teacher_id, $year) as $cs) {
            $n = DB::table('sm_enrollments')->where('class_id', $cs->class_id)->where('school_year_id', $year)->count();
            $c = DB::table('sm_student_comments')->where('school_year_id', $year)->where('class_id', $cs->class_id)->where('subject_id', $cs->subject_id)
                ->where('semester', $sem)->where('kind', $kind)->where('period', $period)
                ->selectRaw("COUNT(*) written, COALESCE(SUM(status = 'published'),0) pub, COALESCE(SUM(status = 'draft'),0) dr")->first();
            $progress[] = ['assignment' => $cs, 'students' => $n, 'written' => (int) $c->written, 'published' => (int) $c->pub, 'draft' => (int) $c->dr];
            $tot['students'] += $n; $tot['written'] += (int) $c->written; $tot['draft'] += (int) $c->dr; $tot['published'] += (int) $c->pub;
        }
        $ratings = DB::table('sm_student_comments')->where('teacher_id', $staff->teacher_id)->where('school_year_id', $year)->where('semester', $sem)
            ->selectRaw('rating, COUNT(*) n')->groupBy('rating')->get()->map(fn ($r) => ['rating' => $r->rating, 'n' => (int) $r->n])->all();
        $recent = DB::table('sm_student_comments as c')->join('sm_students as st', 'st.id', '=', 'c.student_id')->join('sm_classes as cl', 'cl.id', '=', 'c.class_id')->join('sm_subjects as sb', 'sb.id', '=', 'c.subject_id')
            ->where('c.teacher_id', $staff->teacher_id)->where('c.school_year_id', $year)->orderByDesc('c.updated_at')->limit(8)
            ->get(['c.id', 'c.rating', 'c.content', 'c.status', 'c.kind', 'c.period', 'c.updated_at', 'st.full_name as student_name', 'st.code as student_code', 'cl.name as class_name', 'sb.name as subject_name'])->all();

        return ['kpi' => $tot, 'progress' => $progress, 'ratings' => $ratings, 'recent' => $recent];
    }

    /* ---------- học sinh cần quan tâm ---------- */

    public function insights(object $staff, int $csId, int $sem, string $kind, ?string $period): array
    {
        $year = $this->year();
        $period = $this->period($kind, $period);
        $list = $csId ? collect([$this->owned($csId, $staff->teacher_id, $year)]) : $this->assignments($staff->teacher_id, $year);
        $out = [];
        foreach ($list as $cs) {
            [$students, $grades, $comments] = $this->roster($cs, $year, $sem, $kind, $period);
            foreach ($students as $s) {
                $g = $grades[$s->id] ?? null; $score = $this->score($g); $sg = $this->suggest($g); $c = $comments[$s->id] ?? null;
                $reasons = []; $sev = 0;
                if ($score !== null && $score < 5) { $reasons[] = 'low'; $sev += 3; }
                if ($sg['trend'] === 'down') { $reasons[] = 'down'; $sev += 2; }
                if (! $reasons) continue;
                if (! $c) { $reasons[] = 'no_comment'; $sev += 1; }
                $out[] = [
                    'student' => ['id' => $s->id, 'code' => $s->code, 'full_name' => $s->full_name], 'assignment' => $cs, 'score' => $score, 'scores' => $this->scoresOf($g),
                    'trend' => $sg['trend'], 'reasons' => $reasons, 'severity' => $sev, 'suggest' => $sg,
                    'comment' => $c ? ['id' => $c->id, 'rating' => $c->rating, 'content' => $c->content, 'tags' => $c->tags, 'status' => $c->status] : null,
                ];
            }
        }
        usort($out, fn ($a, $b) => [$b['severity'], $a['score'] ?? 99] <=> [$a['severity'], $b['score'] ?? 99]);

        return array_slice($out, 0, 80);
    }

    public function student(object $staff, int $studentId, int $csId): array
    {
        $year = $this->year();
        $cs = $this->owned($csId, $staff->teacher_id, $year);
        abort_unless(DB::table('sm_enrollments')->where('student_id', $studentId)->where('class_id', $cs->class_id)->where('school_year_id', $year)->exists(), 404, 'Học sinh không thuộc lớp này.');
        $st = DB::table('sm_students')->where('id', $studentId)->first(['id', 'code', 'full_name', 'gender', 'birth_date']);
        $grades = DB::table('sm_grades')->where('student_id', $studentId)->where('school_year_id', $year)->where('subject_id', $cs->subject_id)->orderBy('semester')
            ->get(['semester', 'tx1', 'tx2', 'tx3', 'tx4', 'gk', 'ck', 'tbm', 'assessment'])->all();
        $comments = DB::table('sm_student_comments')->where('student_id', $studentId)->where('school_year_id', $year)->where('subject_id', $cs->subject_id)
            ->orderByDesc('updated_at')->get(['id', 'semester', 'kind', 'period', 'rating', 'content', 'tags', 'status', 'updated_at'])->all();

        return ['student' => $st, 'assignment' => $cs, 'grades' => $grades, 'comments' => $comments];
    }

    /* ---------- lịch sử & xuất file ---------- */

    private function historyQuery(object $staff, array $f)
    {
        $year = $this->year();

        return DB::table('sm_student_comments as c')->join('sm_students as st', 'st.id', '=', 'c.student_id')->join('sm_classes as cl', 'cl.id', '=', 'c.class_id')->join('sm_subjects as sb', 'sb.id', '=', 'c.subject_id')
            ->where('c.teacher_id', $staff->teacher_id)->where('c.school_year_id', $year)
            ->when($f['class_id'] ?? 0, fn ($q, $v) => $q->where('c.class_id', $v))->when($f['subject_id'] ?? 0, fn ($q, $v) => $q->where('c.subject_id', $v))
            ->when($f['semester'] ?? 0, fn ($q, $v) => $q->where('c.semester', $v))->when($f['status'] ?? '', fn ($q, $v) => $q->where('c.status', $v))
            ->when($f['rating'] ?? '', fn ($q, $v) => $q->where('c.rating', $v))
            ->when(($f['q'] ?? '') !== '', function ($q) use ($f) {
                $like = '%' . $f['q'] . '%';
                $q->where(fn ($w) => $w->where('st.full_name', 'like', $like)->orWhere('st.code', 'like', $like)->orWhere('c.content', 'like', $like));
            });
    }

    public function history(object $staff, array $f, int $perPage): array
    {
        $p = $this->historyQuery($staff, $f)->orderByDesc('c.updated_at')->paginate($perPage, [
            'c.id', 'c.student_id', 'c.class_id', 'c.subject_id', 'c.semester', 'c.kind', 'c.period', 'c.rating', 'c.content', 'c.tags', 'c.status', 'c.updated_at',
            'st.code as student_code', 'st.full_name as student_name', 'cl.name as class_name', 'sb.name as subject_name',
        ]);

        return ['data' => $p->items(), 'current_page' => $p->currentPage(), 'last_page' => $p->lastPage(), 'total' => $p->total(), 'per_page' => $p->perPage()];
    }

    public function exportRows(object $staff, array $f)
    {
        return $this->historyQuery($staff, $f)->orderBy('cl.name')->orderBy('sb.name')->orderBy('st.full_name')
            ->get(['st.code as student_code', 'st.full_name as student_name', 'cl.name as class_name', 'sb.name as subject_name', 'c.semester', 'c.kind', 'c.period', 'c.rating', 'c.content', 'c.status', 'c.updated_at']);
    }

    /* ---------- mẫu nhận xét ---------- */

    public function templates(object $staff, string $rating): array
    {
        return DB::table('sm_comment_templates')->where(fn ($q) => $q->whereNull('teacher_id')->orWhere('teacher_id', $staff->teacher_id))
            ->when($rating !== '', fn ($q) => $q->where(fn ($w) => $w->where('rating', $rating)->orWhere('rating', 'any')))
            ->orderBy('is_system')->orderByDesc('uses')->orderBy('id')->get()->all();
    }

    public function saveTemplate(object $staff, array $d, ?int $id = null): object
    {
        $row = ['rating' => $d['rating'], 'title' => trim($d['title']), 'body' => trim($d['body']), 'updated_at' => now()];
        if ($id) {
            abort_unless(DB::table('sm_comment_templates')->where('id', $id)->where('teacher_id', $staff->teacher_id)->where('is_system', 0)->update($row) !== false
                && DB::table('sm_comment_templates')->where('id', $id)->where('teacher_id', $staff->teacher_id)->exists(), 404, 'Chỉ sửa được mẫu của chính bạn.');
        } else {
            $id = DB::table('sm_comment_templates')->insertGetId($row + ['teacher_id' => $staff->teacher_id, 'is_system' => 0, 'uses' => 0, 'created_at' => now()]);
        }

        return DB::table('sm_comment_templates')->find($id);
    }

    public function deleteTemplate(object $staff, int $id): void
    {
        abort_unless(DB::table('sm_comment_templates')->where('id', $id)->where('teacher_id', $staff->teacher_id)->where('is_system', 0)->delete(), 404, 'Chỉ xóa được mẫu của chính bạn.');
    }

    public function useTemplate(object $staff, int $id): void
    {
        DB::table('sm_comment_templates')->where('id', $id)->where(fn ($q) => $q->whereNull('teacher_id')->orWhere('teacher_id', $staff->teacher_id))->increment('uses');
    }
}
