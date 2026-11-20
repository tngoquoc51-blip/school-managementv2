<?php

namespace Modules\Accountant\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\Accountant\Services\FinanceService as F;

class ReminderController extends BaseController
{
    public function index(int $id)
    {
        F::findStudent($id);
        return $this->ok(DB::table('sm_reminders')->where('student_id', $id)->orderByDesc('id')->limit(100)->get());
    }

    private function build(Request $request, int $id): array
    {
        $d = $this->validated($request, [
            'template_id' => 'nullable|integer|exists:sm_reminder_templates,id',
            'channel' => 'required|in:inapp,sms,zalo,print',
            'level' => 'nullable|integer|min:1|max:3',
            'subject' => 'nullable|string|max:120',
            'body' => 'nullable|string|max:1500',
        ]);
        $tpl = ! empty($d['template_id']) ? DB::table('sm_reminder_templates')->where('id', $d['template_id'])->first() : null;
        $subject = $d['subject'] ?? ($tpl->subject ?? '');
        $body = $d['body'] ?? ($tpl->body ?? '');
        if (trim($subject) === '' || trim($body) === '') {
            $this->stop('Vui lòng chọn mẫu hoặc nhập tiêu đề và nội dung nhắc nợ.');
        }
        $ctx = F::reminderContext($id);
        return [
            'tpl' => $tpl, 'channel' => $d['channel'], 'level' => (int) ($d['level'] ?? ($tpl->level ?? 1)),
            'subject' => mb_substr(F::render($subject, $ctx), 0, 120), 'body' => mb_substr(F::render($body, $ctx), 0, 1500),
            'debt' => (int) $ctx['_debt'], 'days' => (int) $ctx['_overdue_days'],
        ];
    }

    public function preview(Request $request, int $id)
    {
        F::findStudent($id);
        $b = $this->build($request, $id);
        return $this->ok(['subject' => $b['subject'], 'body' => $b['body'], 'debt' => $b['debt'], 'overdue_days' => $b['days']]);
    }

    public function store(Request $request, int $id)
    {
        F::findStudent($id);
        $b = $this->build($request, $id);
        if ($b['debt'] <= 0) {
            return $this->fail('Học sinh không còn công nợ, không cần gửi nhắc.');
        }
        $actor = $this->actor($request);
        $now = now()->format('Y-m-d H:i:s');

        $rid = DB::transaction(function () use ($id, $b, $actor, $now) {
            $st = DB::table('sm_students')->where('id', $id)->value('code');
            $batch = DB::table('sm_reminder_batches')->insertGetId([
                'name' => 'Nhắc nợ lẻ ' . $st . ' ' . date('d/m/Y H:i'), 'template_id' => $b['tpl']->id ?? null,
                'level' => $b['level'], 'channel' => $b['channel'], 'subject' => $b['subject'], 'body' => $b['body'],
                'note' => 'Gửi từ hồ sơ tài chính học sinh', 'cancelled' => 0, 'created_by' => $actor, 'created_at' => $now,
            ]);
            $inapp = $b['channel'] === 'inapp';
            return DB::table('sm_reminders')->insertGetId([
                'batch_id' => $batch, 'student_id' => $id, 'level' => $b['level'], 'channel' => $b['channel'],
                'subject' => $b['subject'], 'body' => $b['body'], 'debt_amount' => $b['debt'], 'overdue_days' => $b['days'],
                'status' => $inapp ? 'sent' : 'queued', 'created_by' => $actor, 'created_at' => $now,
                'sent_at' => $inapp ? $now : null,
            ]);
        });
        return $this->ok(['id' => $rid], $b['channel'] === 'inapp' ? 'Đã gửi thông báo tới phụ huynh' : 'Đã đưa vào hàng chờ gửi', 201);
    }

    public function markSent(int $id)
    {
        $n = DB::table('sm_reminders')->where('id', $id)->where('status', 'queued')
            ->update(['status' => 'sent', 'sent_at' => now()->format('Y-m-d H:i:s')]);
        return $n ? $this->ok(null, 'Đã đánh dấu đã gửi') : $this->fail('Chỉ đánh dấu được nhắc nợ đang chờ gửi.');
    }

    public function cancel(int $id)
    {
        $n = DB::table('sm_reminders')->where('id', $id)->where('status', 'queued')->update(['status' => 'cancelled']);
        return $n ? $this->ok(null, 'Đã hủy nhắc nợ') : $this->fail('Chỉ hủy được nhắc nợ đang chờ gửi.');
    }
}
