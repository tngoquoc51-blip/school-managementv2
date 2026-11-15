<?php

namespace App\Providers;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

/**
 * Đăng ký API Chuyên môn – Ban Giám hiệu: /api/v1/academic/bgh/...
 * Đăng ký trực tiếp nên không phụ thuộc vào cách dự án nạp Modules/Academic/Routes/api.php.
 */
class BghAcademicServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $routes = base_path('Modules/Academic/Routes/bgh.php');

        if (! is_file($routes) || $this->app->routesAreCached()) {
            return;
        }

        Route::middleware('api')->prefix('api/v1/academic')->group($routes);
    }
}
