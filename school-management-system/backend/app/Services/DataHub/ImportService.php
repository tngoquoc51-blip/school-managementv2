<?php

namespace App\Services\DataHub;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Nhập dữ liệu theo từng "lô" (batch) và từng "mảnh" (chunk ≤ 500 dòng):
 *   validate()  – kiểm tra trước, không ghi gì
 *   start()     – tạo lô
 *   chunk()     – ghi một mảnh (thêm mới / cập nhật), lưu dấu vết để hoàn tác
 *   finish()    – chốt lô
 *   undo()      – hoàn tác cả lô
 */
class ImportService
{
    private const MESSAGES = [
        'required' => ':Attribute không được để trống.',
        'email'    => ':Attribute không hợp lệ.',
        'integer'  => ':Attribute phải là số nguyên.',
        'numeric'  => ':Attribute phải là số.',
        'date'     => ':Attribute không phải ngày hợp lệ.',
        'boolean'  => ':Attribute không hợp lệ.',
        'in'       => ':Attribute không nằm trong giá trị cho phép.',
        'max.string'  => ':Attribute tối đa :max ký tự.',
        'min.integer' => ':Attribute tối thiểu là :min.',
        'max.integer' => ':Attribute tối đa là :max.',
    ];

    public function __construct(private DatasetRegistry $reg, private Normalizer $norm) {}

    private function fail(string $message): ValidationException
    {
        return ValidationException::withMessages(['import' => [$message]]);
    }

    /* ===================== chuẩn bị & lập kế hoạch ===================== */

    private function lookup(array $lk, string $value, array &$ctx): ?int
    {
        $ck = $lk['table'] . '.' . $lk['match'];
        if (! isset($ctx['lookup'][$ck])) {
            $map = [];
            if (Schema::hasTable($lk['table']) && Schema::hasColumn($lk['table'], $lk['match'])) {
                foreach (DB::table($lk['table'])->select('id', $lk['match'])->get() as $r) {
                    $map[Normalizer::unaccent((string) $r->{$lk['match']})] = (int) $r->id;
                }
            }
            $ctx['lookup'][$ck] = $map;
        }
        return $ctx['lookup'][$ck][Normalizer::unaccent($value)] ?? null;
    }

    private function prepare(array $ds, array $raw, array &$ctx): array
    {
        $errors = [];
        $data = [];
        $usable = $this->reg->usableFields($ds);

        foreach ($usable as $k => $f) {
            if (! array_key_exists($k, $raw)) {
                continue;
            }
            [$val, $err] = $this->norm->value($f, $raw[$k]);
            if ($err) {
                $errors[] = $f['label'] . ': ' . $err;
                continue;
            }
            if (($f['type'] ?? '') === 'lookup' && $val !== null) {
                $id = $this->lookup($f['lookup'], (string) $val, $ctx);
                if ($id === null) {
                    $errors[] = $f['label'] . ": không tìm thấy '{$val}' trong hệ thống";
                    continue;
                }
                $val = $id;
            }
            $data[$k] = $val;
        }

        if (! $errors) {
            $rules = [];
            $names = [];
            foreach ($usable as $k => $f) {
                $required = in_array('required', $f['rules'] ?? [], true);
                if (array_key_exists($k, $data) || $required) {
                    $rules[$k] = $f['rules'] ?? ['nullable'];
                    $names[$k] = mb_strtolower($f['label']);
                }
            }
            $v = Validator::make($data, $rules, self::MESSAGES, $names);
            if ($v->fails()) {
                foreach ($v->errors()->all() as $m) {
                    $errors[] = $m;
                }
            }
        }

        return ['data' => $data, 'errors' => $errors];
    }

    private function existing(array $ds, array $keys): array
    {
        $map = [];
        $keys = array_values(array_unique($keys));
        foreach (array_chunk($keys, 500) as $chunk) {
            foreach (DB::table($ds['table'])->whereIn($ds['upsert'], $chunk)->pluck('id', $ds['upsert']) as $k => $id) {
                $map[mb_strtolower((string) $k)] = (int) $id;
            }
        }
        return $map;
    }

    private function plan(array $ds, array $rows, string $mode, array &$ctx): array
    {
        if (! $this->reg->exists($ds)) {
            throw $this->fail("Bảng '{$ds['table']}' chưa có trong cơ sở dữ liệu.");
        }
        $upsert = $ds['upsert'];
        if (! Schema::hasColumn($ds['table'], $upsert)) {
            throw $this->fail("Bảng '{$ds['table']}' chưa có cột khóa '{$upsert}' để nhận diện bản ghi.");
        }
        $keyLabel = $ds['fields'][$upsert]['label'] ?? $upsert;

        $prepared = [];
        $keys = [];
        foreach ($rows as $i => $r) {
            $p = $this->prepare($ds, (array) ($r['d'] ?? []), $ctx);
            $p['n'] = (int) ($r['n'] ?? ($i + 1));
            $key = $p['data'][$upsert] ?? null;
            if ($key === null || $key === '') {
                if (! $p['errors']) {
                    $p['errors'][] = $keyLabel . ': không được để trống';
                }
            } else {
                $keys[] = (string) $key;
            }
            $prepared[$i] = $p;
        }

        $existing = $this->existing($ds, $keys);
        foreach ($prepared as &$p) {
            $p['action'] = null;
            if ($p['errors']) {
                continue;
            }
            $id = $existing[mb_strtolower((string) $p['data'][$upsert])] ?? null;
            if ($mode === 'insert') {
                if ($id) {
                    $p['errors'][] = "{$keyLabel} '{$p['data'][$upsert]}' đã tồn tại – chế độ \"chỉ thêm mới\" nên bỏ qua";
                } else {
                    $p['action'] = 'insert';
                }
            } elseif ($mode === 'update') {
                if (! $id) {
                    $p['errors'][] = "Không tìm thấy {$keyLabel} '{$p['data'][$upsert]}' để cập nhật";
                } else {
                    $p['action'] = 'update';
                    $p['id'] = $id;
                }
            } elseif ($id) {
                $p['action'] = 'update';
                $p['id'] = $id;
            } else {
                $p['action'] = 'insert';
            }
        }
        unset($p);

        return $prepared;
    }

    /* ===================== kiểm tra trước ===================== */

    public function validate(string $dsId, array $rows, string $mode): array
    {
        $ds = $this->reg->get($dsId);
        $ctx = [];
        $plan = $this->plan($ds, $rows, $mode, $ctx);

        $out = [];
        $c = ['insert' => 0, 'update' => 0, 'error' => 0];
        foreach ($plan as $p) {
            if ($p['errors']) {
                $c['error']++;
                $out[] = ['n' => $p['n'], 'action' => null, 'errors' => $p['errors']];
            } else {
                $c[$p['action']]++;
                $out[] = ['n' => $p['n'], 'action' => $p['action'], 'errors' => []];
            }
        }
        return ['results' => $out, 'counts' => $c];
    }

    /* ===================== ghi dữ liệu ===================== */

    public function start(string $dsId, string $mode, ?string $filename, int $total, array $options, ?int $userId): int
    {
        $ds = $this->reg->get($dsId);
        if (! $this->reg->exists($ds)) {
            throw $this->fail("Bảng '{$ds['table']}' chưa có trong cơ sở dữ liệu.");
        }
        if ($total > (int) config('data_hub.max_rows_total', 20000)) {
            throw $this->fail('Số dòng vượt giới hạn cho phép của một lần nhập.');
        }

        return (int) DB::table('admin_import_batches')->insertGetId([
            'dataset' => $dsId, 'filename' => $filename, 'mode' => $mode,
            'options' => json_encode($options, JSON_UNESCAPED_UNICODE), 'total' => $total,
            'status' => 'running', 'created_by' => $userId, 'started_at' => now(),
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function chunk(int $batchId, array $rows): array
    {
        $batch = DB::table('admin_import_batches')->where('id', $batchId)->first();
        if (! $batch || $batch->status !== 'running') {
            throw $this->fail('Lô nhập không còn ở trạng thái đang chạy.');
        }

        $ds = $this->reg->get($batch->dataset);
        $opts = json_decode($batch->options ?? '{}', true) ?: [];
        $ctx = [];
        $plan = $this->plan($ds, $rows, $batch->mode, $ctx);

        $t = $ds['table'];
        $cols = $this->reg->tableColumns($ds);
        $hasCreated = in_array('created_at', $cols, true);
        $hasUpdated = in_array('updated_at', $cols, true);
        $acc = $ds['account'] ?? null;
        $hash = null;
        $ins = $upd = $same = $fail = 0;
        $errs = [];

        DB::transaction(function () use ($plan, $batchId, $ds, $t, $cols, $hasCreated, $hasUpdated, $opts, $acc, &$hash, &$ins, &$upd, &$same, &$fail, &$errs) {
            foreach ($plan as $p) {
                if ($p['errors']) {
                    $fail++;
                    $errs[] = ['row' => $p['n'], 'message' => implode('; ', $p['errors'])];
                    continue;
                }
                try {
                    if ($p['action'] === 'insert') {
                        $data = $p['data'];
                        if ($hasCreated) $data['created_at'] = now();
                        if ($hasUpdated) $data['updated_at'] = now();

                        // tạo tài khoản đăng nhập kèm theo (chỉ khi thêm mới)
                        if (! empty($opts['create_accounts']) && $acc && in_array($acc['password'] ?? '', $cols, true) && ! isset($data[$acc['password']])) {
                            $hash ??= Hash::make((string) config('data_hub.default_password'));
                            $data[$acc['password']] = $hash;
                            if (in_array($acc['must_change'] ?? '', $cols, true)) {
                                $data[$acc['must_change']] = 1;
                            }
                        }

                        $id = (int) DB::table($t)->insertGetId($data);
                        DB::table('admin_import_items')->insert(['batch_id' => $batchId, 'record_id' => $id, 'action' => 'insert', 'before' => null, 'created_at' => now()]);
                        $ins++;
                    } else {
                        $data = $p['data'];
                        unset($data[$ds['upsert']]);
                        if (! $data) {
                            $same++;
                            continue;
                        }
                        $before = (array) DB::table($t)->where('id', $p['id'])->first(array_keys($data));
                        $changed = [];
                        foreach ($data as $k => $v) {
                            if ((string) ($before[$k] ?? '') !== (string) ($v ?? '')) {
                                $changed[$k] = $v;
                            }
                        }
                        if (! $changed) {
                            $same++;
                            continue;
                        }
                        $write = $changed;
                        if ($hasUpdated) $write['updated_at'] = now();
                        DB::table($t)->where('id', $p['id'])->update($write);
                        DB::table('admin_import_items')->insert([
                            'batch_id' => $batchId, 'record_id' => $p['id'], 'action' => 'update',
                            'before' => json_encode(array_intersect_key($before, $changed), JSON_UNESCAPED_UNICODE), 'created_at' => now(),
                        ]);
                        $upd++;
                    }
                } catch (QueryException $e) {
                    $fail++;
                    $errs[] = ['row' => $p['n'], 'message' => 'Không ghi được vào cơ sở dữ liệu (kiểm tra dữ liệu liên kết hoặc giá trị trùng).'];
                }
            }
        });

        // cập nhật bộ đếm + gộp lỗi (tối đa 1000)
        $old = json_decode((string) ($batch->errors ?? '[]'), true) ?: [];
        $merged = array_slice(array_merge($old, $errs), 0, 1000);
        DB::table('admin_import_batches')->where('id', $batchId)->update([
            'processed' => DB::raw('processed + ' . count($rows)),
            'inserted'  => DB::raw('inserted + ' . $ins),
            'updated'   => DB::raw('updated + ' . $upd),
            'unchanged' => DB::raw('unchanged + ' . $same),
            'failed'    => DB::raw('failed + ' . $fail),
            'errors'    => json_encode($merged, JSON_UNESCAPED_UNICODE),
            'updated_at' => now(),
        ]);

        return ['inserted' => $ins, 'updated' => $upd, 'unchanged' => $same, 'failed' => $fail, 'errors' => $errs];
    }

    public function finish(int $batchId, bool $cancelled = false): array
    {
        $b = DB::table('admin_import_batches')->where('id', $batchId)->first();
        if (! $b) {
            throw $this->fail('Không tìm thấy lô nhập.');
        }
        if ($b->status === 'running') {
            $status = $cancelled ? 'cancelled' : ((int) $b->failed > 0 ? 'completed_with_errors' : 'completed');
            DB::table('admin_import_batches')->where('id', $batchId)->update(['status' => $status, 'finished_at' => now(), 'updated_at' => now()]);
        }
        return $this->show($batchId);
    }

    public function show(int $batchId): array
    {
        $b = DB::table('admin_import_batches')->where('id', $batchId)->first();
        if (! $b) {
            throw $this->fail('Không tìm thấy lô nhập.');
        }
        $arr = (array) $b;
        $arr['errors'] = json_decode((string) ($b->errors ?? '[]'), true) ?: [];
        $arr['options'] = json_decode((string) ($b->options ?? '{}'), true) ?: [];
        $days = (int) config('data_hub.undo_days', 14);
        $arr['can_undo'] = in_array($b->status, ['completed', 'completed_with_errors'], true)
            && ! $b->undone_at && ($b->inserted + $b->updated) > 0
            && $b->finished_at && now()->diffInDays($b->finished_at) <= $days;
        return $arr;
    }

    /* ===================== hoàn tác ===================== */

    public function undo(int $batchId, ?int $userId): array
    {
        $info = $this->show($batchId);
        if (! $info['can_undo']) {
            throw $this->fail('Lô nhập này không thể hoàn tác (đã hoàn tác, quá hạn hoặc không có thay đổi).');
        }
        $ds = $this->reg->get($info['dataset']);
        $t = $ds['table'];
        $removed = $restored = $blocked = 0;

        DB::transaction(function () use ($batchId, $t, &$removed, &$restored, &$blocked) {
            $items = DB::table('admin_import_items')->where('batch_id', $batchId)->orderByDesc('id')->get();
            foreach ($items as $it) {
                try {
                    if ($it->action === 'insert') {
                        $removed += DB::table($t)->where('id', $it->record_id)->delete();
                    } else {
                        $before = json_decode((string) $it->before, true) ?: [];
                        if ($before) {
                            DB::table($t)->where('id', $it->record_id)->update($before);
                        }
                        $restored++;
                    }
                } catch (QueryException $e) {
                    $blocked++; // đang được bảng khác sử dụng nên không xóa được
                }
            }
            DB::table('admin_import_batches')->where('id', $batchId)->update(['status' => 'undone', 'undone_at' => now(), 'updated_at' => now()]);
        });

        return ['removed' => $removed, 'restored' => $restored, 'blocked' => $blocked];
    }
}
