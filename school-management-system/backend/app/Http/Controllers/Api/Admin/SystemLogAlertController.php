<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\SystemLog\AlertService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Quy tắc cảnh báo + sự cố — prefix /api/v1/admin/logs */
class SystemLogAlertController extends Controller
{
    private const RULE = [
        'name' => 'required|string|max:120',
        'description' => 'nullable|string|max:255',
        'category' => 'nullable|in:auth,security,data,finance,academic,student,admin,system,api',
        'action_pattern' => 'nullable|string|max:80',
        'min_level' => 'required|in:debug,info,notice,warning,error,critical',
        'threshold' => 'required|integer|min:1|max:100000',
        'window_minutes' => 'required|integer|min:1|max:1440',
        'cooldown_minutes' => 'nullable|integer|min:0|max:10080',
        'severity' => 'required|in:warning,error,critical',
        'enabled' => 'boolean',
    ];

    public function __construct(private AlertService $svc) {}

    private function ok(mixed $data = null, string $message = '', int $status = 200): JsonResponse
    {
        return response()->json(['success' => true, 'message' => $message, 'data' => $data], $status);
    }

    private function fail(string $message, int $status = 422): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $message], $status);
    }

    public function rules()
    {
        return $this->ok($this->svc->rules());
    }

    public function store(Request $r)
    {
        $d = $r->validate(self::RULE);
        try {
            return $this->ok($this->svc->saveRule(null, $d + ['_new' => true], $r->user()?->id), 'Đã tạo quy tắc', 201);
        } catch (\DomainException $e) {
            return $this->fail($e->getMessage());
        }
    }

    public function update(Request $r, int $id)
    {
        $d = $r->validate(self::RULE);
        try {
            return $this->ok($this->svc->saveRule($id, $d, $r->user()?->id), 'Đã lưu quy tắc');
        } catch (\DomainException $e) {
            return $this->fail($e->getMessage());
        }
    }

    public function destroy(Request $r, int $id)
    {
        return $this->svc->deleteRule($id, $r->user()?->id) ? $this->ok(null, 'Đã xóa quy tắc') : $this->fail('Không tìm thấy quy tắc.', 404);
    }

    public function test(Request $r)
    {
        $d = $r->validate(self::RULE);

        return $this->ok($this->svc->testRule($d));
    }

    public function evaluate()
    {
        $n = $this->svc->evaluateNow();

        return $this->ok(['opened' => $n], $n ? "Đã mở {$n} sự cố mới" : 'Không có sự cố mới');
    }

    public function incidents(Request $r)
    {
        return $this->ok($this->svc->incidents($r->only(['status', 'page', 'per_page'])));
    }

    public function acknowledge(Request $r, int $id)
    {
        return $this->svc->acknowledge($id, (int) $r->user()?->id) ? $this->ok(null, 'Đã xác nhận sự cố') : $this->fail('Sự cố không ở trạng thái chờ xử lý.', 409);
    }

    public function resolve(Request $r, int $id)
    {
        $d = $r->validate(['note' => 'nullable|string|max:500']);

        return $this->svc->resolve($id, (int) $r->user()?->id, $d['note'] ?? null) ? $this->ok(null, 'Đã đóng sự cố') : $this->fail('Sự cố đã được đóng hoặc không tồn tại.', 409);
    }
}
