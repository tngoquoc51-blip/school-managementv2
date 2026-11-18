<?php

namespace App\Providers;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

/**
 * Đăng ký API Sơ đồ & Sĩ số lớp: /api/v1/homeroom/seating/...
 * Đăng ký trực tiếp nên không phụ thuộc cách dự án nạp route của module.
 */
class HrSeatingServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $routes = base_path('Modules/HrSeating/Routes/seating.php');

        if (! is_file($routes) || $this->app->routesAreCached()) {
            return;
        }

        Route::middleware('api')->prefix('api/v1')->group($routes);
    }
}
