<?php

namespace Modules\User\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\User\Requests\ChangePasswordRequest;
use Modules\User\Requests\UpdateProfileRequest;
use Modules\User\Requests\UpdateSettingsRequest;
use Modules\User\Requests\UploadAvatarRequest;
use Modules\User\Services\ProfileService;

/**
 * API thông tin cá nhân của người dùng đang đăng nhập.
 * Prefix: /api/v1/user/profile  (bắt buộc auth:sanctum)
 */
class ProfileController extends Controller
{
    use ApiResponse;

    public function __construct(private ProfileService $service) {}

    public function show(Request $request)
    {
        return $this->success($this->service->bundle($request->user()));
    }

    public function update(UpdateProfileRequest $request)
    {
        return $this->success($this->service->update($request->user(), $request->validated(), $request), 'Đã lưu thông tin cá nhân');
    }

    public function uploadAvatar(UploadAvatarRequest $request)
    {
        return $this->success($this->service->storeAvatar($request->user(), $request->file('avatar'), $request), 'Đã cập nhật ảnh đại diện');
    }

    public function removeAvatar(Request $request)
    {
        return $this->success($this->service->removeAvatar($request->user(), $request), 'Đã xóa ảnh đại diện');
    }

    public function changePassword(ChangePasswordRequest $request)
    {
        $user = $request->user();

        $ok = $this->service->changePassword(
            $user,
            $request->input('current_password'),
            $request->input('password'),
            $request->boolean('logout_others'),
            $this->currentTokenId($request),
            $request
        );

        if (! $ok) {
            return $this->error('Mật khẩu hiện tại không đúng.', 422, ['current_password' => ['Mật khẩu hiện tại không đúng.']]);
        }

        return $this->success(null, 'Đổi mật khẩu thành công');
    }

    public function overview(Request $request)
    {
        return $this->success($this->service->overview($request->user(), $this->currentTokenId($request)));
    }

    public function sessions(Request $request)
    {
        return $this->success($this->service->sessions($request->user(), $this->currentTokenId($request)));
    }

    public function revokeSession(Request $request, int $id)
    {
        if ($id === (int) $this->currentTokenId($request)) {
            return $this->error('Đây là thiết bị bạn đang dùng. Hãy chọn Đăng xuất ở thanh menu.', 422);
        }
        if (! $this->service->revokeSession($request->user(), $id, $request)) {
            return $this->error('Không tìm thấy phiên đăng nhập.', 404);
        }

        return $this->success(null, 'Đã đăng xuất thiết bị');
    }

    public function revokeOtherSessions(Request $request)
    {
        $n = $this->service->revokeOtherSessions($request->user(), $this->currentTokenId($request), $request);

        return $this->success(['revoked' => $n], $n ? "Đã đăng xuất {$n} thiết bị khác" : 'Không có thiết bị nào khác đang đăng nhập');
    }

    public function loginHistory(Request $request)
    {
        return $this->success($this->service->loginHistory($request->user(), min((int) $request->query('limit', 10), 50)));
    }

    public function activity(Request $request)
    {
        return $this->success($this->service->activity(
            $request->user(),
            $request->only(['per_page', 'page', 'action', 'search', 'from', 'to'])
        ));
    }

    public function settings(Request $request)
    {
        return $this->success($this->service->settings($request->user()));
    }

    public function updateSettings(UpdateSettingsRequest $request)
    {
        return $this->success($this->service->updateSettings($request->user(), $request->validated(), $request), 'Đã lưu cài đặt');
    }

    private function currentTokenId(Request $request): ?int
    {
        $id = data_get($request->user()->currentAccessToken(), 'id');

        return $id ? (int) $id : null;
    }
}
