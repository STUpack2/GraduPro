<?php
// Copy this file to a secure location OUTSIDE public_html, e.g. /home/USER/secure/config.php
// Then update paypal, firebase, and smtp settings.

return [
  'paypal' => [
    'client_id' => 'AeVTz_6I7_uKvOxhrtuOQVY7Niusg_sNx--T5DdVe3-DCiA3ZFObqcEDOQaUHeKDAzIbmBxDtJ9MCTX2',
    'secret' => 'ELZBVTL-1P3vW-os4McykLOD4cmwPCCPgU_JTippyqvmIJV5r_KDi-AS3rN7j4ES9VCL00X0D8huc3-H',
    'webhook_id' => '1DE43209DV759253S',
    'api_base' => 'https://api-m.paypal.com',
  ],
  'firebase' => [
    // Absolute path to your service account JSON
    'service_account' => '/home/dietgzty/secure/service-account.json',
    'project_id' => 'dietin-web'
  ],
  'smtp' => [
    'host' => 'dietin.fit',
    'port' => 465,
    'secure' => 'ssl', // ssl or tls
    'username' => 'invoices@dietin.fit',
    'password' => '998877Mostafa',
    'from_email' => 'invoices@dietin.fit',
    'from_name' => 'Dietin Billing'
  ]
];
