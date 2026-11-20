<?php

namespace Modules\TeacherAdmin\Services;

use Illuminate\Support\Facades\DB;
use Modules\TeacherAdmin\Support\Audit;

class TeacherService
{
    public const FIELDS = ['code', 'full_name', 'gender', 'main_subject_id', 'birth_date', 'phone', 'email', 'address',
        'degree', 'position', 'hire_date', 'contract', 'status', 'note'];

    public function __construct(private WorkloadService $load) {}

    public function meta(int $yearId): array
    {
        return [
            'years'    => DB::table('sm_school_years')->orderByDesc('id')->get(['id', 'label', 'is_current']),
            'subjects' => DB::table('sm_subjects')->orderBy('sort_order')->get(['id', 'code', 'name', 'color', 'kind']),
            'classes'  => DB::table('sm_classes')->where('school_year_id', $yearId)->orderBy('grade')->orderBy('name')->get(['id', 'name', 'grade', 'homeroom_teacher_id']),
            'quota'    => (int) config('teacheradmin.teacher_quota', 17),
            'reduction' => (int) config('teacheradmin.homeroom_reduction', 4),
            'degrees'  => ['bachelor' => 'Cử nhân', 'master' => 'Thạc sĩ', 'doctor' => 'Tiến sĩ', 'other' => 'Khác'],
            'contracts' => ['permanent' => 'Biên chế', 'contract' => 'Hợp đồng', 'probation' => 'Tập sự', 'part_time' => 'Thỉnh giảng'],
            'statuses' => ['active' => 'Đang công tác', 'leave' => 'Nghỉ dài hạn', 'inactive' => 'Tạm ngưng', 'retired' => 'Đã nghỉ hưu'],
        ];
    }

    public function list(array $f, int $yearId): array
    {
        $loads = $this->load->loads($yearId);
        $q = DB::table('sm_teachers as t')->leftJoin('sm_subjects as s', 's.id', '=', 't.main_subject_id');
        if (! empty($f['q'])) {
            $k = '%' . $f['q'] . '%';
            $q->where(fn ($w) => $w->where('t.full_name', 'like', $k)->orWhere('t.code', 'like', $k)->orWhere('t.phone', 'like', $k)->orWhere('t.email', 'like', $k));
        }
        foreach (['status', 'degree', 'contract', 'gender'] as $c) {
            if (! empty($f[$c])) {
                $q->where("t.$c", $f[$c]);
            }
        }
        if (! empty($f['subject_id'])) {
            $sid = (int) $f['subject_id'];
            $q->whereIn('t.id', DB::table('sm_tch_subjects')->where('subject_id', $sid)->select('teacher_id'));
        }
        $rows = $q->orderBy('t.full_name')->get(['t.*', 's.name as main_subject', 's.color as main_color']);
        $subj = DB::table('sm_tch_subjects as ts')->join('sm_subjects as s', 's.id', '=', 'ts.subject_id')
            ->get(['ts.teacher_id', 's.id', 's.name', 's.color', 'ts.is_main'])->groupBy('teacher_id');
        $hr = DB::table('sm_classes')->where('school_year_id', $yearId)->whereNotNull('homeroom_teacher_id')->pluck('name', 'homeroom_teacher_id');

        $out = [];
        foreach ($rows as $t) {
            $l = $loads[$t->id] ?? ['periods' => 0, 'slots' => 0, 'homeroom' => false];
            $quota = $this->load->quota($l['homeroom']);
            $row = (array) $t;
            $row['subjects'] = ($subj[$t->id] ?? collect())->map(fn ($x) => (array) $x)->values()->all();
            $row['homeroom_class'] = $hr[$t->id] ?? null;
            $row['periods'] = $l['periods'];
            $row['classes'] = $l['slots'];
            $row['quota'] = $quota;
            $row['load_status'] = $l['periods'] > $quota ? 'over' : ($l['periods'] < $quota * 0.6 ? 'under' : 'ok');
            $out[] = $row;
        }
        if (! empty($f['load'])) {
            $out = array_values(array_filter($out, fn ($r) => $r['load_status'] === $f['load']));
        }
        if (! empty($f['homeroom'])) {
            $want = $f['homeroom'] === '1';
            $out = array_values(array_filter($out, fn ($r) => (bool) $r['homeroom_class'] === $want));
        }

        return $out;
    }

    public function show(int $id, int $yearId): ?array
    {
        $t = DB::table('sm_teachers')->find($id);
        if (! $t) {
            return null;
        }
        $row = (array) $t;
        $row['subject_ids'] = DB::table('sm_tch_subjects')->where('teacher_id', $id)->pluck('subject_id')->all();
        $row['certs'] = DB::table('sm_tch_certs')->where('teacher_id', $id)->orderByDesc('issued_at')->get();
        $row['leaves'] = DB::table('sm_tch_leaves')->where('teacher_id', $id)->orderByDesc('from_date')->limit(20)->get();
        $row['assignments'] = DB::table('sm_class_subjects as cs')->join('sm_classes as c', 'c.id', '=', 'cs.class_id')
            ->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->leftJoin('sm_subj_curriculum as cur', fn ($j) => $j->on('cur.subject_id', '=', 's.id')->on('cur.grade', '=', 'c.grade'))
            ->where('cs.teacher_id', $id)->where('c.school_year_id', $yearId)->orderBy('c.grade')->orderBy('c.name')
            ->selectRaw('cs.id, c.name as class_name, c.grade, s.name as subject_name, s.color, COALESCE(cur.periods_per_week, s.periods_per_week) as periods')->get();
        $row['homeroom_class'] = DB::table('sm_classes')->where('school_year_id', $yearId)->where('homeroom_teacher_id', $id)->value('name');
        $l = $this->load->loads($yearId)[$id] ?? ['periods' => 0, 'slots' => 0, 'homeroom' => false];
        $row['periods'] = $l['periods'];
        $row['quota'] = $this->load->quota($l['homeroom']);
        $row['students'] = (int) DB::table('sm_class_subjects as cs')->join('sm_classes as c', 'c.id', '=', 'cs.class_id')
            ->join('sm_students as st', 'st.class_id', '=', 'cs.class_id')->where('cs.teacher_id', $id)->where('c.school_year_id', $yearId)->distinct()->count('st.id');

        return $row;
    }

    private function payload(array $d): array
    {
        $p = array_intersect_key($d, array_flip(self::FIELDS));
        foreach (['gender', 'birth_date', 'phone', 'email', 'address', 'hire_date', 'note', 'main_subject_id'] as $k) {
            if (array_key_exists($k, $p) && $p[$k] === '') {
                $p[$k] = null;
            }
        }

        return $p;
    }

    private function syncSubjects(int $id, ?array $ids, ?int $main): void
    {
        $ids = array_values(array_unique(array_map('intval', $ids ?? [])));
        if ($main && ! in_array($main, $ids, true)) {
            $ids[] = $main;
        }
        DB::table('sm_tch_subjects')->where('teacher_id', $id)->delete();
        foreach ($ids as $sid) {
            DB::table('sm_tch_subjects')->insert(['teacher_id' => $id, 'subject_id' => $sid, 'is_main' => $sid === $main ? 1 : 0]);
        }
    }

    public function create(array $d): int
    {
        return DB::transaction(function () use ($d) {
            $p = $this->payload($d);
            $p['status'] = $p['status'] ?? 'active';
            $p['created_at'] = now();
            $p['updated_at'] = now();
            $id = (int) DB::table('sm_teachers')->insertGetId($p);
            $this->syncSubjects($id, $d['subject_ids'] ?? null, $p['main_subject_id'] ?? null);
            Audit::log('create', "Thêm giáo viên {$p['full_name']} ({$p['code']})", $id);

            return $id;
        });
    }

    public function update(int $id, array $d): bool
    {
        $old = DB::table('sm_teachers')->find($id);
        if (! $old) {
            return false;
        }
        DB::transaction(function () use ($id, $d, $old) {
            $p = $this->payload($d);
            $p['updated_at'] = now();
            DB::table('sm_teachers')->where('id', $id)->update($p);
            if (array_key_exists('subject_ids', $d) || array_key_exists('main_subject_id', $d)) {
                $main = $p['main_subject_id'] ?? $old->main_subject_id;
                $this->syncSubjects($id, $d['subject_ids'] ?? DB::table('sm_tch_subjects')->where('teacher_id', $id)->pluck('subject_id')->all(), $main ? (int) $main : null);
            }
            $changed = [];
            foreach ($p as $k => $v) {
                if ($k !== 'updated_at' && (string) ($old->$k ?? '') !== (string) $v) {
                    $changed[] = $k;
                }
            }
            Audit::log('update', "Sửa {$old->full_name}: " . ($changed ? implode(', ', $changed) : 'không đổi'), $id);
        });

        return true;
    }

    /** Trả về [ok, message]. Chặn xóa khi còn phân công / chủ nhiệm. */
    public function delete(int $id): array
    {
        $t = DB::table('sm_teachers')->find($id);
        if (! $t) {
            return [false, 'Không tìm thấy giáo viên'];
        }
        $use = DB::table('sm_class_subjects')->where('teacher_id', $id)->count();
        $hr = DB::table('sm_classes')->where('homeroom_teacher_id', $id)->count();
        $grades = DB::table('sm_grades')->where('teacher_id', $id)->count();
        if ($use || $hr || $grades) {
            return [false, "Không thể xóa: còn $use phân công, $hr lớp chủ nhiệm, $grades điểm đã nhập. Hãy chuyển trạng thái sang \"Đã nghỉ hưu\"/\"Tạm ngưng\"."];
        }
        DB::transaction(function () use ($id, $t) {
            DB::table('sm_tch_subjects')->where('teacher_id', $id)->delete();
            DB::table('sm_tch_certs')->where('teacher_id', $id)->delete();
            DB::table('sm_tch_leaves')->where('teacher_id', $id)->delete();
            DB::table('sm_teachers')->where('id', $id)->delete();
            Audit::log('delete', "Xóa giáo viên {$t->full_name} ({$t->code})", null);
        });

        return [true, 'Đã xóa giáo viên'];
    }

    public function bulk(array $ids, string $action, ?string $value): array
    {
        $n = 0;
        foreach ($ids as $id) {
            if ($action === 'status' && in_array($value, ['active', 'leave', 'inactive', 'retired'], true)) {
                $n += DB::table('sm_teachers')->where('id', $id)->update(['status' => $value, 'updated_at' => now()]);
            } elseif ($action === 'contract' && in_array($value, ['permanent', 'contract', 'probation', 'part_time'], true)) {
                $n += DB::table('sm_teachers')->where('id', $id)->update(['contract' => $value, 'updated_at' => now()]);
            } elseif ($action === 'delete') {
                [$ok] = $this->delete((int) $id);
                $n += $ok ? 1 : 0;
            }
        }
        Audit::log('bulk', "Thao tác hàng loạt '$action' trên " . count($ids) . " giáo viên, thành công $n");

        return ['affected' => $n, 'total' => count($ids)];
    }

    // ---- Chứng chỉ ----
    public function addCert(int $teacherId, array $d): int
    {
        $id = (int) DB::table('sm_tch_certs')->insertGetId([
            'teacher_id' => $teacherId, 'name' => $d['name'], 'issuer' => $d['issuer'] ?? null,
            'issued_at' => ($d['issued_at'] ?? null) ?: null, 'expires_at' => ($d['expires_at'] ?? null) ?: null, 'created_at' => now(),
        ]);
        Audit::log('cert', "Thêm chứng chỉ {$d['name']}", $teacherId);

        return $id;
    }

    public function deleteCert(int $id): bool
    {
        $c = DB::table('sm_tch_certs')->find($id);
        if (! $c) {
            return false;
        }
        DB::table('sm_tch_certs')->where('id', $id)->delete();
        Audit::log('cert', "Xóa chứng chỉ {$c->name}", $c->teacher_id);

        return true;
    }

    // ---- Import / export ----
    public function export(): array
    {
        return DB::table('sm_teachers as t')->leftJoin('sm_subjects as s', 's.id', '=', 't.main_subject_id')
            ->orderBy('t.code')->get(['t.code', 't.full_name', 't.gender', 's.code as subject_code', 't.birth_date', 't.phone', 't.email',
                't.degree', 't.position', 't.hire_date', 't.contract', 't.status'])->map(fn ($r) => (array) $r)->all();
    }

    public function import(array $rows, bool $dry): array
    {
        $subj = DB::table('sm_subjects')->pluck('id', 'code')->mapWithKeys(fn ($v, $k) => [strtoupper($k) => $v]);
        $res = ['created' => 0, 'updated' => 0, 'errors' => []];
        foreach ($rows as $i => $r) {
            $line = $i + 2;
            $code = trim($r['code'] ?? '');
            $name = trim($r['full_name'] ?? '');
            if ($code === '' || $name === '') {
                $res['errors'][] = "Dòng $line: thiếu mã hoặc họ tên";
                continue;
            }
            $sc = strtoupper(trim($r['subject_code'] ?? ''));
            if ($sc !== '' && ! isset($subj[$sc])) {
                $res['errors'][] = "Dòng $line: môn '$sc' không tồn tại";
                continue;
            }
            $d = ['code' => $code, 'full_name' => $name, 'gender' => $r['gender'] ?? null, 'main_subject_id' => $sc !== '' ? $subj[$sc] : null,
                'birth_date' => $r['birth_date'] ?? null, 'phone' => $r['phone'] ?? null, 'email' => $r['email'] ?? null,
                'degree' => in_array($r['degree'] ?? '', ['bachelor', 'master', 'doctor', 'other'], true) ? $r['degree'] : 'bachelor',
                'position' => ($r['position'] ?? '') ?: 'Giáo viên', 'hire_date' => $r['hire_date'] ?? null,
                'contract' => in_array($r['contract'] ?? '', ['permanent', 'contract', 'probation', 'part_time'], true) ? $r['contract'] : 'permanent',
                'status' => in_array($r['status'] ?? '', ['active', 'leave', 'inactive', 'retired'], true) ? $r['status'] : 'active'];
            $exist = DB::table('sm_teachers')->where('code', $code)->value('id');
            if ($exist) {
                $res['updated']++;
                if (! $dry) {
                    $this->update((int) $exist, $d);
                }
            } else {
                $res['created']++;
                if (! $dry) {
                    $this->create($d);
                }
            }
        }

        return $res;
    }

    public function audit(?int $teacherId, int $limit = 100): array
    {
        return DB::table('sm_tch_audit')->when($teacherId, fn ($q) => $q->where('teacher_id', $teacherId))
            ->orderByDesc('id')->limit($limit)->get()->all();
    }
}
