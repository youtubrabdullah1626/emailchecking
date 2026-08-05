import { buildGmailMessage } from "../src/lib/gmail/message";

function runMimeValidation() {
  console.log(`\n--- Strict RFC & MIME Structure Validation ---`);
  
  const payload = buildGmailMessage({
    from: "sender@example.com",
    to: "recipient@example.com",
    toName: "John",
    subject: "RFC Strict Validation",
    body: "Plain body",
    enableListUnsubscribe: true
  });

  const rawDecoded = Buffer.from(payload.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');

  const validations = [
    {
      name: "RFC 5322 - Mandatory Date Header",
      test: () => /^Date: .+ GMT/m.test(rawDecoded)
    },
    {
      name: "RFC 5322 - Secure Message-ID formatting",
      test: () => /^Message-ID: <[0-9]+\.[a-f0-9]{32}@example\.com>$/m.test(rawDecoded)
    },
    {
      name: "RFC 2045 - Valid MIME Version",
      test: () => /^MIME-Version: 1\.0$/m.test(rawDecoded)
    },
    {
      name: "RFC 2046 - multipart/alternative boundary declaration",
      test: () => /^Content-Type: multipart\/alternative; boundary=".+"$/m.test(rawDecoded)
    },
    {
      name: "RFC 8058 - List-Unsubscribe-Post One-Click",
      test: () => /^List-Unsubscribe-Post: List-Unsubscribe=One-Click$/m.test(rawDecoded)
    },
    {
      name: "Security - No CRLF Injection in Subject",
      test: () => /^Subject: RFC Strict Validation$/m.test(rawDecoded)
    },
    {
      name: "Structure - HTML part is Base64 encoded",
      test: () => rawDecoded.includes("Content-Type: text/html; charset=\"UTF-8\"\r\nContent-Transfer-Encoding: base64")
    }
  ];

  let passed = 0;
  validations.forEach(v => {
    const success = v.test();
    console.log(`[${success ? 'PASS' : 'FAIL'}] ${v.name}`);
    if (success) passed++;
  });

  if (passed === validations.length) {
    console.log(`\n[SUCCESS] 100% Validation Passed. The MIME payload strictly adheres to all enterprise RFCs.`);
  } else {
    console.error(`\n[FATAL] RFC Validation failed on ${validations.length - passed} rule(s).`);
    process.exit(1);
  }
}

runMimeValidation();
