<?php
// Public webhook endpoint for Paymob payments. Deploy this under your site, e.g. public_html/app/api/paymob-webhook.php
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

  // Log the webhook event for debugging
  error_log('Paymob webhook received: ' . json_encode($event));

  // Paymob webhook verification (using HMAC signature)
  $headers = getallheaders();
  $signature = $headers['X-Paymob-Signature'] ?? $headers['x-paymob-signature'] ?? null;
  
  if (!$signature) {
    http_response_code(400);
    echo 'Missing Paymob signature';
    exit;
  }

  // Verify signature using your Paymob webhook secret
  $paymob = $config['paymob'];
  $expectedSignature = hash_hmac('sha256', $rawBody, $paymob['webhook_secret']);
  
  if (!hash_equals($expectedSignature, $signature)) {
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
        . '<p><b>Amount:</b> ' . htmlspecialchars(number_format($invoice['amount'] ?? 0, 2)) . ' ' . htmlspecialchars($invoice['currency'] ?? 'EGP') . '</p>'
        . '<p><b>Period:</b> ' . htmlspecialchars($invoice['periodStart'] ?? '') . ' to ' . htmlspecialchars($invoice['periodEnd'] ?? '') . '</p>';

      $mail->send();
    } catch (MailException $e) {
      error_log('Email send failed: ' . $e->getMessage());
    }
  };

  // Helper: create invoice number
  $createInvoiceNumber = function() use ($db) {
    $date = gmdate('Ymd');
    $rand = substr(strtoupper(bin2hex(random_bytes(3))), 0, 6);
    return 'INV-' . $date . '-' . $rand;
  };

  // Extract details from Paymob webhook
  $eventType = $event['type'] ?? '';
  $transaction = $event['obj'] ?? [];
  $orderId = $transaction['order']['id'] ?? '';
  $merchantOrderId = $transaction['order']['merchant_order_id'] ?? '';
  $payerEmail = $transaction['order']['shipping_data']['email'] ?? '';
  $amount = (float)($transaction['amount_cents'] ?? 0) / 100; // Convert from cents
  $currency = $transaction['currency'] ?? 'EGP';
  $success = $transaction['success'] ?? false;

  // Only process successful transactions
  if (!$success || $eventType !== 'transaction_processed') {
    http_response_code(200);
    echo 'ignored';
    exit;
  }

  // Determine subscription plan from merchant_order_id or amount
  // You can encode plan info in merchant_order_id when creating the payment
  $isAnnual = false;
  $planType = 'monthly'; // default
  
  // Detect plan type based on amount or order ID
  if ($amount >= 3500) { // Annual plan amount
    $isAnnual = true;
    $planType = 'annual';
  } elseif (strpos($merchantOrderId, 'annual') !== false) {
    $isAnnual = true;
    $planType = 'annual';
  }

  // Find user by email or order reference
  $userDoc = null;
  if ($payerEmail) {
    // Try to find user by email
    $query = $db->collection('users')->where('email', '=', $payerEmail)->limit(1)->documents();
    foreach ($query as $doc) { $userDoc = $doc; break; }
    
    if (!$userDoc) {
      // Try invoiceEmail field
      $query = $db->collection('users')->where('invoiceEmail', '=', $payerEmail)->limit(1)->documents();
      foreach ($query as $doc) { $userDoc = $doc; break; }
    }
  }

  if (!$userDoc) {
    // If we cannot map, log and succeed to avoid Paymob retries
    error_log('No matching user for Paymob payment. Email: ' . $payerEmail . ', Order: ' . $orderId);
    http_response_code(200);
    echo 'ok';
    exit;
  }

  $uid = $userDoc->id();
  $userData = $userDoc->data();
  $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
  error_log('Paymob webhook: uid=' . $uid . ' plan=' . $planType . ' amount=' . $amount . ' email=' . $payerEmail);

  // Compute subscription period
  $existingEnd = isset($userData['proEndDate']) ? new DateTimeImmutable($userData['proEndDate']) : null;
  
  if ($existingEnd && $existingEnd > $now) {
    // Extend from existing end date
    $periodStart = $existingEnd;
  } else {
    // Start from now
    $periodStart = $now;
  }

  // Set end date based on plan type
  if ($isAnnual) {
    // Annual plan: exactly 365 days
    $periodEnd = $periodStart->modify('+365 days');
  } else {
    // Monthly plan: 30 days
    $periodEnd = $periodStart->modify('+30 days');
  }

  // Update user subscription
  $userUpdate = [
    'subscriptionId' => $orderId, // Use Paymob order ID as subscription reference
    'subscriptionPlan' => $planType,
    'proStartDate' => $periodStart->format(DATE_ATOM),
    'proEndDate' => $periodEnd->format(DATE_ATOM),
    'lastUpdated' => nowIso(),
  ];
  
  $isPro = ($now >= $periodStart) && ($now < $periodEnd);
  $userUpdate['isPro'] = $isPro;
  
  error_log('Paymob webhook: updating user ' . $uid . ' start=' . $userUpdate['proStartDate'] . ' end=' . $userUpdate['proEndDate'] . ' isPro=' . ($isPro ? 'true' : 'false') . ' plan=' . $planType);
  $db->collection('users')->document($uid)->set($userUpdate, ['merge' => true]);
  error_log('Paymob webhook: user ' . $uid . ' updated in Firestore');

  // Create invoice
  $invoiceId = bin2hex(random_bytes(8));
  $invoice = [
    'invoiceNumber' => $createInvoiceNumber(),
    'userId' => $uid,
    'subscriptionId' => $orderId,
    'subscriptionPlan' => $planType,
    'amount' => $amount,
    'currency' => $currency,
    'periodStart' => $periodStart->format(DATE_ATOM),
    'periodEnd' => $periodEnd->format(DATE_ATOM),
    'status' => 'paid',
    'paymentProvider' => 'paymob',
    'transactionId' => $transaction['id'] ?? '',
    'createdAt' => nowIso(),
  ];
  $db->collection('invoices')->document($invoiceId)->set($invoice);
  error_log('Paymob webhook: created invoice ' . $invoice['invoiceNumber'] . ' for user ' . $uid . ' amount=' . $amount . ' ' . $currency . ' plan=' . $planType);

  // Email invoice
  $to = $userData['invoiceEmail'] ?? $userData['email'] ?? $payerEmail;
  if ($to) {
    error_log('Paymob webhook: sending invoice email to ' . $to);
    $sendInvoiceEmail($invoice, $to);
  } else {
    error_log('Paymob webhook: no email found to send invoice for user ' . $uid);
  }

  // Create ticket for successful payment
  $ticketId = bin2hex(random_bytes(8));
  $ticket = [
    'userId' => $uid,
    'type' => 'subscription',
    'subject' => 'Subscription Payment - ' . ucfirst($planType) . ' Plan',
    'description' => 'Invoice ' . $invoice['invoiceNumber'] . ' for ' . $planType . ' subscription. Order ID: ' . $orderId,
    'linkedInvoiceId' => $invoiceId,
    'status' => 'open',
    'createdAt' => nowIso(),
  ];
  $db->collection('tickets')->document($ticketId)->set($ticket);
  error_log('Paymob webhook: created ticket ' . $ticketId . ' for user ' . $uid);

  http_response_code(200);
  echo 'ok';

} catch (Exception $e) {
  error_log('Paymob webhook error: ' . $e->getMessage());
  http_response_code(500);
  echo 'error';
}
