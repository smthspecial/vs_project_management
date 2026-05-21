"use strict";

const frs = [
  {
    id: "FR-001",
    title: "User registration and email verification",
    linkedIds: "US-001,TASK-001,TASK-002",
    body: `## Description\n\nThe system shall allow users to register with a unique email address and a password that meets security requirements. A verification email must be sent, and the account shall remain inactive until the email is confirmed.\n\n## Acceptance Criteria\n\n- [ ] POST /api/auth/register creates a user in "pending" state\n- [ ] Verification email sent within 30 seconds\n- [ ] Account activated on GET /api/auth/verify-email?token=…\n- [ ] Duplicate email returns HTTP 409\n\n## Linked Items\n\n<!-- Set \`linkedIds: US-001,TASK-001,TASK-002\` in front matter to link stories/tasks -->\n`,
  },
  {
    id: "FR-002",
    title: "OAuth2 social login via Google and Facebook",
    linkedIds: "US-002,TASK-004,TASK-005",
    body: `## Description\n\nThe system shall support authentication via Google and Facebook using OAuth2 PKCE. New users shall be auto-registered; existing accounts matched by email shall be linked.\n\n## Acceptance Criteria\n\n- [ ] OAuth tokens validated server-side before session creation\n- [ ] Email used as primary identity key across providers\n- [ ] Provider and provider user ID stored per user\n\n## Linked Items\n\n<!-- Set \`linkedIds: US-002\` in front matter -->\n`,
  },
  {
    id: "FR-003",
    title: "Product listing CRUD with category assignment",
    linkedIds: "US-005,US-006,TASK-006",
    body: `## Description\n\nThe system shall allow authenticated sellers to create, read, update, and delete product listings. Each listing must be assigned to at least one category.\n\n## Acceptance Criteria\n\n- [ ] POST /api/listings creates a draft listing\n- [ ] PUT /api/listings/:id updates all mutable fields\n- [ ] DELETE /api/listings/:id soft-deletes (status: archived)\n- [ ] Listings searchable within 60 seconds of publish\n\n## Linked Items\n\n<!-- Set \`linkedIds: US-005,US-006\` in front matter -->\n`,
  },
  {
    id: "FR-004",
    title: "Persistent shopping cart across sessions",
    linkedIds: "US-009,US-010,TASK-010",
    body: `## Description\n\nThe system shall maintain a shopping cart for authenticated users that persists across browser sessions for 30 days.\n\n## Acceptance Criteria\n\n- [ ] Cart survives browser close and reopen\n- [ ] Stock validated on each cart retrieval; out-of-stock items flagged\n- [ ] Guest cart merged into user cart on login\n\n## Linked Items\n\n<!-- Set \`linkedIds: US-009,US-010\` in front matter -->\n`,
  },
  {
    id: "FR-005",
    title: "PCI DSS compliant payment processing",
    linkedIds: "US-013,US-014,TASK-012,TASK-013",
    body: `## Description\n\nThe system shall process payments via Stripe (cards) and PayPal without sensitive card data passing through application servers.\n\n## Acceptance Criteria\n\n- [ ] Stripe Elements used for card capture — no raw PAN on our servers\n- [ ] PayPal Orders v2 API used for PayPal payments\n- [ ] All payment events recorded in audit log\n- [ ] Webhook signatures verified before processing\n\n## Linked Items\n\n<!-- Set \`linkedIds: US-013,US-014\` in front matter -->\n`,
  },
  {
    id: "FR-006",
    title: "Full-text product search with faceted filtering",
    linkedIds: "US-019,US-020,TASK-015,TASK-016",
    body: `## Description\n\nThe system shall provide a search interface backed by Elasticsearch, supporting full-text queries, fuzzy matching, and faceted filters (category, price, rating, availability).\n\n## Acceptance Criteria\n\n- [ ] Search API responds in < 300 ms (p95)\n- [ ] Typo tolerance: single-character edits handled by fuzzy matching\n- [ ] Facet counts accurate and dynamically updated\n- [ ] Out-of-stock items excludable via filter\n\n## Linked Items\n\n<!-- Set \`linkedIds: US-019,US-020\` in front matter -->\n`,
  },
  {
    id: "FR-007",
    title: "Verified buyer reviews and star ratings",
    linkedIds: "US-022,US-023",
    body: `## Description\n\nThe system shall allow buyers who have completed a purchase to submit a star rating (1–5) and optional written review. Only one review per buyer per product is permitted.\n\n## Acceptance Criteria\n\n- [ ] Review submission locked until order status is "delivered"\n- [ ] Duplicate review returns HTTP 409\n- [ ] Aggregate rating updated within 5 seconds of new submission\n\n## Linked Items\n\n<!-- Set \`linkedIds: US-022,US-023\` in front matter -->\n`,
  },
  {
    id: "FR-008",
    title: "Real-time order status tracking",
    linkedIds: "US-025,TASK-018,TASK-019",
    body: `## Description\n\nThe system shall display real-time order status to buyers, sourced from ShipStation webhooks, with email and push notifications on each status change.\n\n## Acceptance Criteria\n\n- [ ] Status updated within 60 seconds of ShipStation webhook receipt\n- [ ] Status history shown in chronological order\n- [ ] Tracking number linked to carrier's tracking page\n\n## Linked Items\n\n<!-- Set \`linkedIds: US-025\` in front matter -->\n`,
  },
];

const nfrs = [
  {
    id: "NFR-001",
    title: "Page load time under 2 seconds (p95)",
    body: `## Description\n\nAll customer-facing pages shall load (Time to Interactive) within 2 seconds at the 95th percentile, measured on a simulated 4G connection.\n\n## Metric\n\n- Target: TTI ≤ 2 000 ms (p95) on 4G\n- Measurement: Synthetic monitoring via Datadog RUM; weekly report\n\n## Linked Items\n\n<!-- Set \`linkedIds: US-007,US-008\` in front matter to link stories/tasks -->\n`,
  },
  {
    id: "NFR-002",
    title: "99.9% monthly uptime SLA",
    body: `## Description\n\nThe platform shall maintain at least 99.9% uptime per calendar month, equating to no more than 43.8 minutes of downtime per month.\n\n## Metric\n\n- Target: Availability ≥ 99.9% per month\n- Measurement: Uptime Robot external probe every 1 minute\n\n## Linked Items\n\n<!-- link to architecture -->\n`,
  },
  {
    id: "NFR-003",
    title: "Support 10 000 concurrent users without degradation",
    body: `## Description\n\nThe system shall handle 10 000 simultaneous active users without response time degradation beyond 10% above baseline.\n\n## Metric\n\n- Target: p95 API latency ≤ 500 ms at 10 000 concurrent users\n- Measurement: k6 load test in staging before each release\n\n## Linked Items\n\n<!-- link to architecture -->\n`,
  },
  {
    id: "NFR-004",
    title: "PCI DSS SAQ-A compliance for payment handling",
    body: `## Description\n\nAll payment handling shall comply with PCI DSS SAQ-A, meaning no sensitive cardholder data is processed, stored, or transmitted by our application servers.\n\n## Metric\n\n- Target: Annual PCI DSS SAQ-A self-assessment passes with zero findings\n- Measurement: Annual self-assessment; quarterly vulnerability scan\n\n## Linked Items\n\n<!-- Set \`linkedIds: FR-005\` in front matter -->\n`,
  },
  {
    id: "NFR-005",
    title: "WCAG 2.1 AA accessibility compliance",
    body: `## Description\n\nAll customer-facing UI shall meet WCAG 2.1 Level AA success criteria to ensure the platform is accessible to users with disabilities.\n\n## Metric\n\n- Target: Zero WCAG 2.1 AA violations in axe automated scan\n- Measurement: axe-core integrated into CI; manual review for new flows\n\n## Linked Items\n\n<!-- link to all story epics -->\n`,
  },
  {
    id: "NFR-006",
    title: "Search results returned within 300 ms (p95)",
    body: `## Description\n\nThe search API shall return results within 300 ms at the 95th percentile under normal load.\n\n## Metric\n\n- Target: Search API p95 latency ≤ 300 ms\n- Measurement: Datadog APM trace on /api/search; alert if p95 > 300 ms\n\n## Linked Items\n\n<!-- Set \`linkedIds: FR-006,US-019\` in front matter -->\n`,
  },
  {
    id: "NFR-007",
    title: "GDPR-compliant data handling and deletion",
    body: `## Description\n\nThe platform shall comply with GDPR: users can export their data, and account deletion permanently removes all personal data within 30 days.\n\n## Metric\n\n- Target: Data deletion completed within 30 days of request\n- Measurement: Deletion job logs audited monthly\n\n## Linked Items\n\n<!-- link to user profile stories -->\n`,
  },
];

/** @param {Function} write @param {Function} fm @returns {{ frs: number, nfrs: number }} */
module.exports = function seedRequirements(write, fm) {
  for (const fr of frs) {
    write(
      `requirements/fr/${fr.id.toLowerCase()}.md`,
      fm({
        id: fr.id,
        type: "fr",
        title: fr.title,
        status: "active",
        linkedIds: fr.linkedIds,
        priority: "high",
        created: "2026-05-01",
      }) + fr.body,
    );
  }
  for (const nfr of nfrs) {
    write(
      `requirements/nfr/${nfr.id.toLowerCase()}.md`,
      fm({
        id: nfr.id,
        type: "nfr",
        title: nfr.title,
        status: "active",
        priority: "high",
        created: "2026-05-01",
      }) + nfr.body,
    );
  }
  return { frs: frs.length, nfrs: nfrs.length };
};
