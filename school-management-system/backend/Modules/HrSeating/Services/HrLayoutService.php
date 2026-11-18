<?php

namespace Modules\HrSeating\Services;

use Illuminate\Support\Facades\DB;
use Modules\HrSeating\Support\Hr;

/** Sơ đồ chỗ ngồi: danh sách, tạo, sửa, lưu chỗ, nhân bản, công bố, kiểm tra, tự xếp, xoay vòng. */
class HrLayoutService
{
    public function list(array $ctx): array
    {
        $rows = DB::select(
            'SELECT l.*, (SELECT COUNT(*) FROM sm_seat_assignments a WHERE a.layout_id = l.id) AS seated
             FROM sm_seat_layouts l WHERE l.class_id = ? ORDER BY l.is_active DESC, l.updated_at DESC, l.id DESC', [$ctx['class_id']]);

        return array_map(fn ($r) => $this->shape($r), $rows);
    }

    public function get(int $id, array $ctx): array
    {
        $l = $this->load($id, $ctx);
        $out = $this->shape($l);
        $out['seats'] = $this->seats($id);

        return $out;
    }

    public function create(array $d, array $ctx): array
    {
        [$rows, $cols, $per] = $this->size($d['rows_n'] ?? 5, $d['cols_n'] ?? 4, $d['seats_per_desk'] ?? 2);
        $from = $d['from'] ?? 'blank';
        $name = trim((string) ($d['name'] ?? '')) ?: 'Sơ đồ mới';

        return DB::transaction(function () use ($d, $ctx, $rows, $cols, $per, $from, $name) {
            DB::insert(
                'INSERT INTO sm_seat_layouts (class_id, school_year_id, semester, name, room_label, rows_n, cols_n, seats_per_desk, blocked, status, is_active, note, created_by, created_by_name, created_at, updated_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                [$ctx['class_id'], $ctx['year_id'], $ctx['semester'], mb_substr($name, 0, 120), $d['room_label'] ?? null, $rows, $cols, $per, '[]', 'draft', 0,
                 $d['note'] ?? null, $ctx['actor']['id'], $ctx['actor']['name'], date('Y-m-d H:i:s'), date('Y-m-d H:i:s')]);
            $id = (int) DB::getPdo()->lastInsertId();
            $layout = $this->shape($this->load($id, $ctx));

            if ($from === 'copy' && ! empty($d['source_id'])) {
                $src = $this->load((int) $d['source_id'], $ctx);
                $this->replaceSeats($id, array_values(array_filter($this->seats((int) $src->id), fn ($s) => $s['row'] < $rows && $s['col'] < $cols && $s['pos'] < $per)));
            } elseif ($from === 'alpha') {
                $roster = (new HrRosterService())->build($ctx)['students'];
                $res = HrAutoArrange::run($layout, $roster, [], 'alpha');
                $this->replaceSeats($id, $res['seats']);
            }
            Hr::event($ctx['class_id'], $id, 'create', "Tạo sơ đồ \"{$name}\" ({$rows}×{$cols}×{$per})", $ctx['actor']);

            return $this->get($id, $ctx);
        });
    }

    public function updateMeta(int $id, array $d, array $ctx): array
    {
        return DB::transaction(function () use ($id, $d, $ctx) {
            $l = $this->load($id, $ctx);
            [$rows, $cols, $per] = $this->size($d['rows_n'] ?? $l->rows_n, $d['cols_n'] ?? $l->cols_n, $d['seats_per_desk'] ?? $l->seats_per_desk);
            $name = array_key_exists('name', $d) ? mb_substr(trim((string) $d['name']), 0, 120) : $l->name;
            if ($name === '') {
                throw new \DomainException('Tên sơ đồ không được để trống.');
            }
            $removed = DB::delete('DELETE FROM sm_seat_assignments WHERE layout_id = ? AND (seat_row >= ? OR seat_col >= ? OR seat_pos >= ?)', [$id, $rows, $cols, $per]);
            $blocked = array_values(array_filter($this->blocked($l), function ($k) use ($rows, $cols, $per) {
                [$r, $c, $p] = array_map('intval', explode('-', $k));

                return $r < $rows && $c < $cols && $p < $per;
            }));
            DB::update(
                'UPDATE sm_seat_layouts SET name = ?, room_label = ?, note = ?, rows_n = ?, cols_n = ?, seats_per_desk = ?, blocked = ?, version = version + 1, updated_at = ? WHERE id = ?',
                [$name, $d['room_label'] ?? $l->room_label, $d['note'] ?? $l->note, $rows, $cols, $per, json_encode($blocked), date('Y-m-d H:i:s'), $id]);
            Hr::event($ctx['class_id'], $id, 'update', "Sửa thông tin sơ đồ \"$name\"" . ($removed ? " (gỡ $removed em ngoài vùng mới)" : ''), $ctx['actor']);
            $out = $this->get($id, $ctx);
            $out['removed'] = (int) $removed;

            return $out;
        });
    }

    public function saveSeats(int $id, array $seats, array $blocked, ?int $version, array $ctx): array
    {
        return DB::transaction(function () use ($id, $seats, $blocked, $version, $ctx) {
            $l = DB::selectOne('SELECT * FROM sm_seat_layouts WHERE id = ? AND class_id = ? FOR UPDATE', [$id, $ctx['class_id']]);
            if (! $l) {
                throw new \DomainException('Không tìm thấy sơ đồ.');
            }
            if ($version !== null && (int) $l->version !== $version) {
                throw new \DomainException('Sơ đồ vừa được sửa ở nơi khác. Hãy tải lại trang trước khi lưu.');
            }
            $rows = (int) $l->rows_n;
            $cols = (int) $l->cols_n;
            $per = (int) $l->seats_per_desk;
            $blockedSet = [];
            foreach ($blocked as $k) {
                if (! preg_match('/^\d+-\d+-\d+$/', (string) $k)) {
                    throw new \DomainException('Dữ liệu chỗ bị khóa không hợp lệ.');
                }
                [$r, $c, $p] = array_map('intval', explode('-', $k));
                if ($r < $rows && $c < $cols && $p < $per) {
                    $blockedSet[$k] = true;
                }
            }
            $mine = [];
            foreach (DB::select('SELECT student_id FROM sm_enrollments WHERE class_id = ? AND school_year_id = ?', [$ctx['class_id'], $ctx['year_id']]) as $s) {
                $mine[(int) $s->student_id] = true;
            }
            $seen = [];
            $usedSeat = [];
            $clean = [];
            foreach ($seats as $s) {
                $r = (int) ($s['row'] ?? -1);
                $c = (int) ($s['col'] ?? -1);
                $p = (int) ($s['pos'] ?? -1);
                $sid = (int) ($s['student_id'] ?? 0);
                if ($r < 0 || $r >= $rows || $c < 0 || $c >= $cols || $p < 0 || $p >= $per) {
                    throw new \DomainException('Có chỗ ngồi nằm ngoài sơ đồ.');
                }
                $k = Hr::key($r, $c, $p);
                if (isset($blockedSet[$k])) {
                    throw new \DomainException('Có học sinh được xếp vào chỗ đã bị khóa.');
                }
                if (! isset($mine[$sid])) {
                    throw new \DomainException("Học sinh #$sid không thuộc lớp này.");
                }
                if (isset($seen[$sid])) {
                    throw new \DomainException("Học sinh #$sid bị xếp vào hai chỗ.");
                }
                if (isset($usedSeat[$k])) {
                    throw new \DomainException('Có hai học sinh cùng một chỗ.');
                }
                $seen[$sid] = true;
                $usedSeat[$k] = true;
                $clean[] = ['row' => $r, 'col' => $c, 'pos' => $p, 'student_id' => $sid, 'locked' => ! empty($s['locked']), 'note' => isset($s['note']) ? mb_substr((string) $s['note'], 0, 120) : null];
            }
            $this->replaceSeats($id, $clean);
            DB::update('UPDATE sm_seat_layouts SET blocked = ?, version = version + 1, updated_at = ? WHERE id = ?', [json_encode(array_keys($blockedSet)), date('Y-m-d H:i:s'), $id]);
            Hr::event($ctx['class_id'], $id, 'save', 'Lưu sơ đồ: ' . count($clean) . ' học sinh đã xếp chỗ', $ctx['actor']);

            return $this->get($id, $ctx);
        });
    }

    public function duplicate(int $id, array $ctx): array
    {
        $l = $this->load($id, $ctx);

        return $this->create([
            'name' => mb_substr($l->name, 0, 100) . ' (bản sao)', 'rows_n' => $l->rows_n, 'cols_n' => $l->cols_n,
            'seats_per_desk' => $l->seats_per_desk, 'room_label' => $l->room_label, 'note' => $l->note, 'from' => 'copy', 'source_id' => $id,
        ], $ctx);
    }

    public function publish(int $id, array $ctx): array
    {
        return DB::transaction(function () use ($id, $ctx) {
            $l = $this->load($id, $ctx);
            $n = (int) DB::selectOne('SELECT COUNT(*) AS n FROM sm_seat_assignments WHERE layout_id = ?', [$id])->n;
            if ($n === 0) {
                throw new \DomainException('Sơ đồ chưa có học sinh nào, chưa thể công bố.');
            }
            DB::update("UPDATE sm_seat_layouts SET is_active = 0, status = IF(status = 'published', 'archived', status) WHERE class_id = ? AND is_active = 1 AND id <> ?", [$ctx['class_id'], $id]);
            DB::update("UPDATE sm_seat_layouts SET is_active = 1, status = 'published', published_at = ?, updated_at = ? WHERE id = ?", [date('Y-m-d H:i:s'), date('Y-m-d H:i:s'), $id]);
            Hr::event($ctx['class_id'], $id, 'publish', "Công bố sơ đồ \"{$l->name}\" ($n học sinh)", $ctx['actor']);

            return $this->get($id, $ctx);
        });
    }

    public function delete(int $id, array $ctx): void
    {
        $l = $this->load($id, $ctx);
        if ((int) $l->is_active === 1) {
            throw new \DomainException('Đây là sơ đồ đang áp dụng. Hãy công bố sơ đồ khác trước khi xóa.');
        }
        DB::delete('DELETE FROM sm_seat_layouts WHERE id = ?', [$id]);
        Hr::event($ctx['class_id'], null, 'delete', "Xóa sơ đồ \"{$l->name}\"", $ctx['actor']);
    }

    /** Cảnh báo: chưa xếp chỗ, em cận thị ngồi xa, em cao ngồi trước, cặp không nên ngồi cạnh, thiếu chỗ. */
    public function check(int $id, array $ctx): array
    {
        $l = $this->shape($this->load($id, $ctx));
        $students = (new HrRosterService())->build($ctx)['students'];
        $by = [];
        foreach ($students as $s) {
            $by[$s['id']] = $s;
        }
        $seats = $this->seats($id);
        $seated = [];
        $assign = [];
        $info = [];
        foreach ($seats as $s) {
            $seated[$s['student_id']] = $s;
            $k = Hr::key($s['row'], $s['col'], $s['pos']);
            $assign[$k] = $s['student_id'];
            $info[$k] = [$s['row'], $s['col'], $s['pos']];
        }
        $w = [];
        $names = fn (array $ids) => array_values(array_map(fn ($i) => $by[$i]['full_name'], array_filter($ids, fn ($i) => isset($by[$i]))));

        $un = array_values(array_map(fn ($s) => $s['id'], array_filter($students, fn ($s) => ! isset($seated[$s['id']]))));
        $cap = $l['rows_n'] * $l['cols_n'] * $l['seats_per_desk'] - count($l['blocked']);
        if ($cap < count($students)) {
            $w[] = ['level' => 'error', 'code' => 'capacity', 'text' => 'Sơ đồ chỉ có ' . $cap . ' chỗ nhưng lớp có ' . count($students) . ' học sinh.', 'students' => []];
        }
        if ($un) {
            $w[] = ['level' => 'warn', 'code' => 'unseated', 'text' => count($un) . ' học sinh chưa được xếp chỗ.', 'students' => $names($un), 'ids' => $un];
        }
        $far = [];
        $tall = [];
        foreach ($seated as $sid => $s) {
            $f = $by[$sid]['flags'] ?? null;
            if (! $f) {
                continue;
            }
            if (($f['front_required'] || $f['vision'] || $f['hearing']) && $s['row'] > 1) {
                $far[] = $sid;
            }
            if ($f['tall'] && $s['row'] <= 1 && $l['rows_n'] > 2) {
                $tall[] = $sid;
            }
        }
        if ($far) {
            $w[] = ['level' => 'warn', 'code' => 'front', 'text' => 'Học sinh cận thị / nghe kém / cần ngồi trước đang ngồi xa bảng.', 'students' => $names($far), 'ids' => $far];
        }
        if ($tall) {
            $w[] = ['level' => 'info', 'code' => 'tall', 'text' => 'Học sinh cao đang ngồi bàn đầu, có thể che tầm nhìn.', 'students' => $names($tall), 'ids' => $tall];
        }
        $avoid = [];
        foreach ($students as $s) {
            foreach ($s['flags']['avoid_ids'] as $o) {
                $avoid[$s['id']][$o] = true;
            }
        }
        $pairs = $avoid ? HrAutoArrange::conflicts($assign, $info, $avoid, $l['seats_per_desk']) : [];
        if ($pairs) {
            $w[] = ['level' => 'error', 'code' => 'avoid', 'text' => count($pairs) . ' cặp học sinh đang ngồi cạnh nhau dù đã đánh dấu không nên ngồi cạnh.',
                'students' => array_map(fn ($p) => ($by[$p[0]]['full_name'] ?? '?') . ' – ' . ($by[$p[1]]['full_name'] ?? '?'), $pairs), 'ids' => array_values(array_unique(array_merge(...$pairs)))];
        }

        return ['warnings' => $w, 'ok' => count(array_filter($w, fn ($x) => $x['level'] !== 'info')) === 0, 'seated' => count($seated), 'total' => count($students)];
    }

    public function auto(int $id, string $mode, array $opts, array $ctx): array
    {
        if (! in_array($mode, HrAutoArrange::MODES, true)) {
            throw new \DomainException('Kiểu xếp chỗ không hợp lệ.');
        }
        $l = $this->shape($this->load($id, $ctx));
        $students = (new HrRosterService())->build($ctx)['students'];
        $res = HrAutoArrange::run($l, $students, $this->seats($id), $mode, $opts);
        Hr::event($ctx['class_id'], $id, 'auto', "Xem trước xếp tự động ($mode)", $ctx['actor']);

        return $res;
    }

    public function rotate(int $id, string $dir, bool $reverse, array $ctx): array
    {
        if (! in_array($dir, ['rows', 'cols'], true)) {
            throw new \DomainException('Kiểu xoay vòng không hợp lệ.');
        }
        $l = $this->shape($this->load($id, $ctx));
        $students = (new HrRosterService())->build($ctx)['students'];

        return HrAutoArrange::rotate($l, $students, $this->seats($id), $dir, $reverse);
    }

    // ---------------------------------------------------------------------------------
    private function load(int $id, array $ctx): object
    {
        $l = DB::selectOne(
            'SELECT l.*, (SELECT COUNT(*) FROM sm_seat_assignments a WHERE a.layout_id = l.id) AS seated FROM sm_seat_layouts l WHERE l.id = ? AND l.class_id = ?', [$id, $ctx['class_id']]);
        if (! $l) {
            throw new \DomainException('Không tìm thấy sơ đồ của lớp này.');
        }

        return $l;
    }

    private function blocked(object $l): array
    {
        return array_values(array_map('strval', json_decode((string) $l->blocked, true) ?: []));
    }

    private function shape(object $l): array
    {
        return [
            'id' => (int) $l->id, 'class_id' => (int) $l->class_id, 'semester' => (int) $l->semester, 'name' => $l->name, 'room_label' => $l->room_label,
            'rows_n' => (int) $l->rows_n, 'cols_n' => (int) $l->cols_n, 'seats_per_desk' => (int) $l->seats_per_desk,
            'blocked' => $this->blocked($l), 'status' => $l->status, 'is_active' => (bool) $l->is_active, 'note' => $l->note, 'version' => (int) $l->version,
            'created_by_name' => $l->created_by_name, 'created_at' => $l->created_at, 'updated_at' => $l->updated_at, 'published_at' => $l->published_at,
            'seated' => (int) ($l->seated ?? 0),
        ];
    }

    private function seats(int $id): array
    {
        return array_map(fn ($a) => [
            'row' => (int) $a->seat_row, 'col' => (int) $a->seat_col, 'pos' => (int) $a->seat_pos,
            'student_id' => (int) $a->student_id, 'locked' => (bool) $a->locked, 'note' => $a->note,
        ], DB::select('SELECT seat_row, seat_col, seat_pos, student_id, locked, note FROM sm_seat_assignments WHERE layout_id = ? ORDER BY seat_row, seat_col, seat_pos', [$id]));
    }

    private function replaceSeats(int $id, array $seats): void
    {
        DB::delete('DELETE FROM sm_seat_assignments WHERE layout_id = ?', [$id]);
        foreach (array_chunk($seats, 100) as $chunk) {
            $ph = implode(',', array_fill(0, count($chunk), '(?,?,?,?,?,?,?)'));
            $bind = [];
            foreach ($chunk as $s) {
                array_push($bind, $id, $s['row'], $s['col'], $s['pos'], $s['student_id'], ! empty($s['locked']) ? 1 : 0, $s['note'] ?? null);
            }
            DB::insert("INSERT INTO sm_seat_assignments (layout_id, seat_row, seat_col, seat_pos, student_id, locked, note) VALUES $ph", $bind);
        }
    }

    private function size($rows, $cols, $per): array
    {
        $rows = (int) $rows;
        $cols = (int) $cols;
        $per = (int) $per;
        if ($rows < 1 || $rows > 12 || $cols < 1 || $cols > 8 || $per < 1 || $per > 3) {
            throw new \DomainException('Kích thước sơ đồ không hợp lệ (1–12 dãy, 1–8 cột bàn, 1–3 chỗ mỗi bàn).');
        }

        return [$rows, $cols, $per];
    }
}
