<?php

namespace Modules\Subject\Services;

use Illuminate\Support\Facades\DB;
use Modules\Subject\Support\Audit;

class SubjectService
{
    private const SORTS = ['sort_order', 'code', 'name', 'periods_per_week', 'classes_count', 'teachers_count', 'updated_at'];

    /* ------------------------------------------------------------ danh sách */
    public function list(array $f): array
    {
        $yearId = Audit::currentYearId($f['school_year_id'] ?? null);
        $per    = max(5, min((int) ($f['per_page'] ?? 12), 100));

        $q = DB::table('sm_subjects as s')
            ->leftJoin('sm_subj_groups as g', 'g.id', '=', 's.group_id')
            ->selectRaw(
                's.*, g.name as group_name, g.code as group_code,
                 (SELECT COUNT(*) FROM sm_class_subjects cs JOIN sm_classes c ON c.id = cs.class_id
                   WHERE cs.subject_id = s.id AND c.school_year_id = ?) AS classes_count,
                 (SELECT COUNT(DISTINCT cs.teacher_id) FROM sm_class_subjects cs JOIN sm_classes c ON c.id = cs.class_id
                   WHERE cs.subject_id = s.id AND c.school_year_id = ?) AS teachers_count,
                 (SELECT COUNT(*) FROM sm_teachers t WHERE t.main_subject_id = s.id) AS specialist_count',
                [$yearId, $yearId]
            );

        if (! empty($f['search'])) {
            $kw = '%' . trim($f['search']) . '%';
            $q->where(fn ($w) => $w->where('s.code', 'like', $kw)->orWhere('s.name', 'like', $kw));
        }
        foreach (['kind', 'category', 'status'] as $col) {
            if (! empty($f[$col])) {
                $q->where("s.$col", $f[$col]);
            }
        }
        if (! empty($f['group_id'])) {
            $f['group_id'] === 'none' ? $q->whereNull('s.group_id') : $q->where('s.group_id', (int) $f['group_id']);
        }
        if (! empty($f['grade'])) {
            $q->whereRaw("CONCAT(',', s.grades, ',') LIKE ?", ['%,' . (int) $f['grade'] . ',%']);
        }

        $sort = in_array($f['sort'] ?? '', self::SORTS, true) ? $f['sort'] : 'sort_order';
        $dir  = strtolower($f['dir'] ?? 'asc') === 'desc' ? 'desc' : 'asc';
        $q->orderBy($sort, $dir)->orderBy('s.id');

        $p = $q->paginate($per, ['*'], 'page', (int) ($f['page'] ?? 1));

        return [
            'items' => collect($p->items())->map(fn ($r) => $this->shape($r))->all(),
            'meta'  => ['page' => $p->currentPage(), 'per_page' => $p->perPage(), 'total' => $p->total(), 'last_page' => $p->lastPage(), 'school_year_id' => $yearId],
        ];
    }

    private function shape($r): array
    {
        $a = (array) $r;
        $a['grades'] = array_values(array_filter(array_map('intval', explode(',', (string) ($a['grades'] ?? '')))));
        foreach (['classes_count', 'teachers_count', 'specialist_count', 'periods_per_week', 'id', 'sort_order', 'group_id'] as $k) {
            if (isset($a[$k])) {
                $a[$k] = (int) $a[$k];
            }
        }

        return $a;
    }

    /* -------------------------------------------------------------- chi tiết */
    public function detail(int $id, ?int $yearId = null): ?array
    {
        $yearId = Audit::currentYearId($yearId);
        $s = DB::table('sm_subjects as s')->leftJoin('sm_subj_groups as g', 'g.id', '=', 's.group_id')
            ->where('s.id', $id)->selectRaw('s.*, g.name as group_name')->first();
        if (! $s) {
            return null;
        }
        $out = $this->shape($s);

        $out['curriculum'] = DB::table('sm_subj_curriculum')->where('subject_id', $id)->orderBy('grade')->get()->all();

        $out['assignments'] = DB::table('sm_class_subjects as cs')
            ->join('sm_classes as c', 'c.id', '=', 'cs.class_id')
            ->join('sm_teachers as t', 't.id', '=', 'cs.teacher_id')
            ->where('cs.subject_id', $id)->where('c.school_year_id', $yearId)
            ->orderBy('c.grade')->orderBy('c.name')
            ->get(['cs.id', 'c.id as class_id', 'c.name as class_name', 'c.grade', 't.id as teacher_id', 't.code as teacher_code', 't.full_name as teacher_name'])->all();

        $out['specialists'] = DB::table('sm_teachers')->where('main_subject_id', $id)->orderBy('full_name')
            ->get(['id', 'code', 'full_name', 'gender'])->all();

        $out['usage'] = $this->usage($id);

        $stats = DB::table('sm_grades as g')->where('g.subject_id', $id)->where('g.school_year_id', $yearId)->whereNotNull('g.tbm')
            ->selectRaw('g.semester, COUNT(*) as n, AVG(g.tbm) as avg_tbm')->groupBy('g.semester')->get();
        $out['stats'] = $stats->map(fn ($x) => ['semester' => (int) $x->semester, 'n' => (int) $x->n, 'avg' => round((float) $x->avg_tbm, 2)])->all();

        return $out;
    }

    /** Mức độ liên kết của môn với các chức năng khác. */
    public function usage(int $id): array
    {
        return [
            'class_subjects' => DB::table('sm_class_subjects')->where('subject_id', $id)->count(),
            'timetable'      => DB::table('sm_timetable as tt')->join('sm_class_subjects as cs', 'cs.id', '=', 'tt.class_subject_id')->where('cs.subject_id', $id)->count(),
            'grades'         => DB::table('sm_grades')->where('subject_id', $id)->count(),
            'teachers'       => DB::table('sm_teachers')->where('main_subject_id', $id)->count(),
        ];
    }

    /* ------------------------------------------------------------------ ghi */
    public function create(array $d): int
    {
        return DB::transaction(function () use ($d) {
            $row = $this->payload($d);
            $row['sort_order'] = $d['sort_order'] ?? ((int) DB::table('sm_subjects')->max('sort_order') + 1);
            $row['created_at'] = $row['updated_at'] = now();
            $id = (int) DB::table('sm_subjects')->insertGetId($row);
            $this->seedCurriculum($id, $row, $d['curriculum'] ?? null);
            Audit::log('create', "Tạo môn {$row['code']} - {$row['name']}", $id);

            return $id;
        });
    }

    public function update(int $id, array $d): void
    {
        DB::transaction(function () use ($id, $d) {
            $row = $this->payload($d);
            $row['updated_at'] = now();
            if (isset($d['sort_order'])) {
                $row['sort_order'] = $d['sort_order'];
            }
            DB::table('sm_subjects')->where('id', $id)->update($row);

            // Đồng bộ chương trình các khối còn áp dụng; khối bị bỏ thì xóa cấu hình
            $grades = $this->gradesArray($d['grades'] ?? [10, 11, 12]);
            DB::table('sm_subj_curriculum')->where('subject_id', $id)->whereNotIn('grade', $grades)->delete();
            $this->seedCurriculum($id, $row, null);
            if (! empty($d['sync_periods'])) {
                DB::table('sm_subj_curriculum')->where('subject_id', $id)->update([
                    'periods_per_week' => $row['periods_per_week'], 'periods_total' => $row['periods_per_week'] * 35, 'updated_at' => now(),
                ]);
            }
            Audit::log('update', "Cập nhật môn {$row['code']} - {$row['name']}", $id);
        });
    }

    private function payload(array $d): array
    {
        return [
            'code'             => strtoupper(trim($d['code'])),
            'name'             => trim($d['name']),
            'kind'             => $d['kind'],
            'category'         => $d['category'] ?? 'required',
            'periods_per_week' => (int) $d['periods_per_week'],
            'group_id'         => $d['group_id'] ?? null,
            'color'            => $d['color'] ?? 'indigo',
            'grades'           => implode(',', $this->gradesArray($d['grades'] ?? [10, 11, 12])),
            'description'      => $d['description'] ?? null,
            'status'           => $d['status'] ?? 'active',
        ];
    }

    private function gradesArray($g): array
    {
        $g = array_values(array_unique(array_filter(array_map('intval', (array) $g), fn ($x) => in_array($x, [10, 11, 12], true))));
        sort($g);

        return $g ?: [10, 11, 12];
    }

    private function seedCurriculum(int $id, array $row, ?array $custom): void
    {
        foreach ($this->gradesArray(explode(',', $row['grades'])) as $grade) {
            if (DB::table('sm_subj_curriculum')->where(['subject_id' => $id, 'grade' => $grade])->exists()) {
                continue;
            }
            DB::table('sm_subj_curriculum')->insert([
                'subject_id' => $id, 'grade' => $grade,
                'periods_per_week' => $row['periods_per_week'], 'periods_total' => $row['periods_per_week'] * 35,
                'tx_count' => $row['kind'] === 'pass' ? 0 : 3, 'w_tx' => 1, 'w_gk' => 2, 'w_ck' => 3,
                'is_required' => $row['category'] === 'required' ? 1 : 0, 'updated_at' => now(),
            ]);
        }
    }

    /* ------------------------------------------------------------------ xóa */
    /** @return array{ok:bool, usage?:array} */
    public function delete(int $id): array
    {
        $s = DB::table('sm_subjects')->find($id);
        if (! $s) {
            return ['ok' => false, 'missing' => true];
        }
        $usage = $this->usage($id);
        if (array_sum($usage) > 0) {
            return ['ok' => false, 'usage' => $usage];
        }
        DB::transaction(function () use ($id, $s) {
            DB::table('sm_subj_curriculum')->where('subject_id', $id)->delete();
            DB::table('sm_subjects')->where('id', $id)->delete();
            Audit::log('delete', "Xóa môn {$s->code} - {$s->name}", $id);
        });

        return ['ok' => true];
    }

    public function bulk(string $action, array $ids): array
    {
        $done = 0;
        $skipped = [];
        foreach (array_unique($ids) as $id) {
            if ($action === 'delete') {
                $r = $this->delete((int) $id);
                $r['ok'] ? $done++ : $skipped[] = (int) $id;
            } else {
                $st = $action === 'activate' ? 'active' : 'inactive';
                $done += DB::table('sm_subjects')->where('id', $id)->update(['status' => $st, 'updated_at' => now()]);
            }
        }
        Audit::log('bulk_' . $action, "Thao tác hàng loạt ($action): $done môn" . ($skipped ? ', bỏ qua ' . count($skipped) . ' môn đang được sử dụng' : ''));

        return ['done' => $done, 'skipped' => $skipped];
    }

    public function duplicate(int $id): ?int
    {
        $s = DB::table('sm_subjects')->find($id);
        if (! $s) {
            return null;
        }

        return DB::transaction(function () use ($s) {
            $base = $s->code;
            $n = 2;
            while (DB::table('sm_subjects')->where('code', mb_substr($base, 0, 7) . "-$n")->exists()) {
                $n++;
            }
            $new = (array) $s;
            unset($new['id']);
            $new['code'] = mb_substr($base, 0, 7) . "-$n";
            $new['name'] = mb_substr($s->name, 0, 50) . ' (bản sao)';
            $new['status'] = 'inactive';
            $new['sort_order'] = (int) DB::table('sm_subjects')->max('sort_order') + 1;
            $new['created_at'] = $new['updated_at'] = now();
            $newId = (int) DB::table('sm_subjects')->insertGetId($new);
            foreach (DB::table('sm_subj_curriculum')->where('subject_id', $s->id)->get() as $c) {
                $c = (array) $c;
                unset($c['id']);
                $c['subject_id'] = $newId;
                DB::table('sm_subj_curriculum')->insert($c);
            }
            Audit::log('duplicate', "Nhân bản môn {$s->code} → {$new['code']}", $newId);

            return $newId;
        });
    }

    public function reorder(array $ids): void
    {
        DB::transaction(function () use ($ids) {
            foreach (array_values($ids) as $i => $id) {
                DB::table('sm_subjects')->where('id', $id)->update(['sort_order' => min($i + 1, 127)]);
            }
        });
        Audit::log('reorder', 'Sắp xếp lại thứ tự hiển thị môn học');
    }

    /* ------------------------------------------------------------ xuất / nhập */
    public function exportRows(): array
    {
        return DB::table('sm_subjects as s')->leftJoin('sm_subj_groups as g', 'g.id', '=', 's.group_id')
            ->orderBy('s.sort_order')
            ->get(['s.code', 's.name', 's.kind', 's.category', 's.periods_per_week', 'g.code as group_code', 's.grades', 's.status', 's.description'])
            ->map(fn ($r) => (array) $r)->all();
    }

    public function import(array $rows, bool $dryRun): array
    {
        $groups = DB::table('sm_subj_groups')->pluck('id', 'code');
        $report = [];
        $ops = [];
        foreach ($rows as $i => $r) {
            $line = $i + 1;
            $code = strtoupper(trim((string) ($r['code'] ?? '')));
            $name = trim((string) ($r['name'] ?? ''));
            $kind = strtolower(trim((string) ($r['kind'] ?? 'score')));
            $cat  = strtolower(trim((string) ($r['category'] ?? 'required')));
            $ppw  = (int) ($r['periods_per_week'] ?? 0);
            $err  = null;
            if ($code === '' || ! preg_match('/^[A-Z0-9_-]{1,10}$/', $code)) {
                $err = 'Mã môn không hợp lệ (tối đa 10 ký tự A-Z, 0-9, -, _)';
            } elseif ($name === '' || mb_strlen($name) > 60) {
                $err = 'Tên môn bắt buộc, tối đa 60 ký tự';
            } elseif (! in_array($kind, ['score', 'pass'], true)) {
                $err = 'Loại môn phải là score hoặc pass';
            } elseif (! in_array($cat, ['required', 'elective', 'topic'], true)) {
                $err = 'Nhóm môn phải là required / elective / topic';
            } elseif ($ppw < 1 || $ppw > 10) {
                $err = 'Số tiết/tuần phải từ 1 đến 10';
            }
            $gcode = strtoupper(trim((string) ($r['group_code'] ?? '')));
            if (! $err && $gcode !== '' && ! isset($groups[$gcode])) {
                $err = "Không tìm thấy tổ bộ môn '$gcode'";
            }
            $exists = ! $err && DB::table('sm_subjects')->where('code', $code)->exists();
            $report[] = ['line' => $line, 'code' => $code, 'name' => $name, 'action' => $err ? 'error' : ($exists ? 'update' : 'create'), 'error' => $err];
            if (! $err) {
                $ops[] = [
                    'exists' => $exists,
                    'data' => [
                        'code' => $code, 'name' => $name, 'kind' => $kind, 'category' => $cat, 'periods_per_week' => $ppw,
                        'group_id' => $gcode !== '' ? $groups[$gcode] : null,
                        'grades' => array_filter(array_map('intval', explode(',', (string) ($r['grades'] ?? '10,11,12')))),
                        'status' => in_array(($r['status'] ?? 'active'), ['active', 'inactive'], true) ? ($r['status'] ?? 'active') : 'active',
                        'description' => $r['description'] ?? null,
                    ],
                ];
            }
        }
        if (! $dryRun) {
            DB::transaction(function () use ($ops) {
                foreach ($ops as $op) {
                    if ($op['exists']) {
                        $id = (int) DB::table('sm_subjects')->where('code', $op['data']['code'])->value('id');
                        $this->update($id, $op['data']);
                    } else {
                        $this->create($op['data']);
                    }
                }
            });
            Audit::log('import', 'Nhập môn học từ tệp CSV: ' . count($ops) . ' dòng hợp lệ');
        }

        return ['rows' => $report, 'valid' => count($ops), 'errors' => count($report) - count($ops), 'applied' => ! $dryRun];
    }

    /* ----------------------------------------------------------- chương trình */
    public function saveCurriculum(int $subjectId, array $rows): void
    {
        DB::transaction(function () use ($subjectId, $rows) {
            foreach ($rows as $r) {
                DB::table('sm_subj_curriculum')->updateOrInsert(
                    ['subject_id' => $subjectId, 'grade' => (int) $r['grade']],
                    [
                        'periods_per_week' => (int) $r['periods_per_week'], 'periods_total' => (int) $r['periods_total'],
                        'tx_count' => (int) $r['tx_count'], 'w_tx' => (int) $r['w_tx'], 'w_gk' => (int) $r['w_gk'], 'w_ck' => (int) $r['w_ck'],
                        'is_required' => ! empty($r['is_required']) ? 1 : 0, 'updated_at' => now(),
                    ]
                );
            }
        });
        $s = DB::table('sm_subjects')->find($subjectId);
        Audit::log('curriculum', "Cập nhật chương trình/hệ số điểm môn {$s->name}", $subjectId);
    }

    public function curriculumAll(): array
    {
        return DB::table('sm_subj_curriculum as c')->join('sm_subjects as s', 's.id', '=', 'c.subject_id')
            ->orderBy('s.sort_order')->orderBy('c.grade')
            ->get(['c.*', 's.code', 's.name', 's.color', 's.kind'])->all();
    }
}
