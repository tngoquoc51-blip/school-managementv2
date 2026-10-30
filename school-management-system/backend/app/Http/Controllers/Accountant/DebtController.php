<?php

namespace App\Http\Controllers\Accountant;

use App\Http\Requests\Accountant\BulkReminderRequest;
use App\Http\Requests\Accountant\DebtEventRequest;
use App\Http\Requests\Accountant\ExtendDueRequest;
use App\Http\Requests\Accountant\RecordPaymentRequest;
use App\Http\Requests\Accountant\StorePlanRequest;
use App\Http\Requests\Accountant\VoidPaymentRequest;
use App\Services\Accounting\DebtService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\ValidationException;

class DebtController extends Controller
{
    public function __construct(private DebtService $debts) {}

    private function ok($data = null, string $message = 'OK', array $extra = [], int $code = 200): JsonResponse
    {
        return response()->json(array_merge(['success' => true, 'message' => $message, 'data' => $data], $extra), $code);
    }

    private function run(callable $fn): JsonResponse
    {
        try {
            return $fn();
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => collect($e->errors())->flatten()->first() ?? 'Dữ liệu không hợp lệ.',
                'data'    => null,
                'errors'  => $e->errors(),
            ], 422);
        }
    }

    private function uid(Request $r): ?int
    {
        return $r->user()?->getAuthIdentifier();
    }

    /** GET /accountant/debts */
    public function index(Request $r): JsonResponse
    {
        $res = $this->debts->list($r->only(['q', 'grade', 'class_id', 'status', 'min_debt', 'max_debt', 'sort', 'dir', 'page', 'per_page', 'school_year']) + ['all' => $r->boolean('all')]);

        // "summary" ở cấp ngoài giữ tương thích với giao diện cũ
        return $this->ok($res['rows'], 'OK', ['meta' => $res['meta'], 'summary' => $res['meta']['summary']]);
    }

    /** GET /accountant/debts/options */
    public function options(): JsonResponse
    {
        return $this->ok($this->debts->options());
    }

    /** GET /accountant/debts/classes */
    public function classes(Request $r): JsonResponse
    {
        return $this->ok($this->debts->byClass($r->only(['school_year'])));
    }

    /** GET /accountant/debts/{student} */
    public function show(int $student): JsonResponse
    {
        $d = $this->debts->detail($student);

        return $d ? $this->ok($d) : response()->json(['success' => false, 'message' => 'Không tìm thấy học sinh.', 'data' => null], 404);
    }

    /** POST /accountant/debts/{student}/payments */
    public function recordPayment(RecordPaymentRequest $req, int $student): JsonResponse
    {
        return $this->run(fn () => $this->ok($this->debts->recordPayment($student, $req->validated(), $this->uid($req)), 'Đã ghi nhận thanh toán.', [], 201));
    }

    /** POST /accountant/debts/payments/{receiptNo}/void */
    public function voidPayment(VoidPaymentRequest $req, string $receiptNo): JsonResponse
    {
        return $this->run(fn () => $this->ok($this->debts->voidReceipt($receiptNo, $req->validated('reason'), $this->uid($req)), 'Đã hủy phiếu thu.'));
    }

    /** POST /accountant/debts/{student}/events */
    public function storeEvent(DebtEventRequest $req, int $student): JsonResponse
    {
        return $this->run(function () use ($req, $student) {
            $this->debts->addEvent($student, $req->validated(), $this->uid($req));
            return $this->ok(null, 'Đã lưu.', [], 201);
        });
    }

    /** POST /accountant/debts/reminders */
    public function bulkReminder(BulkReminderRequest $req): JsonResponse
    {
        return $this->run(function () use ($req) {
            $v = $req->validated();
            return $this->ok($this->debts->bulkReminder($v['student_ids'], $v['channel'], $v['message'], $this->uid($req)), 'Đã tạo nhắc nợ.', [], 201);
        });
    }

    /** POST /accountant/debts/{student}/extend */
    public function extend(ExtendDueRequest $req, int $student): JsonResponse
    {
        return $this->run(fn () => $this->ok($this->debts->extendDue($student, $req->validated(), $this->uid($req)), 'Đã gia hạn.'));
    }

    /** POST /accountant/debts/{student}/plans */
    public function storePlan(StorePlanRequest $req, int $student): JsonResponse
    {
        return $this->run(fn () => $this->ok($this->debts->createPlan($student, $req->validated(), $this->uid($req)), 'Đã lập kế hoạch trả góp.', [], 201));
    }
}
