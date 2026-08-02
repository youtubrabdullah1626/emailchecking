const fs = require('fs');
const http = require('http');

const data = JSON.stringify({
  to: "youtubrabdullah1626@gmail.com",
  toName: "Test User",
  subject: "Testing Backend Email Route",
  content: "This is a direct test of the /api/gmail/send-demo endpoint."
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/gmail/send-demo',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  res.on('end', () => {
    console.log('RESPONSE:', responseData);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
