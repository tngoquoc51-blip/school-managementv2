<?php

namespace Modules\Teacher\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\Password;
use Modules\Teacher\Requests\UpdateTeacherInfoRequest;
use Modules\Teacher\Services\TeacherProfileService;

class TeacherProfileController extends Controller
{
    public function __construct(private TeacherProfileService $svc) {}

    private function ok($data = null, string $msg = 'OK', int $code = 200)
    {
        return response()->json(['success' => true, 'message' => $msg, 'data' => $data], $code);
    }

    public function overview(Request $r) { return $this->ok($this->svc->overview($this->svc->staff($r))); }
    public function teaching(Request $r) { return $this->ok($this->svc->teaching($this->svc->staff($r))); }

    public function updateInfo(UpdateTeacherInfoRequest $r)
    {
        return $this->ok($this->svc->updateInfo($this->svc->staff($r), $r->validated()), 'Đã cập nhật hồ sơ');
    }

    public function avatar(Request $r)
    {
        $r->validate(['avatar' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048']], [
            'avatar.image' => 'Tệp phải là hình ảnh.', 'avatar.max' => 'Ảnh tối đa 2MB.', 'avatar.mimes' => 'Chỉ nhận JPG, PNG, WEBP.',
        ]);

        return $this->ok(['avatar' => $this->svc->updateAvatar($this->svc->staff($r), $r->file('avatar'))], 'Đã đổi ảnh đại diện');
    }

    /** Phát ảnh đại diện (công khai trong nội bộ, thẻ <img> không gửi được token) */
    public function avatarFile(int $teacherId)
    {
        $path = $this->svc->avatarPath($teacherId);
        abort_unless($path && Storage::disk('public')->exists($path), 404);

        return response()->file(Storage::disk('public')->path($path), ['Cache-Control' => 'public, max-age=86400']);
    }

    /* bằng cấp */
    public function qualifications(Request $r) { return $this->ok($this->svc->qualifications($this->svc->staff($r))); }

    private function qualRules(): array
    {
        return [
            'type' => ['required', 'in:degree,certificate,training,award'], 'title' => ['required', 'string', 'max:160'],
            'organization' => ['nullable', 'string', 'max:160'], 'issued_year' => ['nullable', 'integer', 'between:1960,2100'],
            'expires_at' => ['nullable', 'date'], 'note' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function storeQualification(Request $r)
    {
        return $this->ok($this->svc->saveQualification($this->svc->staff($r), $r->validate($this->qualRules())), 'Đã thêm', 201);
    }

    public function updateQualification(Request $r, int $id)
    {
        return $this->ok($this->svc->saveQualification($this->svc->staff($r), $r->validate($this->qualRules()), $id), 'Đã cập nhật');
    }

    public function destroyQualification(Request $r, int $id)
    {
        $this->svc->deleteQualification($this->svc->staff($r), $id);

        return $this->ok(null, 'Đã xóa');
    }

    /* yêu cầu chỉnh sửa */
    public function requests(Request $r) { return $this->ok($this->svc->requests($this->svc->staff($r))); }

    public function storeRequest(Request $r)
    {
        $d = $r->validate(['field_key' => ['required', 'string'], 'new_value' => ['required', 'string', 'max:255'], 'reason' => ['required', 'string', 'min:5', 'max:255']]);

        return $this->ok($this->svc->createRequest($this->svc->staff($r), $d), 'Đã gửi yêu cầu, vui lòng chờ duyệt', 201);
    }

    public function cancelRequest(Request $r, int $id)
    {
        $this->svc->cancelRequest($this->svc->staff($r), $id);

        return $this->ok(null, 'Đã hủy yêu cầu');
    }

    /* bảo mật */
    public function password(Request $r)
    {
        $d = $r->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ], ['password.confirmed' => 'Xác nhận mật khẩu không khớp.', 'password.min' => 'Mật khẩu tối thiểu 8 ký tự.']);
        $this->svc->changePassword($this->svc->staff($r), $d['current_password'], $d['password']);

        return $this->ok(null, 'Đổi mật khẩu thành công. Các thiết bị khác đã bị đăng xuất.');
    }

    public function sessions(Request $r) { return $this->ok($this->svc->sessions($this->svc->staff($r))); }
    public function loginHistory(Request $r) { return $this->ok($this->svc->loginHistory($this->svc->staff($r))); }

    public function revokeSession(Request $r, int $id)
    {
        $this->svc->revokeSession($this->svc->staff($r), $id);

        return $this->ok(null, 'Đã đăng xuất thiết bị');
    }

    public function revokeOthers(Request $r)
    {
        return $this->ok(['revoked' => $this->svc->revokeOthers($this->svc->staff($r))], 'Đã đăng xuất các thiết bị khác');
    }

    /* cài đặt + nhật ký */
    public function settings(Request $r) { return $this->ok($this->svc->settings($this->svc->staff($r))); }

    public function updateSettings(Request $r)
    {
        $d = $r->validate([
            'theme' => ['sometimes', 'in:light,dark,system'], 'language' => ['sometimes', 'in:vi,en'],
            'timezone' => ['sometimes', 'timezone'], 'date_format' => ['sometimes', 'in:DD/MM/YYYY,MM/DD/YYYY,YYYY-MM-DD'],
            'density' => ['sometimes', 'in:comfortable,compact'], 'notification_prefs' => ['sometimes', 'array'],
        ]);

        return $this->ok($this->svc->updateSettings($this->svc->staff($r), $d), 'Đã lưu cài đặt');
    }

    public function activity(Request $r) { return $this->ok($this->svc->activity($this->svc->staff($r), min((int) $r->query('per_page', 20), 50))); }
}
