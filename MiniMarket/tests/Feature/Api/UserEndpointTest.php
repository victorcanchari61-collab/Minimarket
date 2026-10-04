<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('api user endpoint rejects guests with a json 401', function () {
    $this->getJson('/api/user')->assertUnauthorized();
});

test('api user endpoint returns the user for a valid bearer token', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/user')
        ->assertOk()
        ->assertJsonPath('data.email', $user->email);
});
