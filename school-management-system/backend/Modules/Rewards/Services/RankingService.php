<?php

namespace Modules\Rewards\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Quy tắc điểm: mỗi lớp có 100 điểm gốc / tuần. Điểm tuần = 100 + tổng điểm cộng/trừ.
 * Tháng / học kỳ / năm = điểm trung bình các tuần có phát sinh dữ liệu.
 */
class RankingService
{
    public const BASE = 100;

    public const CATEGORIES = [
        'nenep' => 'Nề nếp', 'hoctap' => 'Học tập', 'vesinh' => 'Vệ sinh',
        'laodong' => 'Lao động', 'phongtrao' => 'Phong trào', 'khac' => 'Khác',
    ];

    public function year(?int $id = null): ?object
    {
        if ($id) {
            return DB::table('sm_school_years')->where('id', $id)->first();
        }
        return DB::table('sm_school_years')->where('is_current', 1)->first()
            ?? DB::table('sm_school_years')->orderByDesc('id')->first();
    }

    public function defaultDate(object $year): string
    {
        $today = Carbon::today();
        if ($today->between(Carbon::parse($year->start_date), Carbon::parse($year->end_date))) {
            return $today->toDateString();
        }
        $last = DB::table('sm_rw_records')->where('school_year_id', $year->id)->max('record_date');
        return $last ?: $year->start_date;
    }

    public function range(string $period, string $date, object $year): array
    {
        $d = Carbon::parse($date);
        switch ($period) {
            case 'week':
                $f = $d->copy()->startOfWeek();
                $t = $d->copy()->endOfWeek();
                $label = 'Tuần ' . $d->isoWeek() . ' (' . $f->format('d/m') . ' – ' . $t->format('d/m') . ')';
                break;
            case 'month':
                $f = $d->copy()->startOfMonth();
                $t = $d->copy()->endOfMonth();
                $label = 'Tháng ' . $d->format('m/Y');
                break;
            case 'semester':
                $s = DB::table('sm_semesters')->where('school_year_id', $year->id)
                        ->where('start_date', '<=', $d->toDateString())->orderByDesc('start_date')->first()
                    ?? DB::table('sm_semesters')->where('school_year_id', $year->id)->orderBy('start_date')->first();
                $f = Carbon::parse($s->start_date ?? $year->start_date);
                $t = Carbon::parse($s->end_date ?? $year->end_date);
                $label = ($s->name ?? 'Học kỳ') . ' · ' . $year->label;
                break;
            default:
                $f = Carbon::parse($year->start_date);
                $t = Carbon::parse($year->end_date);
                $label = 'Năm học ' . $year->label;
        }
        return ['from' => $f->toDateString(), 'to' => $t->toDateString(), 'label' => $label];
    }

    public function previous(string $period, string $from): ?array
    {
        $f = Carbon::parse($from);
        if ($period === 'week') {
            $a = $f->copy()->subWeek();
            return [$a->toDateString(), $a->copy()->endOfWeek()->toDateString()];
        }
        if ($period === 'month') {
            $a = $f->copy()->subMonthNoOverflow()->startOfMonth();
            return [$a->toDateString(), $a->copy()->endOfMonth()->toDateString()];
        }
        return null;
    }

    public function ranking(int $yearId, string $from, string $to, ?int $grade = null): array
    {
        $sql = "SELECT c.id, c.name, c.grade, t.full_name AS homeroom,
                       COALESCE(AVG(w.total), ?) AS score,
                       COALESCE(SUM(w.plus), 0) AS plus, COALESCE(SUM(w.minus), 0) AS minus,
                       COUNT(w.wk) AS weeks
                FROM sm_classes c
                LEFT JOIN sm_teachers t ON t.id = c.homeroom_teacher_id
                LEFT JOIN (
                    SELECT class_id, YEARWEEK(record_date, 1) AS wk, ? + SUM(points) AS total,
                           SUM(CASE WHEN points > 0 THEN points ELSE 0 END) AS plus,
                           SUM(CASE WHEN points < 0 THEN points ELSE 0 END) AS minus
                    FROM sm_rw_records
                    WHERE record_date BETWEEN ? AND ?
                    GROUP BY class_id, YEARWEEK(record_date, 1)
                ) w ON w.class_id = c.id
                WHERE c.school_year_id = ? AND c.status = 'active'" . ($grade ? ' AND c.grade = ?' : '') . "
                GROUP BY c.id, c.name, c.grade, t.full_name
                ORDER BY score DESC, c.name";

        $b = [self::BASE, self::BASE, $from, $to, $yearId];
        if ($grade) {
            $b[] = $grade;
        }

        $out = [];
        $prev = null;
        $rank = 0;
        foreach (DB::select($sql, $b) as $i => $r) {
            $score = round((float) $r->score, 1);
            if ($score !== $prev) {
                $rank = $i + 1;
                $prev = $score;
            }
            $out[] = [
                'id' => (int) $r->id, 'name' => $r->name, 'grade' => (int) $r->grade,
                'homeroom' => $r->homeroom, 'score' => $score,
                'plus' => (float) $r->plus, 'minus' => (float) $r->minus,
                'weeks' => (int) $r->weeks, 'rank' => $rank,
            ];
        }
        return $out;
    }

    public function withDelta(array $items, string $period, string $from, int $yearId, ?int $grade): array
    {
        $prev = $this->previous($period, $from);
        if (!$prev) {
            return $items;
        }
        $p = $this->ranking($yearId, $prev[0], $prev[1], $grade);
        if (!array_sum(array_column($p, 'weeks'))) {
            return $items;
        }
        $map = array_column($p, 'rank', 'id');
        foreach ($items as &$i) {
            $i['prev_rank'] = $map[$i['id']] ?? null;
            $i['delta'] = $i['prev_rank'] ? $i['prev_rank'] - $i['rank'] : null; // dương = tăng hạng
        }
        unset($i);
        return $items;
    }

    /** Chuỗi $n tuần gần nhất (toàn trường hoặc 1 lớp) */
    public function weekly(int $yearId, string $endDate, int $n = 8, ?int $classId = null): array
    {
        $end = Carbon::parse($endDate)->startOfWeek();
        $start = $end->copy()->subWeeks($n - 1);

        $q = DB::table('sm_rw_records')
            ->selectRaw("YEARWEEK(record_date, 1) AS wk, SUM(points) AS s,
                SUM(CASE WHEN points > 0 THEN points ELSE 0 END) AS plus,
                SUM(CASE WHEN points < 0 THEN points ELSE 0 END) AS minus")
            ->where('school_year_id', $yearId)
            ->whereBetween('record_date', [$start->toDateString(), $end->copy()->endOfWeek()->toDateString()]);
        if ($classId) {
            $q->where('class_id', $classId);
        }
        $rows = $q->groupByRaw('YEARWEEK(record_date, 1)')->get()->keyBy('wk');

        $cnt = $classId ? 1 : max(1, DB::table('sm_classes')->where('school_year_id', $yearId)->where('status', 'active')->count());

        $out = [];
        for ($i = 0; $i < $n; $i++) {
            $w = $start->copy()->addWeeks($i);
            $key = (int) ($w->isoWeekYear . str_pad((string) $w->isoWeek(), 2, '0', STR_PAD_LEFT));
            $r = $rows->get($key);
            $out[] = [
                'label' => 'T' . $w->isoWeek(),
                'from' => $w->toDateString(),
                'avg' => round(self::BASE + ($r ? (float) $r->s : 0) / $cnt, 1),
                'plus' => $r ? (float) $r->plus : 0.0,
                'minus' => $r ? (float) $r->minus : 0.0,
            ];
        }
        return $out;
    }

    public function categories(int $yearId, string $from, string $to, ?int $classId = null): array
    {
        $q = DB::table('sm_rw_records as r')->join('sm_rw_criteria as k', 'k.id', '=', 'r.criteria_id')
            ->selectRaw("k.category, SUM(CASE WHEN r.points > 0 THEN r.points ELSE 0 END) AS plus,
                         SUM(CASE WHEN r.points < 0 THEN r.points ELSE 0 END) AS minus")
            ->where('r.school_year_id', $yearId)->whereBetween('r.record_date', [$from, $to]);
        if ($classId) {
            $q->where('r.class_id', $classId);
        }
        return $q->groupBy('k.category')->get()->map(fn($r) => [
            'category' => $r->category, 'plus' => (float) $r->plus, 'minus' => (float) $r->minus,
        ])->all();
    }
}
