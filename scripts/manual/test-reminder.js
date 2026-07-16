// Quick test script to check if reminder system works
// Run with: node test-reminder.js

const fetch = require('node:http');

console.log('Testing reminder cron job...\n');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/cron/send-reminders',
  method: 'GET',
};

const req = fetch.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response:', JSON.parse(data));
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.end();
