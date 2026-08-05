# Manual QA Execution Guide (Deliverability Engine V2)

This guide documents the strict set of QA checks that **must** be executed manually. 

**Why Automation is Impossible for these checks:**
Automated testing tools cannot physically log into a consumer webmail provider (like Apple Mail, Yahoo, or a corporate Microsoft 365 environment) to simulate real human rendering of emails. The platform cannot bypass the visual rendering logic implemented by these external providers. Furthermore, generating a true "spam score" requires the email to traverse the live public internet using real DNS records (SPF/DKIM/DMARC) established on a live domain, which cannot be simulated from a local sandboxed environment.

---

## Task 1: Inbox vs Spam Placement (Real-World Reputation)

**Why Manual:** Real inbox placement is governed by proprietary machine learning models (Gmail, Microsoft, Yahoo). It cannot be faked or fully asserted via local code logic.

**Exact Action:**
1. Configure a real, warmed-up tracking domain in `TRACKING_STRATEGY`.
2. Schedule a sequence of 5 emails to seed accounts you own across Gmail, Outlook, Yahoo, and Apple Mail.
3. Observe the delivery folder.

**Pass Criteria:** 
- The email is placed in the **Primary** or **Promotions** tab in Gmail. 
- The email is placed in the **Inbox** in Outlook, Yahoo, and Apple Mail.

**Fail Criteria:**
- The email lands in the **Spam / Junk** folder. (Note: If this occurs, it indicates a domain reputation failure, not necessarily a code failure, provided Task 3 passes).

---

## Task 2: Visual Rendering & List-Unsubscribe

**Why Manual:** The RFC 8058 `List-Unsubscribe` header is injected perfectly into the raw MIME. However, Apple Mail and Gmail UI parse this header differently to display the "Unsubscribe" button at the top of the screen.

**Exact Action:**
1. Open the delivered email on an iOS device (Apple Mail) and Gmail Web.
2. Look for the native "Unsubscribe" banner/button rendered by the mail client.

**Pass Criteria:**
- The native Unsubscribe button is visible and clickable.
- The HTML body renders without broken images.

**Fail Criteria:**
- The button is entirely missing despite `ENABLE_LIST_UNSUBSCRIBE=true` being set in the environment.

---

## Task 3: GlockApps / Mail-Tester Validation

**Why Manual:** Requires a live SMTP pipeline and live domain to analyze true DNS alignment.

**Exact Action:**
1. Obtain an inbound test address from Mail-Tester (e.g., `test-xxxx@srv1.mail-tester.com`).
2. Send a live sequence email to this address.
3. Review the generated Mail-Tester report.

**Pass Criteria:**
- SpamAssassin Score >= 9.5 / 10.
- SPF, DKIM, and DMARC show as strictly `PASS`.
- No broken HTML/tracking links reported.

**Fail Criteria:**
- Score < 9.0.
- Authentication failures (DKIM signature mismatch due to body mutation in transit).
