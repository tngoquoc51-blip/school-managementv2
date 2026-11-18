<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Support\AdminFinanceActions;
use App\Support\AdminFinanceReports;
use Illuminate\Http\Request;

/** Học phí & Tài chính – cổng Admin. Đường dẫn: /api/admin/finance/... (routes/admin_finance.php) */
class AdminFinanceController extends Controller
{
    public function __construct(private AdminFinanceReports $rep, private AdminFinanceActions $act) {}

    private function out($data, string $msg = 'OK', int $code = 200)
    {
        return response()->json(['success' => true, 'message' => $msg, 'data' => $data], $code);
    }

    private function actor(Request $r): string
    {
        $u = $r->user();

        return mb_substr((string) ($u->name ?: ($u->username ?: 'Admin')), 0, 80);
    }

    public function meta() { return $this->out($this->rep->meta()); }
    public function overview(Request $r) { return $this->out($this->rep->overview($this->rep->filters($r))); }

    public function invoices(Request $r)
    {
        return $this->out($this->rep->invoices($this->rep->filters($r), min((int) $r->query('per_page', 20), 100), (string) $r->query('sort', 'newest')));
    }

    public function invoice(int $id) { return $this->out($this->rep->invoice($id)); }
    public function payments(Request $r) { return $this->out($this->rep->payments($this->rep->filters($r), $r)); }

    public function confirmPayment(Request $r, int $id)
    {
        $this->act->confirmPayment($id, $this->actor($r));

        return $this->out(null, 'Đã xác nhận phiếu thu');
    }

    public function rejectPayment(Request $r, int $id)
    {
        $d = $r->validate(['reason' => ['required', 'string', 'min:3', 'max:255']], ['reason.required' => 'Vui lòng nhập lý do từ chối.', 'reason.min' => 'Lý do tối thiểu 3 ký tự.']);
        $this->act->rejectPayment($id, $d['reason'], $this->actor($r));

        return $this->out(null, 'Đã từ chối phiếu thu');
    }

    public function debts(Request $r)
    {
        return $this->out($this->rep->debts($this->rep->filters($r), (int) $r->query('min_days'), max(1, (int) $r->query('page', 1)), min((int) $r->query('per_page', 20), 100)));
    }

    public function exportDebts(Request $r)
    {
        $rows = $this->rep->debtRows($this->rep->filters($r), (int) $r->query('min_days'));

        return response()->streamDownload(function () use ($rows) {
            $o = fopen('php://output', 'w');
            fwrite($o, "\xEF\xBB\xBF"); // BOM để Excel đọc đúng tiếng Việt
            fputcsv($o, ['Mã HS', 'Họ tên', 'Lớp', 'Khối', 'Số hóa đơn nợ', 'Tổng nợ (VND)', 'Quá hạn tối đa (ngày)', 'Ngày hẹn trả']);
            foreach ($rows as $x) {
                fputcsv($o, [$x->student_code, $x->student_name, $x->class_name, $x->grade, $x->invoices_n, $x->debt, $x->max_overdue, $x->promise_date]);
            }
            fclose($o);
        }, 'cong-no-' . date('Ymd-His') . '.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function notes(int $studentId) { return $this->out($this->act->notes($studentId)); }

    public function addNote(Request $r, int $studentId)
    {
        $d = $r->validate([
            'kind' => ['required', 'in:note,contact,promise'], 'channel' => ['nullable', 'in:phone,zalo,sms,direct,email,other'],
            'note' => ['required', 'string', 'max:500'], 'promise_date' => ['nullable', 'date'], 'promise_amount' => ['nullable', 'integer', 'min:0'],
        ], ['note.required' => 'Vui lòng nhập nội dung ghi chú.']);

        return $this->out($this->act->addNote($studentId, $d, $this->actor($r)), 'Đã lưu ghi chú', 201);
    }

    public function resolveNote(Request $r, int $id)
    {
        $d = $r->validate(['status' => ['required', 'in:kept,broken,cancelled']]);
        $this->act->resolveNote($id, $d['status'], $this->actor($r));

        return $this->out(null, 'Đã cập nhật lịch hẹn');
    }

    public function periods(Request $r) { return $this->out($this->rep->periods((int) ($r->query('year_id') ?: $this->rep->currentYear()))); }

    public function setPeriodStatus(Request $r, int $id)
    {
        $d = $r->validate(['status' => ['required', 'in:open,closed']]);
        $this->act->setPeriodStatus($id, $d['status'], $this->actor($r));

        return $this->out(null, $d['status'] === 'closed' ? 'Đã đóng đợt thu' : 'Đã mở lại đợt thu');
    }

    public function feeItems() { return $this->out($this->rep->feeItems()); }
    public function waivers(Request $r) { return $this->out($this->rep->waivers($this->rep->filters($r), (string) $r->query('kind', ''))); }
    public function disputes(Request $r) { return $this->out($this->rep->disputes($this->rep->filters($r), (string) $r->query('status', ''))); }

    public function replyDispute(Request $r, int $id)
    {
        $d = $r->validate(['reply' => ['required', 'string', 'min:3', 'max:1000']], ['reply.required' => 'Vui lòng nhập nội dung trả lời.']);
        $this->act->replyDispute($id, $d['reply'], $this->actor($r));

        return $this->out(null, 'Đã gửi phản hồi');
    }

    public function audit() { return $this->out($this->rep->audit()); }
}
