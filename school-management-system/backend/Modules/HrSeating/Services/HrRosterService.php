<?php

namespace Modules\HrSeating\Services;

use Illuminate\Support\Facades\DB;
use Modules\HrSeating\Support\Hr;

/** Danh sách lớp + sĩ số, gộp từ điểm, hạnh kiểm, tổ, cán sự, lưu ý chỗ ngồi, chỗ ngồi hiện tại, điểm danh. */
class HrRosterService
{
    public function build(array $ctx): array
    {
        $cid = $ctx['class_id'];
        $yr = $ctx['year_id'];
        $sem = $ctx['semester'];

        $rows = DB::select(
            'SELECT st.id, st.code, st.full_name, st.gender, st.birth_date
             FROM sm_enrollments e JOIN sm_students st ON st.id = e.student_id WHERE e.class_id = ? AND e.school_year_id = ?', [$cid, $yr]);

        $grades = [];
        foreach (DB::select(
            'SELECT g.student_id, AVG(g.tbm) AS avg_score, MIN(g.tbm) AS min_score FROM sm_grades g
             WHERE g.class_id = ? AND g.school_year_id = ? AND g.semester = ? AND g.tbm IS NOT NULL GROUP BY g.student_id', [$cid, $yr, $sem]) as $g) {
            $grades[(int) $g->student_id] = $g;
        }

        $conduct = [];
        $col = $sem === 1 ? 'hk1' : 'hk2';
        foreach (DB::select(
            "SELECT k.student_id, k.$col AS lv FROM sm_conduct k WHERE k.school_year_id = ?
             AND k.student_id IN (SELECT student_id FROM sm_enrollments WHERE class_id = ? AND school_year_id = ?)", [$yr, $cid, $yr]) as $k) {
            $conduct[(int) $k->student_id] = $k->lv;
        }

        $groupOf = [];
        foreach (DB::select(
            'SELECT m.student_id, g.id, g.number, g.name, g.color FROM sm_class_group_members m
             JOIN sm_class_groups g ON g.id = m.group_id WHERE g.class_id = ? AND g.school_year_id = ?', [$cid, $yr]) as $g) {
            $groupOf[(int) $g->student_id] = ['id' => (int) $g->id, 'number' => (int) $g->number, 'name' => $g->name, 'color' => $g->color];
        }

        $officerOf = [];
        foreach (DB::select('SELECT role, student_id FROM sm_class_officers WHERE class_id = ? AND school_year_id = ?', [$cid, $yr]) as $o) {
            $officerOf[(int) $o->student_id][] = $o->role;
        }

        $flags = [];
        foreach (DB::select(
            'SELECT f.* FROM sm_student_seat_flags f WHERE f.school_year_id = ?
             AND f.student_id IN (SELECT student_id FROM sm_enrollments WHERE class_id = ? AND school_year_id = ?)', [$yr, $cid, $yr]) as $f) {
            $flags[(int) $f->student_id] = [
                'vision' => (bool) $f->vision, 'hearing' => (bool) $f->hearing, 'tall' => (bool) $f->tall,
                'front_required' => (bool) $f->front_required,
                'avoid_ids' => array_map('intval', json_decode((string) $f->avoid_ids, true) ?: []), 'note' => $f->note,
            ];
        }

        $seatOf = [];
        $activeLayout = DB::selectOne('SELECT id, name, rows_n, cols_n, seats_per_desk FROM sm_seat_layouts WHERE class_id = ? AND is_active = 1 LIMIT 1', [$cid]);
        if ($activeLayout) {
            foreach (DB::select('SELECT student_id, seat_row, seat_col, seat_pos, locked FROM sm_seat_assignments WHERE layout_id = ?', [$activeLayout->id]) as $a) {
                $seatOf[(int) $a->student_id] = ['row' => (int) $a->seat_row, 'col' => (int) $a->seat_col, 'pos' => (int) $a->seat_pos, 'locked' => (bool) $a->locked];
            }
        }

        $att = $this->attendance(array_map(fn ($r) => (int) $r->id, $rows));

        $emptyFlags = ['vision' => false, 'hearing' => false, 'tall' => false, 'front_required' => false, 'avoid_ids' => [], 'note' => null];
        $students = [];
        foreach ($rows as $r) {
            $id = (int) $r->id;
            $g = $grades[$id] ?? null;
            $avg = $g ? round((float) $g->avg_score, 2) : null;
            $students[] = [
                'id' => $id, 'code' => $r->code, 'full_name' => $r->full_name, 'ten' => Hr::ten($r->full_name),
                'gender' => $r->gender, 'birth_date' => $r->birth_date, 'age' => Hr::age($r->birth_date),
                'days_to_birthday' => Hr::daysToBirthday($r->birth_date),
                'avg_score' => $avg, 'min_score' => $g ? round((float) $g->min_score, 1) : null,
                'level' => Hr::levelOf($avg, $g ? (float) $g->min_score : null),
                'conduct' => $conduct[$id] ?? null,
                'group' => $groupOf[$id] ?? null,
                'officer_roles' => $officerOf[$id] ?? [],
                'flags' => $flags[$id] ?? $emptyFlags,
                'seat' => $seatOf[$id] ?? null,
                'absent_30d' => $att['by'][$id]['n'] ?? ($att['ok'] ? 0 : null),
                'absent_today' => $att['ok'] ? (bool) ($att['by'][$id]['today'] ?? false) : null,
            ];
        }
        usort($students, fn ($a, $b) => strcmp(Hr::sortKey($a['full_name']), Hr::sortKey($b['full_name'])));

        return ['students' => $students, 'summary' => $this->summary($students, $activeLayout, $att['ok']), 'active_layout' => $activeLayout ? (int) $activeLayout->id : null];
    }

    private function summary(array $s, $layout, bool $attOk): array
    {
        $n = count($s);
        $male = count(array_filter($s, fn ($x) => $x['gender'] === 'Nam'));
        $level = ['Tốt' => 0, 'Khá' => 0, 'Đạt' => 0, 'Chưa đạt' => 0];
        $groups = [];
        $flagged = 0;
        $seated = 0;
        $month = (int) date('n');
        $birthdays = [];
        foreach ($s as $x) {
            if ($x['level']) {
                $level[$x['level']]++;
            }
            $gk = $x['group'] ? $x['group']['name'] : 'Chưa vào tổ';
            $groups[$gk] = ($groups[$gk] ?? 0) + 1;
            if ($x['flags']['vision'] || $x['flags']['hearing'] || $x['flags']['tall'] || $x['flags']['front_required'] || $x['flags']['avoid_ids']) {
                $flagged++;
            }
            if ($x['seat']) {
                $seated++;
            }
            if ((int) date('n', strtotime($x['birth_date'])) === $month) {
                $birthdays[] = ['id' => $x['id'], 'full_name' => $x['full_name'], 'birth_date' => $x['birth_date'], 'days' => $x['days_to_birthday']];
            }
        }
        usort($birthdays, fn ($a, $b) => $a['days'] <=> $b['days']);
        $ages = array_map(fn ($x) => $x['age'], $s);
        $scored = array_values(array_filter(array_map(fn ($x) => $x['avg_score'], $s), fn ($v) => $v !== null));

        return [
            'total' => $n, 'male' => $male, 'female' => $n - $male,
            'avg_age' => $n ? round(array_sum($ages) / $n, 1) : null,
            'avg_score' => $scored ? round(array_sum($scored) / count($scored), 2) : null,
            'levels' => $level, 'groups' => $groups, 'flagged' => $flagged,
            'seated' => $seated, 'unseated' => $n - $seated,
            'birthdays_month' => $birthdays,
            'attendance_linked' => $attOk,
            'absent_today' => $attOk ? count(array_filter($s, fn ($x) => $x['absent_today'])) : null,
        ];
    }

    /**
     * Liên kết điểm danh (tự dò): tìm bảng sm_*attend* có student_id + cột ngày + cột status.
     * Không thấy / sai cấu trúc thì trả về ok=false (giao diện sẽ ẩn phần này).
     */
    private function attendance(array $studentIds): array
    {
        if (! $studentIds) {
            return ['ok' => false, 'by' => []];
        }
        try {
            $tables = DB::select("SELECT TABLE_NAME AS t FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'sm\\_%attend%'");
            foreach ($tables as $t) {
                $name = $t->t;
                if (preg_match('/leave|case|alert|setting|history|report|lesson|session/i', $name)) {
                    continue;
                }
                $cols = array_map(fn ($r) => strtolower($r->c), DB::select('SELECT COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [$name]));
                $date = null;
                foreach (['att_date', 'attendance_date', 'mark_date', 'date', 'day'] as $d) {
                    if (in_array($d, $cols, true)) {
                        $date = $d;
                        break;
                    }
                }
                if (! $date || ! in_array('student_id', $cols, true) || ! in_array('status', $cols, true)) {
                    continue;
                }
                $in = implode(',', array_map('intval', $studentIds));
                $abs = "LOWER(`status`) IN ('absent','a','v','vang','vắng','unexcused','excused','absent_excused','absent_unexcused')";
                $rows = DB::select(
                    "SELECT student_id, SUM($abs) AS n, MAX(`$date` = CURDATE() AND $abs) AS today
                     FROM `$name` WHERE student_id IN ($in) AND `$date` >= CURDATE() - INTERVAL 30 DAY GROUP BY student_id");
                $by = [];
                foreach ($rows as $r) {
                    $by[(int) $r->student_id] = ['n' => (int) $r->n, 'today' => (bool) $r->today];
                }

                return ['ok' => true, 'by' => $by, 'table' => $name];
            }
        } catch (\Throwable $e) {
            // cấu trúc khác dự kiến: bỏ qua phần điểm danh
        }

        return ['ok' => false, 'by' => []];
    }
}
