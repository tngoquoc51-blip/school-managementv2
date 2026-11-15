<?php

namespace Modules\Academic\Services;

use Illuminate\Support\Facades\DB;
use Modules\Academic\Support\Bgh;

/** Danh mục chuyên môn: môn học, tổ chuyên môn, giáo viên, phân công giảng dạy. */
class BghCatalogService
{
    public function meta(): array
    {
        return [
            'years' => DB::select('SELECT id, label, is_current, status FROM sm_school_years ORDER BY id DESC'),
            'current_year_id' => Bgh::year(),
            'classes' => DB::select('SELECT id, school_year_id, grade, name FROM sm_classes ORDER BY school_year_id DESC, grade, name'),
            'subjects' => DB::select('SELECT id, code, name, kind, periods_per_week FROM sm_subjects ORDER BY sort_order'),
            'teachers' => DB::select('SELECT id, code, full_name, main_subject_id FROM sm_teachers ORDER BY code'),
            'periods' => DB::select('SELECT id, start_time, end_time FROM sm_periods ORDER BY id'),
            'quota' => Bgh::quota(),
        ];
    }

    public function subjects(int $year, int $sem): array
    {
        return DB::select(
            'SELECT s.id, s.code, s.name, s.kind, s.periods_per_week, g.id AS group_id, g.name AS group_name, g.color AS group_color,
                (SELECT COUNT(DISTINCT cs.teacher_id) FROM sm_class_subjects cs JOIN sm_classes c ON c.id = cs.class_id AND c.school_year_id = ? WHERE cs.subject_id = s.id) AS teacher_count,
                (SELECT COUNT(*) FROM sm_class_subjects cs JOIN sm_classes c ON c.id = cs.class_id AND c.school_year_id = ? WHERE cs.subject_id = s.id) AS class_count,
                (SELECT ROUND(AVG(gr.tbm), 2) FROM sm_grades gr WHERE gr.subject_id = s.id AND gr.school_year_id = ? AND gr.semester = ? AND gr.tbm IS NOT NULL) AS avg_score,
                (SELECT ROUND(100 * AVG(gr.tbm >= 5), 1) FROM sm_grades gr WHERE gr.subject_id = s.id AND gr.school_year_id = ? AND gr.semester = ? AND gr.tbm IS NOT NULL) AS pass_rate
             FROM sm_subjects s
             LEFT JOIN sm_subject_group_subjects gs ON gs.subject_id = s.id
             LEFT JOIN sm_subject_groups g ON g.id = gs.group_id
             ORDER BY s.sort_order', [$year, $year, $year, $sem, $year, $sem]);
    }

    public function subjectDetail(int $id, int $year, int $sem): array
    {
        $subject = DB::selectOne('SELECT id, code, name, kind, periods_per_week FROM sm_subjects WHERE id = ?', [$id]);
        if (! $subject) {
            throw new \DomainException('Không tìm thấy môn học.');
        }
        $teachers = DB::select(
            'SELECT t.id, t.code, t.full_name, COUNT(*) AS class_count, GROUP_CONCAT(c.name ORDER BY c.grade, c.name SEPARATOR ", ") AS classes,
                (SELECT ROUND(AVG(gr.tbm), 2) FROM sm_grades gr WHERE gr.teacher_id = t.id AND gr.subject_id = cs.subject_id AND gr.school_year_id = ? AND gr.semester = ? AND gr.tbm IS NOT NULL) AS avg_score
             FROM sm_class_subjects cs JOIN sm_teachers t ON t.id = cs.teacher_id JOIN sm_classes c ON c.id = cs.class_id AND c.school_year_id = ?
             WHERE cs.subject_id = ? GROUP BY t.id, t.code, t.full_name, cs.subject_id ORDER BY t.code', [$year, $sem, $year, $id]);
        $byGrade = DB::select(
            'SELECT c.grade, ROUND(AVG(g.tbm), 2) AS avg_score, ROUND(100 * AVG(g.tbm >= 5), 1) AS pass_rate
             FROM sm_grades g JOIN sm_classes c ON c.id = g.class_id
             WHERE g.subject_id = ? AND g.school_year_id = ? AND g.semester = ? AND g.tbm IS NOT NULL GROUP BY c.grade ORDER BY c.grade', [$id, $year, $sem]);
        $hist = DB::selectOne(
            'SELECT SUM(tbm < 5) AS b1, SUM(tbm >= 5 AND tbm < 6.5) AS b2, SUM(tbm >= 6.5 AND tbm < 8) AS b3, SUM(tbm >= 8) AS b4
             FROM sm_grades WHERE subject_id = ? AND school_year_id = ? AND semester = ? AND tbm IS NOT NULL', [$id, $year, $sem]);

        return [
            'subject' => $subject, 'teachers' => $teachers, 'by_grade' => $byGrade,
            'histogram' => [
                ['label' => 'Dưới 5', 'n' => (int) ($hist->b1 ?? 0)],
                ['label' => '5 – 6,4', 'n' => (int) ($hist->b2 ?? 0)],
                ['label' => '6,5 – 7,9', 'n' => (int) ($hist->b3 ?? 0)],
                ['label' => '8 trở lên', 'n' => (int) ($hist->b4 ?? 0)],
            ],
        ];
    }

    public function groups(int $year, int $sem): array
    {
        return DB::select(
            'SELECT g.id, g.code, g.name, g.color, g.description, g.head_teacher_id, h.full_name AS head_name,
                (SELECT GROUP_CONCAT(s.name ORDER BY s.sort_order SEPARATOR ", ") FROM sm_subject_group_subjects gs JOIN sm_subjects s ON s.id = gs.subject_id WHERE gs.group_id = g.id) AS subjects,
                (SELECT GROUP_CONCAT(gs.subject_id) FROM sm_subject_group_subjects gs WHERE gs.group_id = g.id) AS subject_ids,
                (SELECT COUNT(*) FROM sm_teachers t JOIN sm_subject_group_subjects gs ON gs.subject_id = t.main_subject_id WHERE gs.group_id = g.id) AS teacher_count,
                (SELECT ROUND(AVG(gr.tbm), 2) FROM sm_grades gr JOIN sm_subject_group_subjects gs ON gs.subject_id = gr.subject_id
                  WHERE gs.group_id = g.id AND gr.school_year_id = ? AND gr.semester = ? AND gr.tbm IS NOT NULL) AS avg_score
             FROM sm_subject_groups g LEFT JOIN sm_teachers h ON h.id = g.head_teacher_id ORDER BY g.id', [$year, $sem]);
    }

    public function setGroupHead(int $groupId, int $teacherId, array $actor): void
    {
        $g = DB::selectOne('SELECT name FROM sm_subject_groups WHERE id = ?', [$groupId]);
        $t = DB::selectOne('SELECT full_name FROM sm_teachers WHERE id = ?', [$teacherId]);
        if (! $g || ! $t) {
            throw new \DomainException('Tổ chuyên môn hoặc giáo viên không tồn tại.');
        }
        DB::update('UPDATE sm_subject_groups SET head_teacher_id = ? WHERE id = ?', [$teacherId, $groupId]);
        Bgh::audit($actor, 'group.set_head', "{$g->name}: tổ trưởng {$t->full_name}");
        Bgh::notify($actor, 'Cập nhật tổ trưởng chuyên môn', "{$t->full_name} được bổ nhiệm làm tổ trưởng {$g->name}.", 'academic');
    }

    public function teachers(int $year): array
    {
        $teachers = DB::select(
            'SELECT t.id, t.code, t.full_name, t.gender, t.main_subject_id, s.name AS main_subject, s.code AS subject_code,
                g.id AS group_id, g.name AS group_name, g.color AS group_color,
                (SELECT COUNT(*) FROM sm_timetable tt JOIN sm_class_subjects cs ON cs.id = tt.class_subject_id JOIN sm_classes c ON c.id = tt.class_id AND c.school_year_id = ? WHERE cs.teacher_id = t.id) AS periods_per_week,
                (SELECT COUNT(*) FROM sm_class_subjects cs JOIN sm_classes c ON c.id = cs.class_id AND c.school_year_id = ? WHERE cs.teacher_id = t.id) AS class_count,
                (SELECT c.name FROM sm_classes c WHERE c.homeroom_teacher_id = t.id AND c.school_year_id = ? LIMIT 1) AS homeroom_class,
                (SELECT ROUND(AVG(gr.tbm), 2) FROM sm_grades gr WHERE gr.teacher_id = t.id AND gr.school_year_id = ? AND gr.tbm IS NOT NULL) AS avg_score,
                (SELECT COUNT(*) FROM sm_lesson_plans lp WHERE lp.teacher_id = t.id AND lp.status = "pending") AS pending_plans,
                (SELECT ROUND(AVG(o.score), 1) FROM sm_class_observations o WHERE o.teacher_id = t.id) AS obs_score
             FROM sm_teachers t JOIN sm_subjects s ON s.id = t.main_subject_id
             LEFT JOIN sm_subject_group_subjects gs ON gs.subject_id = t.main_subject_id
             LEFT JOIN sm_subject_groups g ON g.id = gs.group_id ORDER BY t.code', [$year, $year, $year, $year]);

        return ['quota' => Bgh::quota(), 'items' => $teachers];
    }

    public function teacherDetail(int $id, int $year): array
    {
        $t = DB::selectOne(
            'SELECT t.id, t.code, t.full_name, t.gender, t.main_subject_id, s.name AS main_subject FROM sm_teachers t JOIN sm_subjects s ON s.id = t.main_subject_id WHERE t.id = ?', [$id]);
        if (! $t) {
            throw new \DomainException('Không tìm thấy giáo viên.');
        }
        $assignments = DB::select(
            'SELECT cs.id, cs.class_id, c.name AS class_name, c.grade, s.id AS subject_id, s.name AS subject,
                (SELECT COUNT(*) FROM sm_timetable tt WHERE tt.class_subject_id = cs.id) AS periods
             FROM sm_class_subjects cs JOIN sm_classes c ON c.id = cs.class_id AND c.school_year_id = ? JOIN sm_subjects s ON s.id = cs.subject_id
             WHERE cs.teacher_id = ? ORDER BY c.grade, c.name', [$year, $id]);
        $plans = DB::select('SELECT id, title, week_no, status, submitted_at FROM sm_lesson_plans WHERE teacher_id = ? ORDER BY submitted_at DESC LIMIT 5', [$id]);
        $obs = DB::select(
            'SELECT o.id, o.observed_on, o.lesson_title, o.score, o.rating, c.name AS class_name FROM sm_class_observations o JOIN sm_classes c ON c.id = o.class_id WHERE o.teacher_id = ? ORDER BY o.observed_on DESC LIMIT 5', [$id]);

        return [
            'teacher' => $t, 'assignments' => $assignments, 'lesson_plans' => $plans, 'observations' => $obs,
            'schedule' => (new BghTimetableService())->teacherSchedule($id), 'quota' => Bgh::quota(),
        ];
    }

    /** Đổi giáo viên phụ trách một phân công (lớp–môn). Từ chối nếu giáo viên mới bị trùng tiết. */
    public function reassign(int $classSubjectId, int $newTeacherId, array $actor): array
    {
        return DB::transaction(function () use ($classSubjectId, $newTeacherId, $actor) {
            $cs = DB::selectOne(
                'SELECT cs.id, cs.class_id, cs.teacher_id, c.name AS class_name, c.school_year_id, s.name AS subject, t.full_name AS old_name
                 FROM sm_class_subjects cs JOIN sm_classes c ON c.id = cs.class_id JOIN sm_subjects s ON s.id = cs.subject_id
                 JOIN sm_teachers t ON t.id = cs.teacher_id WHERE cs.id = ? FOR UPDATE', [$classSubjectId]);
            if (! $cs) {
                throw new \DomainException('Không tìm thấy phân công giảng dạy.');
            }
            $new = DB::selectOne('SELECT id, full_name FROM sm_teachers WHERE id = ?', [$newTeacherId]);
            if (! $new) {
                throw new \DomainException('Giáo viên mới không tồn tại.');
            }
            if ((int) $cs->teacher_id === $newTeacherId) {
                throw new \DomainException('Giáo viên mới trùng với giáo viên hiện tại.');
            }

            $clash = DB::select(
                'SELECT tt.weekday, tt.period, c2.name AS class_name
                 FROM sm_timetable tt
                 JOIN sm_timetable mine ON mine.class_subject_id = ? AND mine.weekday = tt.weekday AND mine.period = tt.period
                 JOIN sm_class_subjects cs2 ON cs2.id = tt.class_subject_id AND cs2.teacher_id = ?
                 JOIN sm_classes c2 ON c2.id = tt.class_id AND c2.school_year_id = ?
                 ORDER BY tt.weekday, tt.period', [$classSubjectId, $newTeacherId, $cs->school_year_id]);
            if ($clash) {
                $list = implode('; ', array_map(fn ($r) => "Thứ {$r->weekday} tiết {$r->period} (đang dạy {$r->class_name})", $clash));
                throw new \DomainException("{$new->full_name} bị trùng lịch: $list.");
            }

            DB::update('UPDATE sm_class_subjects SET teacher_id = ? WHERE id = ?', [$newTeacherId, $classSubjectId]);
            Bgh::audit($actor, 'assignment.reassign', "{$cs->subject} lớp {$cs->class_name}: {$cs->old_name} → {$new->full_name}");
            Bgh::notify($actor, 'Điều chỉnh phân công giảng dạy', "{$new->full_name} nhận dạy {$cs->subject} lớp {$cs->class_name} (thay {$cs->old_name}).", 'academic');

            return ['class_subject_id' => $classSubjectId, 'class_name' => $cs->class_name, 'subject' => $cs->subject, 'from' => $cs->old_name, 'to' => $new->full_name];
        });
    }
}
