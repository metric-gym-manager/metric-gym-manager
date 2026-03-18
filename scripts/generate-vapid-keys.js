#!/usr/bin/env node

/**
 * Generates VAPID key pair for Web Push notifications.
 * Run once per deployment environment: node scripts/generate-vapid-keys.js
 * Copy the output into your .env.local file.
 */

const webpush = require('web-push');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n🔑 VAPID Keys Generated Successfully!\n');
console.log('Add the following to your .env.local file:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:support@metricgymmanager.com`);
console.log('\n⚠️  Keep VAPID_PRIVATE_KEY secret — never expose it client-side.\n');
