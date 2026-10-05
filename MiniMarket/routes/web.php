<?php

use App\Enums\SystemKey;
use App\Http\Controllers\LoginPageController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::redirect('/', '/login')->name('home');
Route::get('/login', LoginPageController::class)->name('login');

Route::inertia('/sistemas', 'sistemas')->name('systems.index');
Route::get('/sistemas/{system}', fn (SystemKey $system) => Inertia::render('sistema', [
    'system' => $system->value,
]))->name('systems.show');
