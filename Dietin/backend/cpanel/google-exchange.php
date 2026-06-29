<?php
// google-exchange.php
// Exchange a Google ID token or access token for a Firebase Custom Token
// CORS headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

require __DIR__ . '/vendor/autoload.php';

use Kreait\Firebase\Factory;

function json_error($message, $code = 400)
{
  http_response_code($code);
  echo json_encode(['error' => $message]);
  exit;
}

try {
  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);
  if (!is_array($data)) {
    json_error('Invalid JSON body');
  }

  $googleClientId = '139206279964-dd2l28km1fif9tmd28h9444sdvke5igv.apps.googleusercontent.com';

  $idToken = $data['id_token'] ?? null;
  $accessToken = $data['access_token'] ?? null;

  if (!$idToken && !$accessToken) {
    json_error('Provide id_token or access_token');
  }

  // Resolve service account path for Kreait Admin SDK
  // Priority: config.php -> FIREBASE_SERVICE_ACCOUNT env var -> local service-account.json
  $serviceAccountPath = null;
  $configPath = __DIR__ . '/config.php';
  if (file_exists($configPath)) {
    $cfg = require $configPath;
    if (is_array($cfg) && !empty($cfg['firebase']['service_account'])) {
      $serviceAccountPath = $cfg['firebase']['service_account'];
    }
  }
  if (!$serviceAccountPath) {
    $envPath = getenv('FIREBASE_SERVICE_ACCOUNT');
    if ($envPath && file_exists($envPath)) {
      $serviceAccountPath = $envPath;
    }
  }
  if (!$serviceAccountPath) {
    $localJson = __DIR__ . '/service-account.json';
    if (file_exists($localJson)) {
      $serviceAccountPath = $localJson;
    }
  }
  // As a final fallback, try to locate any service account JSON in this directory
  if (!$serviceAccountPath) {
    $candidates = glob(__DIR__ . '/*.json') ?: [];
    // Prefer files that look like they belong to the current project
    usort($candidates, function ($a, $b) {
      $scoreA = (strpos($a, 'dietin-web') !== false) ? 0 : 1;
      $scoreB = (strpos($b, 'dietin-web') !== false) ? 0 : 1;
      return $scoreA <=> $scoreB;
    });
    if (!empty($candidates)) {
      $serviceAccountPath = $candidates[0];
    }
  }
  if (!$serviceAccountPath || !file_exists($serviceAccountPath)) {
    json_error('Server not configured. Missing service account path. Provide one of: backend/cpanel/config.php (see config.sample.php), FIREBASE_SERVICE_ACCOUNT env var, or place service-account.json in backend/cpanel.', 500);
  }

  // Validate token with Google
  $sub = null; // Google user id
  $email = null;
  $name = null;
  $picture = null;
  $emailVerified = null;

  if ($idToken) {
    // Verify ID token via Google tokeninfo
    $verifyUrl = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken);
    $resp = @file_get_contents($verifyUrl);
    if ($resp === false) {
      json_error('Failed to verify id_token with Google', 401);
    }
    $info = json_decode($resp, true);
    if (!is_array($info) || empty($info['aud']) || $info['aud'] !== $googleClientId) {
      json_error('Invalid id_token audience', 401);
    }
    if (!empty($info['exp']) && time() >= (int) $info['exp']) {
      json_error('id_token expired', 401);
    }
    $sub = $info['sub'] ?? null;
    $email = $info['email'] ?? null;
    $emailVerified = isset($info['email_verified']) ? filter_var($info['email_verified'], FILTER_VALIDATE_BOOLEAN) : null;
    // Fetch userinfo for name/picture if available
    $name = $info['name'] ?? null;
    $picture = $info['picture'] ?? null;
    if (!$sub) {
      json_error('Invalid id_token: missing sub', 401);
    }
  } else {
    // Access token path: validate and fetch userinfo
    $tokenInfoUrl = 'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' . urlencode($accessToken);
    $resp = @file_get_contents($tokenInfoUrl);
    if ($resp === false) {
      json_error('Failed to verify access_token with Google', 401);
    }
    $info = json_decode($resp, true);
    if (!is_array($info) || empty($info['audience']) || $info['audience'] !== $googleClientId) {
      json_error('Invalid access_token audience', 401);
    }
    // Fetch userinfo to get sub/email
    $userInfoResp = @file_get_contents('https://www.googleapis.com/oauth2/v3/userinfo?access_token=' . urlencode($accessToken));
    if ($userInfoResp === false) {
      json_error('Failed to fetch userinfo', 401);
    }
    $ui = json_decode($userInfoResp, true);
    $sub = $ui['sub'] ?? null;
    $email = $ui['email'] ?? null;
    $emailVerified = isset($ui['email_verified']) ? (bool) $ui['email_verified'] : null;
    $name = $ui['name'] ?? null;
    $picture = $ui['picture'] ?? null;
    if (!$sub) {
      json_error('Invalid access_token: missing sub', 401);
    }
  }

  // Create Firebase custom token
  $factory = (new Factory())->withServiceAccount($serviceAccountPath);
  $auth = $factory->createAuth();

  $claims = [];
  if ($email !== null)
    $claims['email'] = $email;
  if ($emailVerified !== null)
    $claims['email_verified'] = $emailVerified;
  if ($name !== null)
    $claims['name'] = $name;
  if ($picture !== null)
    $claims['picture'] = $picture;

  $customToken = $auth->createCustomToken($sub, $claims)->toString();

  echo json_encode([
    'customToken' => $customToken,
    'uid' => $sub,
    'email' => $email,
    'name' => $name,
    'picture' => $picture
  ]);
} catch (Throwable $e) {
  json_error('Server error: ' . $e->getMessage(), 500);
}
