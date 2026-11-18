<?php

namespace Modules\HrSeating\Services;

use Illuminate\Support\Facades\DB;
use Modules\HrSeating\Support\Hr;

/** Tổ học tập, ban cán sự, lưu ý chỗ ngồi của từng học sinh. */
class HrGroupService
{
    public function groups(array $ctx): array
    {
        $groups = DB::select('SELECT id, number, name, color, leader_student_id FROM sm_class_groups WHERE class_id = ? AND school_year_id = ? ORDER BY number', [$ctx['class_id'], $ctx['year_id']]);
        $members = [];
        foreach (DB::select('SELECT m.group_id, m.student_id FROM sm_class_group_members m JOIN sm_class_groups g ON g.id = m.group_id WHERE g.class_id = ? AND g.school_year_id = ?', [$ctx['class_id'], $ctx['year_id']]) as $m) {
            $members[(int) $m->group_id][] = (int) $m->student_id;
        }

        return array_map(fn ($g) => [
            'id' => (int) $g->id, 'number' => (int) $g->number, 'name' => $g->name, 'color' => $g->color,
            'leader_student_id' => $g->leader_student_id ? (int) $g->leader_student_id : null, 'members' => $members[(int) $g->id] ?? [],
        ], $groups);
    }

    /** Lưu toàn bộ tổ: [{number,name,color,leader_student_id,members:[id]}]. */
    public function saveGroups(array $groups, array $ctx): array
    {
        if (count($groups) < 1 || count($groups) > 8) {
            throw new \DomainException('Số tổ phải từ 1 đến 8.');
        }

        return DB::transaction(function () use ($groups, $ctx) {
            $mine = $this->classStudents($ctx);
            $used = [];
            $keep = [];
            foreach ($groups as $i => $g) {
                $no = $i + 1;
                $name = mb_substr(trim((string) ($g['name'] ?? '')) ?: "Tổ $no", 0, 60);
                $color = preg_match('/^#[0-9a-fA-F]{6}$/', (string) ($g['color'] ?? '')) ? $g['color'] : '#1d6fe0';
                $members = array_values(array_unique(array_map('intval', $g['members'] ?? [])));
                foreach ($members as $sid) {
                    if (! isset($mine[$sid])) {
                        throw new \DomainException("Học sinh #$sid không thuộc lớp này.");
                    }
                    if (isset($used[$sid])) {
                        throw new \DomainException("Học sinh #$sid bị xếp vào hai tổ.");
                    }
                    $used[$sid] = true;
                }
                $leader = isset($g['leader_student_id']) ? (int) $g['leader_student_id'] : null;
                if ($leader && ! in_array($leader, $members, true)) {
                    throw new \DomainException('Tổ trưởng phải là thành viên của tổ.');
                }
                DB::statement(
                    'INSERT INTO sm_class_groups (class_id, school_year_id, number, name, color, leader_student_id) VALUES (?,?,?,?,?,?)
                     ON DUPLICATE KEY UPDATE name = VALUES(name), color = VALUES(color), leader_student_id = VALUES(leader_student_id)',
                    [$ctx['class_id'], $ctx['year_id'], $no, $name, $color, $leader ?: null]);
                $gid = (int) DB::selectOne('SELECT id FROM sm_class_groups WHERE class_id = ? AND school_year_id = ? AND number = ?', [$ctx['class_id'], $ctx['year_id'], $no])->id;
                $keep[] = $gid;
                DB::delete('DELETE FROM sm_class_group_members WHERE group_id = ?', [$gid]);
                foreach ($members as $sid) {
                    DB::insert('INSERT INTO sm_class_group_members (group_id, student_id) VALUES (?, ?)', [$gid, $sid]);
                }
            }
            $in = implode(',', array_map('intval', $keep));
            DB::delete("DELETE FROM sm_class_groups WHERE class_id = ? AND school_year_id = ? AND id NOT IN ($in)", [$ctx['class_id'], $ctx['year_id']]);
            Hr::event($ctx['class_id'], null, 'groups', 'Cập nhật ' . count($groups) . ' tổ học tập', $ctx['actor']);

            return $this->groups($ctx);
        });
    }

    /** Chia tổ cân bằng nam/nữ và học lực (bản đề xuất, chưa lưu). */
    public function autoSplit(int $n, array $ctx): array
    {
        if ($n < 2 || $n > 8) {
            throw new \DomainException('Số tổ phải từ 2 đến 8.');
        }
        $students = (new HrRosterService())->build($ctx)['students'];
        $male = array_values(array_filter($students, fn ($s) => $s['gender'] === 'Nam'));
        $female = array_values(array_filter($students, fn ($s) => $s['gender'] !== 'Nam'));
        $cmp = fn ($a, $b) => ($b['avg_score'] ?? 0) <=> ($a['avg_score'] ?? 0);
        usort($male, $cmp);
        usort($female, $cmp);
        $buckets = array_fill(0, $n, []);
        $i = 0;
        $dir = 1;
        foreach (array_merge($male, $female) as $s) {
            $buckets[$i][] = $s['id'];
            $i += $dir;
            if ($i >= $n || $i < 0) {
                $dir = -$dir;
                $i += $dir;
            }
        }
        $colors = ['#2563eb', '#0891b2', '#059669', '#f97316', '#7c3aed', '#0d9488', '#d97706', '#475569'];
        $out = [];
        foreach ($buckets as $k => $ids) {
            $out[] = ['number' => $k + 1, 'name' => 'Tổ ' . ($k + 1), 'color' => $colors[$k % 8], 'leader_student_id' => $ids[0] ?? null, 'members' => $ids];
        }

        return $out;
    }

    public function officers(array $ctx): array
    {
        $map = array_fill_keys(array_keys(Hr::OFFICER_ROLES), null);
        foreach (DB::select('SELECT role, student_id FROM sm_class_officers WHERE class_id = ? AND school_year_id = ?', [$ctx['class_id'], $ctx['year_id']]) as $o) {
            $map[$o->role] = (int) $o->student_id;
        }

        return ['roles' => Hr::OFFICER_ROLES, 'assigned' => $map];
    }

    public function saveOfficers(array $map, array $ctx): array
    {
        return DB::transaction(function () use ($map, $ctx) {
            $mine = $this->classStudents($ctx);
            DB::delete('DELETE FROM sm_class_officers WHERE class_id = ? AND school_year_id = ?', [$ctx['class_id'], $ctx['year_id']]);
            $n = 0;
            foreach (Hr::OFFICER_ROLES as $role => $label) {
                $sid = isset($map[$role]) ? (int) $map[$role] : 0;
                if (! $sid) {
                    continue;
                }
                if (! isset($mine[$sid])) {
                    throw new \DomainException("Học sinh #$sid không thuộc lớp này.");
                }
                DB::insert('INSERT INTO sm_class_officers (class_id, school_year_id, role, student_id) VALUES (?,?,?,?)', [$ctx['class_id'], $ctx['year_id'], $role, $sid]);
                $n++;
            }
            Hr::event($ctx['class_id'], null, 'officers', "Cập nhật ban cán sự lớp ($n chức danh)", $ctx['actor']);

            return $this->officers($ctx);
        });
    }

    public function saveFlag(int $studentId, array $d, array $ctx): array
    {
        $mine = $this->classStudents($ctx);
        if (! isset($mine[$studentId])) {
            throw new \DomainException('Học sinh không thuộc lớp này.');
        }
        $avoid = array_values(array_unique(array_filter(array_map('intval', $d['avoid_ids'] ?? []), fn ($i) => $i !== $studentId && isset($mine[$i]))));
        $b = fn ($k) => ! empty($d[$k]) ? 1 : 0;
        DB::statement(
            'INSERT INTO sm_student_seat_flags (student_id, school_year_id, vision, hearing, tall, front_required, avoid_ids, note, updated_at) VALUES (?,?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE vision = VALUES(vision), hearing = VALUES(hearing), tall = VALUES(tall), front_required = VALUES(front_required),
             avoid_ids = VALUES(avoid_ids), note = VALUES(note), updated_at = VALUES(updated_at)',
            [$studentId, $ctx['year_id'], $b('vision'), $b('hearing'), $b('tall'), $b('front_required'), json_encode($avoid), isset($d['note']) ? mb_substr((string) $d['note'], 0, 255) : null, date('Y-m-d H:i:s')]);
        Hr::event($ctx['class_id'], null, 'flag', 'Cập nhật lưu ý chỗ ngồi cho học sinh #' . $studentId, $ctx['actor']);

        return ['student_id' => $studentId, 'vision' => (bool) $b('vision'), 'hearing' => (bool) $b('hearing'), 'tall' => (bool) $b('tall'),
            'front_required' => (bool) $b('front_required'), 'avoid_ids' => $avoid, 'note' => $d['note'] ?? null];
    }

    public function events(array $ctx, int $limit = 40): array
    {
        return DB::select(
            'SELECT e.id, e.layout_id, e.action, e.detail, e.actor_name, e.created_at FROM sm_seat_events e WHERE e.class_id = ? ORDER BY e.id DESC LIMIT ' . (int) $limit, [$ctx['class_id']]);
    }

    private function classStudents(array $ctx): array
    {
        $m = [];
        foreach (DB::select('SELECT student_id FROM sm_enrollments WHERE class_id = ? AND school_year_id = ?', [$ctx['class_id'], $ctx['year_id']]) as $s) {
            $m[(int) $s->student_id] = true;
        }

        return $m;
    }
}
