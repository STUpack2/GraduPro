// Script to deploy Firestore rules
// Run with: node deploy-rules.js

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check if Firebase CLI is installed
exec('firebase --version', (error) => {
  if (error) {
    console.error('Firebase CLI is not installed. Please install it with:');
    console.error('npm install -g firebase-tools');
    process.exit(1);
  }

  deployRules();
});

function deployRules() {
  console.log('Deploying Firestore rules...');

  // Make sure we're logged in
  exec('firebase login:ci --no-localhost', (error, stdout) => {
    if (error) {
      console.error('Failed to login to Firebase:', error);
      process.exit(1);
    }

    // Extract token from output
    const match = stdout.match(/(?:use this token:|1\/.+)/g);
    if (match) {
      const token = match[0].includes('1/') ? match[0] : match[1];
      console.log('Successfully logged in to Firebase.');

      // Deploy the rules
      exec(`firebase deploy --only firestore:rules --token "${token}" --project dietin-web`, (deployError, deployStdout) => {
        if (deployError) {
          console.error('Failed to deploy Firestore rules:', deployError);
          process.exit(1);
        }

        console.log(deployStdout);
        console.log('Firestore rules deployed successfully!');
      });
    } else {
      console.error('Could not extract Firebase token from login output.');
      process.exit(1);
    }
  });
} 