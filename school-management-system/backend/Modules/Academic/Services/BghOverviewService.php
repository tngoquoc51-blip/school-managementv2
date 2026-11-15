<?php

namespace Modules\Academic\Services;

use Illuminate\Support\Facades\DB;
use Modules\Academic\Support\Bgh;

/** Bảng điều khiển tổng quan Chuyên môn. */
class BghOverviewService
{
    public function get(int $year, int $sem): array
    {
        $results = new BghResultsService();
        $dist = $results->distribution($year, $sem);
        $totalStudents = array_sum($dist);

        $one = fn (string $sql, array $b = []) => (int) (DB::selectOne($sql, $b)->n ?? 0);
        $avg = DB::selectOne('SELECT ROUND(AVG(tbm), 2) AS a FROM sm_grades WHERE school_year_id = ? AND semester = ? AND tbm IS NOT NULL', [$year, $sem]);

        $quota = Bgh::quota();
        $workload = DB::select(
            'SELECT t.id, t.full_name, COUNT(*) AS periods FROM sm_timetable tt
             JOIN sm_classes c ON c.id = tt.class_id AND c.school_year_id = ?
             JOIN sm_class_subjects cs ON cs.id = tt.class_subject_id JOIN sm_teachers t ON t.id = cs.teacher_id
             GROUP BY t.id, t.full_name ORDER BY periods DESC', [$year]);
        $over = array_values(array_filter($workload, fn ($w) => (int) $w->periods > $quota));

        $recent = DB::select(
            "(SELECT 'lesson_plan' AS kind, CONCAT(CASE status WHEN 'approved' THEN 'Đã duyệt' WHEN 'rejected' THEN 'Từ chối' ELSE 'Yêu cầu chỉnh sửa' END, ' giáo án: ', title) AS text, reviewed_at AS at_time FROM sm_lesson_plans WHERE reviewed_at IS NOT NULL)
             UNION ALL (SELECT 'observation', CONCAT('Dự giờ ', t.full_name, ' – ', o.rating, ' (', o.score, ')'), o.created_at FROM sm_class_observations o JOIN sm_teachers t ON t.id = o.teacher_id)
             UNION ALL (SELECT 'request', CONCAT(IF(status = 'approved', 'Đã phê duyệt: ', 'Từ chối: '), title), decided_at FROM sm_academic_requests WHERE decided_at IS NOT NULL)
             ORDER BY at_time DESC LIMIT 8");

        $pendingRequests = DB::select("SELECT id, type, title, priority, requested_by, created_at FROM sm_academic_requests WHERE status = 'pending' ORDER BY FIELD(priority, 'high', 'normal', 'low'), created_at DESC LIMIT 5");

        return [
            'year_id' => $year, 'semester' => $sem,
            'kpi' => [
                'students' => $one('SELECT COUNT(*) AS n FROM sm_enrollments WHERE school_year_id = ?', [$year]),
                'teachers' => $one('SELECT COUNT(*) AS n FROM sm_teachers'),
                'classes' => $one('SELECT COUNT(*) AS n FROM sm_classes WHERE school_year_id = ?', [$year]),
                'subjects' => $one('SELECT COUNT(*) AS n FROM sm_subjects'),
                'avg_score' => $avg->a !== null ? (float) $avg->a : null,
                'pass_rate' => $totalStudents ? round(100 * ($totalStudents - $dist['Chưa đạt']) / $totalStudents, 1) : null,
                'pending_plans' => $one("SELECT COUNT(*) AS n FROM sm_lesson_plans WHERE status = 'pending'"),
                'pending_requests' => $one("SELECT COUNT(*) AS n FROM sm_academic_requests WHERE status = 'pending'"),
                'observations_30d' => $one('SELECT COUNT(*) AS n FROM sm_class_observations WHERE observed_on >= CURDATE() - INTERVAL 30 DAY'),
                'timetable_conflicts' => count((new BghTimetableService())->conflicts($year)),
            ],
            'distribution' => $dist,
            'subjects' => DB::select(
                'SELECT s.code, s.name, ROUND(AVG(g.tbm), 2) AS avg_score FROM sm_subjects s
                 JOIN sm_grades g ON g.subject_id = s.id AND g.school_year_id = ? AND g.semester = ? AND g.tbm IS NOT NULL
                 GROUP BY s.id, s.code, s.name, s.sort_order ORDER BY s.sort_order', [$year, $sem]),
            'workload' => ['quota' => $quota, 'overloaded' => $over, 'max' => $workload[0]->periods ?? 0, 'items' => array_slice($workload, 0, 8)],
            'pending_requests' => $pendingRequests,
            'recent' => $recent,
        ];
    }
}
