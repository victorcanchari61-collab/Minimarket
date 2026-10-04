<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('guests visiting the root are sent to the login screen', function () {
    $this->get(route('home'))->assertRedirect(route('login'));
});

test('authenticated users visiting the root are sent to their dashboard', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get(route('home'))->assertRedirect();
});
