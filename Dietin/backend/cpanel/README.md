cPanel PHP Webhook for PayPal + Firebase

Overview
This folder contains a minimal PHP backend to handle PayPal subscription webhooks on Namecheap cPanel, update Firebase Firestore, send invoice emails via your cPanel SMTP, and create tickets.

Files
- paypal-webhook.php: Public webhook endpoint you will place under your site (e.g., app.dietin.fit/api/paypal-webhook.php)
- config.sample.php: Copy to a secure location outside your web root (e.g., /home/USER/secure/config.php), fill with your credentials.
- composer.json: PHP dependencies (Firebase Admin SDK, PHPMailer, Guzzle).

Setup Steps (on cPanel)
1) Create secure folder for secrets (outside public_html)
   - Example: /home/USER/secure
   - Upload your Firebase service account JSON to /home/USER/secure/service-account.json
   - Copy config.sample.php to /home/USER/secure/config.php and fill in values.

2) Deploy code
   - Decide the public path for the webhook, e.g.: public_html/app/api/
   - Upload paypal-webhook.php to that folder.
   - Edit the absolute paths at the top of paypal-webhook.php if needed to point to config + vendor.

3) Install PHP dependencies with Composer
   - In cPanel Terminal (or SSH), create a folder for vendor (outside web root), e.g. /home/USER/vendor
   - Upload composer.json somewhere (e.g., /home/USER/webhooks) and run:
     composer install --no-dev --prefer-dist
   - Move or symlink the vendor folder to a stable path, e.g., /home/USER/vendor
   - Update the require_once path in paypal-webhook.php to point to /home/USER/vendor/autoload.php

   Alternatively, run composer install in the same directory where paypal-webhook.php lives, then keep vendor/ next to it. Make sure vendor/ is not publicly browsable (.htaccess can help). Using a path outside public_html is preferred.

4) Configure PayPal Webhook (Live)
   - PayPal Developer Dashboard → My Apps & Credentials → Live → open your REST app → Webhooks → Add Webhook
   - Webhook URL: https://app.dietin.fit/api/paypal-webhook.php
   - Events:
     - BILLING.SUBSCRIPTION.ACTIVATED
     - BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED (or PAYMENT.SALE.COMPLETED)
     - BILLING.SUBSCRIPTION.CANCELLED
     - BILLING.SUBSCRIPTION.SUSPENDED
   - Copy the generated webhook_id and put it in config.php

5) Verify it works
   - Use PayPal’s "Resend Webhook" feature or trigger a real event.
   - Check that Firestore updates users/{uid} with: isPro, proStartDate, proEndDate, subscriptionId, lastUpdated
   - Check invoices/{id} and tickets/{id}
   - Confirm invoice email is received.

Security Notes
- Never place service-account.json or config.php in public_html.
- Ensure HTTPS is enabled (AutoSSL).
- The script only accepts POST and verifies PayPal signature.

Next Steps
- After confirming, we can add a reconcile.php (cron) to periodically check PayPal and correct any drift.
