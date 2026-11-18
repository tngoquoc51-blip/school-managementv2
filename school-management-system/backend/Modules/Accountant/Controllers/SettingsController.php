<?php

namespace Modules\Accountant\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class SettingsController extends Controller
{
    /** Các khóa được phép sửa trong sm_fee_settings (kèm nhóm hiển thị). */
    private const FEE_KEYS = [
        'school_name', 'school_address', 'hotline', 'office',
        'account_name', 'account_no', 'bank_bin', 'bank_name', 'bank_short', 'transfer_hint',
        'receipt_accountant', 'receipt_treasurer', 'receipt_footer',
        'reminder_contact', 'reminder_gap_days',
    ];

    private const CATEGORIES = ['tuition', 'insurance', 'fund', 'service', 'uniform', 'other'];

    /* ---------------------------------------------------------- helpers */

    private function staff(Request $r)
    {
        $s = $r->attributes->get('staff') ?? $r->attributes->get('kt_staff');
        if ($s) {
            return (object) [
                'id' => is_object($s) ? ($s->id ?? 1) : ($s['id'] ?? 1),
                'full_name' => is_object($s) ? ($s->full_name ?? $s->name ?? 'Phạm Văn Kế') : ($s['full_name'] ?? $s['name'] ?? 'Phạm Văn Kế'),
                'username' => is_object($s) ? ($s->username ?? 'ketoan') : ($s['username'] ?? 'ketoan'),
                'role' => is_object($s) ? ($s->role ?? 'accountant') : ($s['role'] ?? 'accountant'),
                'token_id' => is_object($s) ? ($s->token_id ?? null) : ($s['token_id'] ?? null),
            ];
        }
        return (object) [
            'id' => 1,
            'full_name' => 'Phạm Văn Kế',
            'username' => 'ketoan',
            'role' => 'accountant',
            'token_id' => null,
        ];
    }

    private function log(Request $r, string $area, string $action, ?string $detail = null): void
    {
        try {
            if (! Schema::hasTable('sm_acc_setting_log')) return;
            $s = $this->staff($r);
            DB::table('sm_acc_setting_log')->insert([
                'staff_id'   => $s->id,
                'staff_name' => $s->full_name,
                'area'       => $area,
                'action'     => $action,
                'detail'     => $detail ? mb_substr($detail, 0, 500) : null,
                'ip'         => $r->ip(),
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {}
    }

    private function ok(array $data = [], string $message = 'Đã lưu.'): JsonResponse
    {
        return response()->json(['message' => $message] + $data);
    }

    /* --------------------------------------------------------- overview */

    public function overview(Request $r): JsonResponse
    {
        $fs = Schema::hasTable('sm_fee_settings') ? DB::table('sm_fee_settings')->pluck('svalue', 'skey') : collect();
        $required = ['school_name', 'account_name', 'account_no', 'bank_bin', 'bank_name', 'hotline', 'office'];
        $filled = collect($required)->filter(fn ($k) => trim((string) ($fs[$k] ?? '')) !== '')->count();
        $demo = str_contains((string) ($fs['demo_note'] ?? ''), 'minh họa') || ($fs['account_no'] ?? '') === '0011004567890';
        $staffObj = $this->staff($r);

        return response()->json([
            'fee_items'        => Schema::hasTable('sm_fee_items') ? DB::table('sm_fee_items')->count() : 0,
            'templates_active' => Schema::hasTable('sm_reminder_templates') ? DB::table('sm_reminder_templates')->where('is_active', 1)->count() : 0,
            'templates_total'  => Schema::hasTable('sm_reminder_templates') ? DB::table('sm_reminder_templates')->count() : 0,
            'sessions'         => Schema::hasTable('sm_staff_tokens') ? DB::table('sm_staff_tokens')->where('staff_id', $staffObj->id)->where('expires_at', '>', now())->count() : 1,
            'completeness'     => (int) round($filled / count($required) * 100),
            'using_demo_account' => $demo,
            'last_change'      => Schema::hasTable('sm_acc_setting_log') ? DB::table('sm_acc_setting_log')->orderByDesc('id')->first(['staff_name', 'area', 'action', 'created_at']) : null,
            'staff'            => ['name' => $staffObj->full_name, 'role' => $staffObj->role, 'username' => $staffObj->username],
        ]);
    }

    /* ------------------------------------------------------ fee settings */

    public function feeSettings(): JsonResponse
    {
        $all = Schema::hasTable('sm_fee_settings') ? DB::table('sm_fee_settings')->pluck('svalue', 'skey') : collect();
        $out = [];
        foreach (self::FEE_KEYS as $k) { $out[$k] = $all[$k] ?? ''; }
        return response()->json(['data' => $out]);
    }

    public function saveFeeSettings(Request $r): JsonResponse
    {
        $data = $r->validate([
            'school_name'        => 'sometimes|string|max:120',
            'school_address'     => 'sometimes|nullable|string|max:200',
            'hotline'            => ['sometimes', 'nullable', 'string', 'max:30', 'regex:/^[0-9 .()+\-]*$/'],
            'office'             => 'sometimes|nullable|string|max:200',
            'account_name'       => 'sometimes|string|max:120',
            'account_no'         => ['sometimes', 'string', 'regex:/^[0-9]{6,20}$/'],
            'bank_bin'           => ['sometimes', 'string', 'regex:/^[0-9]{6}$/'],
            'bank_name'          => 'sometimes|string|max:160',
            'bank_short'         => 'sometimes|string|max:40',
            'transfer_hint'      => 'sometimes|nullable|string|max:200',
            'receipt_accountant' => 'sometimes|nullable|string|max:80',
            'receipt_treasurer'  => 'sometimes|nullable|string|max:80',
            'receipt_footer'     => 'sometimes|nullable|string|max:255',
            'reminder_contact'   => 'sometimes|nullable|string|max:120',
            'reminder_gap_days'  => 'sometimes|integer|min:1|max:30',
        ], [
            'account_no.regex' => 'Số tài khoản chỉ gồm 6–20 chữ số.',
            'bank_bin.regex'   => 'Mã BIN ngân hàng gồm đúng 6 chữ số (VD: 970436).',
            'hotline.regex'    => 'Số điện thoại chỉ gồm số, dấu cách và + - ( ).',
        ]);

        $old = DB::table('sm_fee_settings')->pluck('svalue', 'skey');
        $changed = [];
        DB::transaction(function () use ($data, $old, &$changed) {
            foreach ($data as $k => $v) {
                if (! in_array($k, self::FEE_KEYS, true)) { continue; }
                $v = (string) ($v ?? '');
                if (($old[$k] ?? null) === $v) { continue; }
                DB::table('sm_fee_settings')->updateOrInsert(['skey' => $k], ['svalue' => $v]);
                $changed[] = $k;
            }
            // đã nhập tài khoản thật thì bỏ ghi chú minh họa
            if (array_intersect($changed, ['account_no', 'account_name', 'bank_bin'])) {
                DB::table('sm_fee_settings')->where('skey', 'demo_note')->delete();
            }
        });

        if ($changed) {
            $area = count(array_intersect($changed, ['account_no','account_name','bank_bin','bank_name','bank_short','transfer_hint'])) ? 'payment'
                  : (count(array_intersect($changed, ['receipt_accountant','receipt_treasurer','receipt_footer'])) ? 'receipt' : 'reminder');
            $this->log($r, $area, 'update', 'Sửa: ' . implode(', ', $changed));
            DB::table('sm_fee_audit')->insert([
                'actor_id' => $this->staff($r)->id, 'action' => 'setting_update', 'fee_item_id' => null,
                'detail' => json_encode(['keys' => $changed], JSON_UNESCAPED_UNICODE), 'ip' => $r->ip(),
            ]);
        }
        return $this->ok(['changed' => $changed], $changed ? 'Đã lưu cài đặt.' : 'Không có thay đổi nào.');
    }

    /* --------------------------------------------------------- fee items */

    public function feeItems(Request $r): JsonResponse
    {
        $q = DB::table('sm_fee_items as f')
            ->leftJoin(DB::raw('(SELECT fee_item_id, COUNT(*) c FROM sm_invoice_lines WHERE fee_item_id IS NOT NULL GROUP BY fee_item_id) u'), 'u.fee_item_id', '=', 'f.id')
            ->select('f.*', DB::raw('COALESCE(u.c,0) as used_count'))
            ->orderBy('f.category')->orderBy('f.code');
        if ($s = trim((string) $r->query('q'))) {
            $q->where(fn ($w) => $w->where('f.name', 'like', "%$s%")->orWhere('f.code', 'like', "%$s%"));
        }
        if ($c = $r->query('category')) { $q->where('f.category', $c); }
        return response()->json(['data' => $q->get()]);
    }

    private function feeItemRules(?int $id = null): array
    {
        return [
            'code'         => ['required', 'string', 'max:30', 'regex:/^[A-Za-z0-9_\-]+$/', Rule::unique('sm_fee_items', 'code')->ignore($id)],
            'name'         => 'required|string|max:120',
            'category'     => ['required', Rule::in(self::CATEGORIES)],
            'amount'       => 'required|integer|min:0|max:1000000000',
            'unit'         => 'required|string|max:20',
            'grade'        => 'nullable|integer|in:10,11,12',
            'is_mandatory' => 'required|boolean',
            'note'         => 'nullable|string|max:255',
        ];
    }

    public function storeFeeItem(Request $r): JsonResponse
    {
        $d = $r->validate($this->feeItemRules(), ['code.unique' => 'Mã khoản thu đã tồn tại.', 'code.regex' => 'Mã chỉ gồm chữ, số, gạch ngang/gạch dưới.']);
        $d['code'] = strtoupper($d['code']);
        $id = DB::table('sm_fee_items')->insertGetId($d);
        $this->log($r, 'fee_item', 'create', "Thêm khoản thu {$d['code']} – {$d['name']} ({$d['amount']}đ)");
        DB::table('sm_fee_audit')->insert(['actor_id' => $this->staff($r)->id, 'action' => 'fee_create', 'fee_item_id' => $id, 'detail' => json_encode($d, JSON_UNESCAPED_UNICODE), 'ip' => $r->ip()]);
        return $this->ok(['id' => $id], 'Đã thêm khoản thu.');
    }

    public function updateFeeItem(Request $r, int $id): JsonResponse
    {
        $old = DB::table('sm_fee_items')->find($id);
        abort_unless($old, 404, 'Không tìm thấy khoản thu.');
        $d = $r->validate($this->feeItemRules($id), ['code.unique' => 'Mã khoản thu đã tồn tại.']);
        $d['code'] = strtoupper($d['code']);
        DB::table('sm_fee_items')->where('id', $id)->update($d);
        $note = $old->amount != $d['amount'] ? " (đơn giá {$old->amount}đ → {$d['amount']}đ; hóa đơn đã phát hành không bị đổi)" : '';
        $this->log($r, 'fee_item', 'update', "Sửa khoản thu {$d['code']}{$note}");
        DB::table('sm_fee_audit')->insert(['actor_id' => $this->staff($r)->id, 'action' => 'fee_update', 'fee_item_id' => $id, 'detail' => json_encode(['old' => $old, 'new' => $d], JSON_UNESCAPED_UNICODE), 'ip' => $r->ip()]);
        return $this->ok([], 'Đã cập nhật khoản thu.');
    }

    public function deleteFeeItem(Request $r, int $id): JsonResponse
    {
        $it = DB::table('sm_fee_items')->find($id);
        abort_unless($it, 404, 'Không tìm thấy khoản thu.');
        $used = DB::table('sm_invoice_lines')->where('fee_item_id', $id)->count()
              + DB::table('sm_fee_period_items')->where('fee_item_id', $id)->count();
        if ($used > 0) {
            return response()->json(['message' => "Khoản thu đang được dùng ở {$used} dòng hóa đơn/đợt thu nên không thể xóa. Hãy sửa lại thông tin thay vì xóa."], 409);
        }
        DB::table('sm_fee_items')->where('id', $id)->delete();
        $this->log($r, 'fee_item', 'delete', "Xóa khoản thu {$it->code} – {$it->name}");
        DB::table('sm_fee_audit')->insert(['actor_id' => $this->staff($r)->id, 'action' => 'fee_delete', 'fee_item_id' => $id, 'detail' => json_encode($it, JSON_UNESCAPED_UNICODE), 'ip' => $r->ip()]);
        return $this->ok([], 'Đã xóa khoản thu.');
    }

    /* --------------------------------------------------------- templates */

    public function templates(): JsonResponse
    {
        return response()->json(['data' => DB::table('sm_reminder_templates')->orderBy('level')->orderBy('id')->get()]);
    }

    private function tplRules(?int $id = null): array
    {
        return [
            'code'    => ['required', 'string', 'max:30', 'regex:/^[A-Z0-9_]+$/', Rule::unique('sm_reminder_templates', 'code')->ignore($id)],
            'name'    => 'required|string|max:80',
            'level'   => 'required|integer|in:1,2,3',
            'subject' => 'required|string|max:120',
            'body'    => 'required|string|max:1500',
        ];
    }

    public function storeTemplate(Request $r): JsonResponse
    {
        $d = $r->validate($this->tplRules(), ['code.regex' => 'Mã mẫu chỉ gồm chữ in hoa, số và gạch dưới.', 'code.unique' => 'Mã mẫu đã tồn tại.']);
        $id = DB::table('sm_reminder_templates')->insertGetId($d + [
            'is_active' => 1, 'is_system' => 0, 'created_by' => $this->staff($r)->full_name, 'created_at' => now(),
        ]);
        $this->log($r, 'template', 'create', "Thêm mẫu nhắc nợ {$d['code']}");
        return $this->ok(['id' => $id], 'Đã thêm mẫu thông báo.');
    }

    public function updateTemplate(Request $r, int $id): JsonResponse
    {
        $t = DB::table('sm_reminder_templates')->find($id);
        abort_unless($t, 404, 'Không tìm thấy mẫu.');
        $rules = $this->tplRules($id);
        if ($t->is_system) { unset($rules['code']); }       // mẫu hệ thống: không đổi mã
        $d = $r->validate($rules);
        DB::table('sm_reminder_templates')->where('id', $id)->update($d + ['updated_by' => $this->staff($r)->full_name, 'updated_at' => now()]);
        $this->log($r, 'template', 'update', "Sửa mẫu nhắc nợ {$t->code}");
        return $this->ok([], 'Đã cập nhật mẫu.');
    }

    public function toggleTemplate(Request $r, int $id): JsonResponse
    {
        $t = DB::table('sm_reminder_templates')->find($id);
        abort_unless($t, 404, 'Không tìm thấy mẫu.');
        $new = $t->is_active ? 0 : 1;
        DB::table('sm_reminder_templates')->where('id', $id)->update(['is_active' => $new, 'updated_by' => $this->staff($r)->full_name, 'updated_at' => now()]);
        $this->log($r, 'template', $new ? 'enable' : 'disable', "{$t->code}");
        return $this->ok(['is_active' => $new], $new ? 'Đã bật mẫu.' : 'Đã tắt mẫu.');
    }

    public function deleteTemplate(Request $r, int $id): JsonResponse
    {
        $t = DB::table('sm_reminder_templates')->find($id);
        abort_unless($t, 404, 'Không tìm thấy mẫu.');
        if ($t->is_system) {
            return response()->json(['message' => 'Mẫu hệ thống không thể xóa, bạn chỉ có thể tắt hoặc chỉnh nội dung.'], 409);
        }
        DB::table('sm_reminder_templates')->where('id', $id)->delete();
        $this->log($r, 'template', 'delete', "Xóa mẫu {$t->code}");
        return $this->ok([], 'Đã xóa mẫu.');
    }

    /* ------------------------------------------------------------- prefs */

    private function prefRow(int $staffId)
    {
        DB::table('sm_acc_user_prefs')->insertOrIgnore(['staff_id' => $staffId]);
        return DB::table('sm_acc_user_prefs')->where('staff_id', $staffId)->first();
    }

    public function prefs(Request $r): JsonResponse
    {
        return response()->json(['data' => $this->prefRow($this->staff($r)->id)]);
    }

    public function savePrefs(Request $r): JsonResponse
    {
        $d = $r->validate([
            'notify_new_payment'  => 'sometimes|boolean',
            'notify_overdue'      => 'sometimes|boolean',
            'notify_dispute'      => 'sometimes|boolean',
            'notify_wallet_topup' => 'sometimes|boolean',
            'daily_digest'        => 'sometimes|boolean',
            'digest_time'         => ['sometimes', 'regex:/^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/'],
            'overdue_after_days'  => 'sometimes|integer|min:1|max:30',
            'density'             => ['sometimes', Rule::in(['comfortable', 'compact'])],
            'landing_page'        => ['sometimes', Rule::in(['dashboard', 'invoices', 'payments', 'debts', 'reports'])],
        ]);
        $id = $this->staff($r)->id;
        $this->prefRow($id);
        DB::table('sm_acc_user_prefs')->where('staff_id', $id)->update($d + ['updated_at' => now()]);
        $this->log($r, 'prefs', 'update', 'Sửa: ' . implode(', ', array_keys($d)));
        return $this->ok(['data' => $this->prefRow($id)], 'Đã lưu tùy chọn.');
    }

    /* ---------------------------------------------------------- security */

    public function changePassword(Request $r): JsonResponse
    {
        $d = $r->validate([
            'current_password' => 'required|string',
            'new_password'     => ['required', 'string', 'min:8', 'max:72', 'regex:/[A-Za-z]/', 'regex:/[0-9]/', 'different:current_password'],
        ], [
            'new_password.min'       => 'Mật khẩu mới tối thiểu 8 ký tự.',
            'new_password.regex'     => 'Mật khẩu mới phải có cả chữ và số.',
            'new_password.different' => 'Mật khẩu mới phải khác mật khẩu hiện tại.',
        ]);
        $s = $this->staff($r);
        $acc = DB::table('sm_staff_accounts')->where('id', $s->id)->first();
        if (! Hash::check($d['current_password'], $acc->password_hash)) {
            return response()->json(['message' => 'Mật khẩu hiện tại không đúng.', 'errors' => ['current_password' => ['Mật khẩu hiện tại không đúng.']]], 422);
        }
        DB::transaction(function () use ($s, $d) {
            DB::table('sm_staff_accounts')->where('id', $s->id)->update(['password_hash' => Hash::make($d['new_password'])]);
            DB::table('sm_staff_tokens')->where('staff_id', $s->id)->where('id', '!=', $s->token_id)->delete(); // đăng xuất thiết bị khác
        });
        $this->log($r, 'security', 'password', 'Đổi mật khẩu, đăng xuất các thiết bị khác');
        return $this->ok([], 'Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.');
    }

    public function sessions(Request $r): JsonResponse
    {
        $s = $this->staff($r);
        $rows = DB::table('sm_staff_tokens')->where('staff_id', $s->id)->where('expires_at', '>', now())
            ->orderByDesc('created_at')->get(['id', 'created_at', 'expires_at'])
            ->map(fn ($t) => (array) $t + ['current' => $t->id == $s->token_id]);
        return response()->json(['data' => $rows]);
    }

    public function revokeSession(Request $r, int $id): JsonResponse
    {
        $s = $this->staff($r);
        if ($id === (int) $s->token_id) {
            return response()->json(['message' => 'Đây là phiên hiện tại. Hãy dùng nút Đăng xuất.'], 409);
        }
        $n = DB::table('sm_staff_tokens')->where('id', $id)->where('staff_id', $s->id)->delete();
        abort_unless($n, 404, 'Không tìm thấy phiên.');
        $this->log($r, 'security', 'revoke', "Đăng xuất phiên #{$id}");
        return $this->ok([], 'Đã đăng xuất phiên đó.');
    }

    public function revokeOtherSessions(Request $r): JsonResponse
    {
        $s = $this->staff($r);
        $n = DB::table('sm_staff_tokens')->where('staff_id', $s->id)->where('id', '!=', $s->token_id)->delete();
        $this->log($r, 'security', 'revoke_all', "Đăng xuất {$n} phiên khác");
        return $this->ok(['count' => $n], "Đã đăng xuất {$n} phiên khác.");
    }

    /* -------------------------------------------------------------- logs */

    public function logs(Request $r): JsonResponse
    {
        $per = min(max((int) $r->query('per_page', 15), 5), 50);
        $q = DB::table('sm_acc_setting_log')->orderByDesc('id');
        if ($a = $r->query('area')) { $q->where('area', $a); }
        if ($s = trim((string) $r->query('q'))) {
            $q->where(fn ($w) => $w->where('detail', 'like', "%$s%")->orWhere('staff_name', 'like', "%$s%"));
        }
        $p = $q->paginate($per);
        return response()->json(['data' => $p->items(), 'meta' => ['page' => $p->currentPage(), 'last_page' => $p->lastPage(), 'total' => $p->total()]]);
    }
}
