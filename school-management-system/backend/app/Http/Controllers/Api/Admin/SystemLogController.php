<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Middleware\RequireSystemAdmin;
use App\Services\SystemLog\LegacyLogImporter;
use App\Services\SystemLog\SystemLogService;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** API Nhật ký hệ thống — prefix /api/v1/admin/logs (xem routes/system_logs.php) */
class SystemLogController extends Controller
{
    private const FILTER_KEYS = ['range', 'from', 'to', 'level', 'min_level', 'category', 'action', 'actor', 'actor_type', 'ip', 'source', 'request_id',
        'subject_type', 'subject_id', 'status', 'q', 'pinned', 'sort', 'dir', 'page', 'per_page'];

    public function __construct(private SystemLogService $svc) {}

    private function ok(mixed $data = null, string $message = '', int $status = 200): JsonResponse
    {
        return response()->json(['success' => true, 'message' => $message, 'data' => $data], $status);
    }

    private function fail(string $message, int $status = 422): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $message], $status);
    }

    private function uid(Request $r): ?int
    {
        return $r->user()?->id;
    }

    private function filters(Request $r): array
    {
        return $r->only(self::FILTER_KEYS);
    }

    public function meta(Request $r)
    {
        return $this->ok($this->svc->meta(RequireSystemAdmin::can($r->user(), 'manage')));
    }

    public function overview(Request $r)
    {
        return $this->ok($this->svc->overview((string) $r->query('range', '24h')));
    }

    public function events(Request $r)
    {
        (new LegacyLogImporter())->syncThrottled();

        return $this->ok($this->svc->list($this->filters($r), $this->uid($r)));
    }

    public function event(Request $r, int $id)
    {
        $d = $this->svc->show($id, $this->uid($r));

        return $d ? $this->ok($d) : $this->fail('Không tìm thấy sự kiện.', 404);
    }

    public function stream(Request $r)
    {
        return $this->ok($this->svc->stream((int) $r->query('after_id', 0), $this->filters($r), $this->uid($r)));
    }

    public function export(Request $r)
    {
        $format = $r->query('format') === 'json' ? 'json' : 'csv';
        $rows = $this->svc->exportRows($this->filters($r), $this->uid($r));

        AuditLogger::log([
            'level' => 'notice', 'category' => 'security', 'action' => 'security.log_export', 'actor_type' => 'admin', 'actor_id' => $this->uid($r),
            'actor_name' => $r->user()?->name, 'summary' => 'Xuất nhật ký hệ thống (' . strtoupper($format) . ', ' . count($rows) . ' dòng)',
        ], $r);

        $name = 'nhat-ky-he-thong-' . date('Ymd-His') . '.' . $format;

        if ($format === 'json') {
            return response()->streamDownload(function () use ($rows) {
                echo json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE);
            }, $name, ['Content-Type' => 'application/json; charset=UTF-8']);
        }

        // Chống "CSV injection": ô bắt đầu bằng = + - @ sẽ được thêm dấu ' phía trước
        $safe = fn ($v) => is_string($v) && $v !== '' && in_array($v[0], ['=', '+', '-', '@', "\t", "\r"], true) ? "'" . $v : $v;

        return response()->streamDownload(function () use ($rows, $safe) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM để Excel đọc đúng tiếng Việt
            fputcsv($out, ['ID', 'Thời gian', 'Mức độ', 'Nhóm', 'Hành động', 'Loại người thực hiện', 'Người thực hiện', 'Đối tượng', 'Mô tả', 'IP', 'Phương thức', 'Đường dẫn', 'Mã HTTP', 'Thời gian xử lý (ms)', 'Mã yêu cầu', 'Nguồn']);
            foreach ($rows as $e) {
                fputcsv($out, array_map($safe, [
                    $e['id'], $e['occurred_at'], $e['level'], $e['category'], $e['action'], $e['actor']['type'], $e['actor']['name'],
                    trim(($e['subject']['type'] ?? '') . ' ' . ($e['subject']['id'] ?? '')), $e['summary'], $e['ip_address'], $e['http_method'],
                    $e['route'], $e['status_code'], $e['duration_ms'], $e['request_id'], $e['source'],
                ]));
            }
            fclose($out);
        }, $name, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function security()
    {
        return $this->ok($this->svc->security());
    }

    public function unlock(Request $r, int $id)
    {
        return $this->svc->unlockStaff($id, $this->uid($r), $r->user()?->name)
            ? $this->ok(null, 'Đã mở khóa tài khoản')
            : $this->fail('Không tìm thấy tài khoản.', 404);
    }

    public function audit(Request $r)
    {
        return $this->ok($this->svc->audit($this->filters($r)));
    }

    /* ---------- bộ lọc đã lưu, ghim ---------- */

    public function views(Request $r)
    {
        return $this->ok($this->svc->views((int) $this->uid($r)));
    }

    public function saveView(Request $r)
    {
        $d = $r->validate(['name' => 'required|string|max:80', 'filters' => 'required|array', 'shared' => 'boolean']);
        try {
            return $this->ok($this->svc->saveView((int) $this->uid($r), $d['name'], $d['filters'], (bool) ($d['shared'] ?? false)), 'Đã lưu bộ lọc', 201);
        } catch (\DomainException $e) {
            return $this->fail($e->getMessage());
        }
    }

    public function deleteView(Request $r, int $id)
    {
        return $this->svc->deleteView((int) $this->uid($r), $id) ? $this->ok(null, 'Đã xóa bộ lọc') : $this->fail('Không tìm thấy bộ lọc của bạn.', 404);
    }

    public function pin(Request $r, int $id)
    {
        $d = $r->validate(['note' => 'nullable|string|max:500']);

        return $this->svc->pin($id, (int) $this->uid($r), $d['note'] ?? null) ? $this->ok(null, 'Đã ghim sự kiện') : $this->fail('Không tìm thấy sự kiện.', 404);
    }

    public function unpin(Request $r, int $id)
    {
        $this->svc->unpin($id, (int) $this->uid($r));

        return $this->ok(null, 'Đã bỏ ghim');
    }

    /* ---------- lưu trữ & quản trị ---------- */

    public function storage()
    {
        return $this->ok($this->svc->storage());
    }

    public function updateRetention(Request $r)
    {
        $d = $r->validate(['days' => 'required|array', 'days.*' => 'integer|min:1|max:3650']);

        return $this->ok($this->svc->updateRetention($d['days'], $this->uid($r), $r->user()?->name), 'Đã lưu chính sách lưu giữ');
    }

    public function purge(Request $r)
    {
        $d = $r->validate(['dry_run' => 'boolean', 'confirm' => 'nullable|string|max:10']);
        $dry = (bool) ($d['dry_run'] ?? true);
        if (! $dry && ($d['confirm'] ?? '') !== 'XOA') {
            return $this->fail('Cần nhập đúng chữ XOA để xác nhận dọn dẹp.');
        }
        $res = $this->svc->purge($dry, $this->uid($r), $r->user()?->name);

        return $this->ok($res, $dry ? "Có {$res['total']} sự kiện quá hạn" : "Đã xóa {$res['total']} sự kiện quá hạn");
    }

    public function testEvent(Request $r)
    {
        $d = $r->validate(['level' => 'required|in:debug,info,notice,warning,error,critical']);

        return $this->ok(['id' => $this->svc->testEvent($d['level'], $this->uid($r), $r->user()?->name)], 'Đã tạo sự kiện thử', 201);
    }

    public function sync()
    {
        return $this->ok(['imported' => (new LegacyLogImporter())->sync()], 'Đã đồng bộ nhật ký từ các bảng cũ');
    }
}
