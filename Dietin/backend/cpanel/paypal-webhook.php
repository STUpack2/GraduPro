<?php
// Public webhook endpoint. Deploy this under your site, e.g. public_html/app/api/paypal-webhook.php
// Adjust absolute paths below to your environment.

use GuzzleHttp\Client;
use Kreait\Firebase\Factory;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

// Hard fail on non-POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo 'Method Not Allowed';
  exit;
}

// Absolute paths (EDIT THESE)
$CONFIG_PATH = '/home/dietgzty/secure/config.php'; // absolute path on server
$VENDOR_AUTOLOAD = '/home/dietgzty/vendor/autoload.php'; // path to Composer autoload (recommended outside web root)

// Load dependencies and config
require_once $VENDOR_AUTOLOAD;
$config = require $CONFIG_PATH;

function nowIso() { return gmdate('c'); }

try {
  $rawBody = file_get_contents('php://input');
  $event = json_decode($rawBody, true);
  if (!$event) {
    http_response_code(400);
    echo 'Invalid JSON';
    exit;
  }

  // Required PayPal headers
  $headers = getallheaders();
  $transmissionId = $headers['PayPal-Transmission-Id'] ?? $headers['PAYPAL-TRANSMISSION-ID'] ?? null;
  $transmissionTime = $headers['PayPal-Transmission-Time'] ?? $headers['PAYPAL-TRANSMISSION-TIME'] ?? null;
  $certUrl = $headers['PayPal-Cert-Url'] ?? $headers['PAYPAL-CERT-URL'] ?? null;
  $authAlgo = $headers['PayPal-Auth-Algo'] ?? $headers['PAYPAL-AUTH-ALGO'] ?? null;
  $transmissionSig = $headers['PayPal-Transmission-Sig'] ?? $headers['PAYPAL-TRANSMISSION-SIG'] ?? null;

  if (!$transmissionId || !$transmissionTime || !$certUrl || !$authAlgo || !$transmissionSig) {
    http_response_code(400);
    echo 'Missing PayPal headers';
    exit;
  }

  $paypal = $config['paypal'];
  $client = new Client(['base_uri' => $paypal['api_base']]);

  // Get PayPal access token
  $resp = $client->post('/v1/oauth2/token', [
    'auth' => [$paypal['client_id'], $paypal['secret']],
    'form_params' => ['grant_type' => 'client_credentials']
  ]);
  $access = json_decode((string) $resp->getBody(), true);
  $accessToken = $access['access_token'] ?? null;
  if (!$accessToken) throw new Exception('Failed to get PayPal access token');

  // Verify webhook signature
  $verifyPayload = [
    'transmission_id' => $transmissionId,
    'transmission_time' => $transmissionTime,
    'cert_url' => $certUrl,
    'auth_algo' => $authAlgo,
    'transmission_sig' => $transmissionSig,
    'webhook_id' => $paypal['webhook_id'],
    'webhook_event' => $event,
  ];

  $verifyResp = $client->post('/v1/notifications/verify-webhook-signature', [
    'headers' => [
      'Content-Type' => 'application/json',
      'Authorization' => 'Bearer ' . $accessToken,
    ],
    'json' => $verifyPayload,
  ]);
  $verify = json_decode((string) $verifyResp->getBody(), true);
  if (($verify['verification_status'] ?? '') !== 'SUCCESS') {
    http_response_code(400);
    echo 'Invalid signature';
    exit;
  }

  // Prepare Firebase
  $factory = (new Factory)->withServiceAccount($config['firebase']['service_account'])->withProjectId($config['firebase']['project_id']);
  $firestore = $factory->createFirestore();
  $db = $firestore->database();

  // Helper: send invoice email
  $sendInvoiceEmail = function(array $invoice, string $toEmail) use ($config) {
    $mail = new PHPMailer(true);
    try {
      $mail->isSMTP();
      $mail->Host = $config['smtp']['host'];
      $mail->SMTPAuth = true;
      $mail->Username = $config['smtp']['username'];
      $mail->Password = $config['smtp']['password'];
      $mail->SMTPSecure = $config['smtp']['secure'];
      $mail->Port = $config['smtp']['port'];

      $mail->setFrom($config['smtp']['from_email'], $config['smtp']['from_name']);
      $mail->addAddress($toEmail);

      $mail->isHTML(true);
      $mail->Subject = 'Your Dietin Pro Invoice ' . ($invoice['invoiceNumber'] ?? '');
      $mail->Body = '<p>Thank you for your payment.</p>'
        . '<p><b>Invoice:</b> ' . htmlspecialchars($invoice['invoiceNumber'] ?? '') . '</p>'
        . '<p><b>Amount:</b> ' . htmlspecialchars(number_format($invoice['amount'] ?? 0, 2)) . ' ' . htmlspecialchars($invoice['currency'] ?? 'USD') . '</p>'
        . '<p><b>Period:</b> ' . htmlspecialchars($invoice['periodStart'] ?? '') . ' to ' . htmlspecialchars($invoice['periodEnd'] ?? '') . '</p>';

      $mail->send();
    } catch (MailException $e) {
      error_log('Email send failed: ' . $e->getMessage());
    }
  };

  // Helper: create invoice number (simple).
  $createInvoiceNumber = function() use ($db) {
    $date = gmdate('Ymd');
    $rand = substr(strtoupper(bin2hex(random_bytes(3))), 0, 6);
    return 'INV-' . $date . '-' . $rand;
  };

  // Extract details
  $eventType = $event['event_type'] ?? '';
  $resource = $event['resource'] ?? [];
  $subscriptionId = $resource['id'] ?? ($resource['billing_agreement_id'] ?? '');
  $payerEmail = $resource['subscriber']['email_address'] ?? ($resource['payer']['email_address'] ?? '');
  // Amount/currency fallbacks for different PayPal payload shapes
  $amount = (float)($resource['billing_info']['last_payment']['amount']['value']
    ?? $resource['amount']['value']
    ?? $resource['amount']['total']
    ?? 0);
  $currency = ($resource['billing_info']['last_payment']['amount']['currency_code']
    ?? $resource['amount']['currency_code']
    ?? $resource['amount']['currency']
    ?? 'USD');

  // Determine user mapping
  // Preferred: store subscriptionId on user doc when client creates it; else fallback to finding by email.
  $userDoc = null;
  if ($subscriptionId) {
    $query = $db->collection('users')->where('subscriptionId', '=', $subscriptionId)->limit(1)->documents();
    foreach ($query as $doc) { $userDoc = $doc; break; }
  }
  if (!$userDoc && $payerEmail) {
    $query = $db->collection('users')->where('invoiceEmail', '=', $payerEmail)->limit(1)->documents();
    foreach ($query as $doc) { $userDoc = $doc; break; }
  }
  if (!$userDoc) {
    // As last resort, try auth email field if stored
    $query = $db->collection('users')->where('email', '=', $payerEmail)->limit(1)->documents();
    foreach ($query as $doc) { $userDoc = $doc; break; }
  }

  if (!$userDoc) {
    // If we cannot map, log and succeed to avoid PayPal retries storm; handle manually.
    error_log('No matching user for subscription ' . $subscriptionId . ' email ' . $payerEmail);
    http_response_code(200);
    echo 'ok';
    exit;
  }

  $uid = $userDoc->id();
  $userData = $userDoc->data();
  $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
  error_log('Webhook: event=' . $eventType . ' uid=' . $uid . ' subId=' . $subscriptionId . ' email=' . $payerEmail);

  // Compute period
  $cycleMonths = 1; // adjust if your plan is monthly
  if ($eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
    $periodStart = $now;
    // Use fixed 30-day period instead of calendar month
    $periodEnd = $now->modify('+30 days');
  } elseif (in_array($eventType, ['BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED', 'PAYMENT.SALE.COMPLETED'])) {
    // Renewal: extend from existing end if in the future; else from now
    $existingEnd = isset($userData['proEndDate']) ? new DateTimeImmutable($userData['proEndDate']) : null;
    if ($existingEnd && $existingEnd > $now) {
      $periodStart = $existingEnd;
      $periodEnd = $existingEnd->modify('+30 days');
    } else {
      $periodStart = $now;
      $periodEnd = $now->modify('+30 days');
    }
  } elseif (in_array($eventType, ['BILLING.SUBSCRIPTION.CANCELLED', 'BILLING.SUBSCRIPTION.SUSPENDED'])) {
    // Do not flip immediately; keep until current end
    // Nothing to update for dates here beyond logging; isPro will be derived below
    $periodStart = isset($userData['proStartDate']) ? new DateTimeImmutable($userData['proStartDate']) : $now;
    $periodEnd = isset($userData['proEndDate']) ? new DateTimeImmutable($userData['proEndDate']) : $now;
  } else {
    // Unhandled event types are OK
    http_response_code(200);
    echo 'ignored';
    exit;
  }

  // Persist user fields: always set start & end; compute isPro = now within [start, end)
  $userUpdate = [
    'subscriptionId' => $subscriptionId,
    'proStartDate' => $periodStart->format(DATE_ATOM),
    'proEndDate' => $periodEnd->format(DATE_ATOM),
    'lastUpdated' => nowIso(),
  ];
  $isPro = ($now >= $periodStart) && ($now < $periodEnd);
  $userUpdate['isPro'] = $isPro;
  error_log('Webhook: updating user ' . $uid . ' start=' . $userUpdate['proStartDate'] . ' end=' . $userUpdate['proEndDate'] . ' isPro=' . ($isPro ? 'true' : 'false'));
  $db->collection('users')->document($uid)->set($userUpdate, ['merge' => true]);
  error_log('Webhook: user ' . $uid . ' updated in Firestore');

  // Create invoice only on payment events (not on activation)
  if (in_array($eventType, ['BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED', 'PAYMENT.SALE.COMPLETED'])) {
    $invoiceId = bin2hex(random_bytes(8));
    $invoice = [
      'invoiceNumber' => $createInvoiceNumber(),
      'userId' => $uid,
      'subscriptionId' => $subscriptionId,
      'amount' => $amount,
      'currency' => $currency,
      'periodStart' => $periodStart->format(DATE_ATOM),
      'periodEnd' => $periodEnd->format(DATE_ATOM),
      'status' => 'paid',
      'createdAt' => nowIso(),
    ];
    $db->collection('invoices')->document($invoiceId)->set($invoice);
    error_log('Webhook: created invoice ' . $invoice['invoiceNumber'] . ' for user ' . $uid . ' amount=' . $amount . ' ' . $currency);

    // Email invoice
    $to = $userData['invoiceEmail'] ?? $userData['email'] ?? $payerEmail;
    if ($to) {
      error_log('Webhook: sending invoice email to ' . $to);
      $sendInvoiceEmail($invoice, $to);
    } else {
      error_log('Webhook: no email found to send invoice for user ' . $uid);
    }

    // Create ticket
    $ticketId = bin2hex(random_bytes(8));
    $ticket = [
      'userId' => $uid,
      'type' => 'subscription',
      'subject' => 'Subscription Renewal Payment',
      'description' => 'Invoice ' . $invoice['invoiceNumber'] . ' for subscription ' . $subscriptionId,
      'linkedInvoiceId' => $invoiceId,
      'status' => 'open',
      'createdAt' => nowIso(),
    ];
    $db->collection('tickets')->document($ticketId)->set($ticket);
    error_log('Webhook: created ticket ' . $ticketId . ' for user ' . $uid);
  }

  http_response_code(200);
  echo 'ok';
} catch (Throwable $e) {
  error_log('Webhook error: ' . $e->getMessage());
  http_response_code(500);
  echo 'error';
}
