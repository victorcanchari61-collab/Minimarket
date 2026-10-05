<?php

use App\Http\Controllers\LoginPageController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login')->name('home');
Route::get('/login', LoginPageController::class)->name('login');
Route::inertia('/dashboard', 'dashboard')->name('dashboard');
