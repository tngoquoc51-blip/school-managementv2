<?php

namespace Modules\Discipline\Services;

use Illuminate\Support\Facades\DB;

/** Điểm rèn luyện = base - điểm trừ (vi phạm đã duyệt) + điểm cộng (khen thưởng đã duyệt). */
class DisciplineScoreService
{
    public const COUNTED = ['approved', 'resolved'];
    public const RANK_ORDER = ['Chưa đạt' => 0, 'Đạt' => 1, 'Khá' => 2, 'Tốt' => 3];

    private ?array $settings = null;

    public function settings(): array
    {
        if ($this->settings === null) {
            $defaults = ['base_score' => 100, 'tot_min' => 90, 'kha_min' => 70, 'dat_min' => 50, 'warn_score' => 70,
                'repeat_count' => 3, 'repeat_days' => 30, 'appeal_days' => 7];
            $db = DB::table('sm_disc_settings')->pluck('v', 'k')->map(fn ($v) => (int) $v)->all();
            $this->settings = $db + $defaults;
        }
        return $this->settings;
    }

    public function forgetSettings(): void
    {
        $this->settings = null;
    }

    public function rank(float $score): string
    {
        $s = $this->settings();
        if ($score >= $s['tot_min']) return 'Tốt';
        if ($score >= $s['kha_min']) return 'Khá';
        return $score >= $s['dat_min'] ? 'Đạt' : 'Chưa đạt';
    }

    public function clamp(float $v): int
    {
        return (int) max(0, min($this->settings()['base_score'], round($v)));
    }

    public function currentYearId(): int
    {
        return (int) (DB::table('sm_school_years')->where('is_current', 1)->value('id')
            ?? DB::table('sm_school_years')->max('id') ?? 0);
    }

    public function semesterFor(int $yearId, ?string $date = null): int
    {
        $date = $date ? date('Y-m-d', strtotime($date)) : date('Y-m-d');
        $sem = DB::table('sm_semesters')->where('school_year_id', $yearId)
            ->where('start_date', '<=', $date)->where('end_date', '>=', $date)->value('code');
        if ($sem) return (int) $sem;
        return (int) (DB::table('sm_semesters')->where('school_year_id', $yearId)->where('is_current', 1)->value('code') ?: 1);
    }

    /** @return array<int,array{deduct:int,add:int,violations:int,commendations:int,score:int,rank:string}> */
    public function scores(int $year, int $sem = 0, ?int $classId = null, ?int $studentId = null): array
    {
        $apply = fn ($q) => $q->where('school_year_id', $year)
            ->when($sem > 0, fn ($x) => $x->where('semester', $sem))
            ->when($classId, fn ($x) => $x->where('class_id', $classId))
            ->when($studentId, fn ($x) => $x->where('student_id', $studentId))
            ->groupBy('student_id');

        $d = $apply(DB::table('sm_disc_records')->whereIn('status', self::COUNTED))
            ->selectRaw('student_id, SUM(points) p, COUNT(*) n')->get()->keyBy('student_id');
        $a = $apply(DB::table('sm_disc_commendations')->where('status', 'approved'))
            ->selectRaw('student_id, SUM(points) p, COUNT(*) n')->get()->keyBy('student_id');

        $base = $this->settings()['base_score'];
        $out = [];
        foreach ($d->keys()->merge($a->keys())->unique() as $id) {
            $ded = (int) ($d[$id]->p ?? 0);
            $add = (int) ($a[$id]->p ?? 0);
            $score = $this->clamp($base - $ded + $add);
            $out[(int) $id] = ['deduct' => $ded, 'add' => $add, 'violations' => (int) ($d[$id]->n ?? 0),
                'commendations' => (int) ($a[$id]->n ?? 0), 'score' => $score, 'rank' => $this->rank($score)];
        }
        return $out;
    }

    public function studentScore(int $studentId, int $year, int $sem = 0): array
    {
        $base = $this->settings()['base_score'];
        return $this->scores($year, $sem, null, $studentId)[$studentId]
            ?? ['deduct' => 0, 'add' => 0, 'violations' => 0, 'commendations' => 0, 'score' => $base, 'rank' => $this->rank($base)];
    }
}
