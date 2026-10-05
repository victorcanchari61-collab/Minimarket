<?php

use App\Enums\SystemKey;
use App\Http\Controllers\LoginPageController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::redirect('/', '/login')->name('home');
Route::get('/login', LoginPageController::class)->name('login');

Route::inertia('/sistemas', 'sistemas')->name('systems.index');

Route::get('/sistemas/{system}/{module?}/{item?}', fn (SystemKey $system, ?string $module = null, ?string $item = null) => Inertia::render('sistema', [
    'system' => $system->value,
    'module' => $module,
    'item' => $item,
]))->where(['module' => '[a-z0-9-]+', 'item' => '[a-z0-9-]+'])->name('systems.show');
