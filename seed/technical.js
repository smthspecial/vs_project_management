"use strict";

const adrs = [
  {
    id: "ADR-001",
    status: "accepted",
    title: "Use PostgreSQL as the primary relational database",
    body: `## Context\n\nWe need a reliable, ACID-compliant relational database for user, order, and product data. The team has strong PostgreSQL expertise.\n\n## Decision\n\nAdopt PostgreSQL 16 hosted on AWS RDS Multi-AZ.\n\n## Consequences\n\n### Positive\n\n- Strong consistency guarantees\n- Rich JSON support for semi-structured data\n- Excellent ecosystem (Prisma, pg, Flyway)\n\n### Negative\n\n- Vertical scaling ceiling; may need Citus for sharding at scale\n- Higher cost than MySQL for equivalent RDS instance\n\n## Alternatives Considered\n\n- MySQL — rejected due to weaker JSON support\n- MongoDB — rejected due to lack of ACID transactions across documents\n- CockroachDB — rejected due to team unfamiliarity\n`,
  },
  {
    id: "ADR-002",
    status: "accepted",
    title: "Adopt a modular monolith architecture for v1.0",
    body: `## Context\n\nMicroservices add operational complexity that is hard to justify for an MVP team of 6 engineers. We want domain boundaries without distributed system overhead.\n\n## Decision\n\nBuild a modular monolith with clear domain modules (auth, catalog, orders, payments, search). Modules communicate via in-process interfaces. Extract to services only when a domain hits scaling or deployment friction.\n\n## Consequences\n\n### Positive\n\n- Simple local development and deployment\n- Easy refactoring across module boundaries\n- No distributed tracing required in v1\n\n### Negative\n\n- Single deployment unit; scaling requires horizontal scaling of the whole app\n- Discipline required to maintain module boundaries\n\n## Alternatives Considered\n\n- Microservices from day 1 — rejected (too much operational overhead for MVP)\n- Serverless — rejected (cold starts unacceptable for real-time search)\n`,
  },
  {
    id: "ADR-003",
    status: "accepted",
    title: "Use Redis for session management and cart persistence",
    body: `## Context\n\nHTTP sessions and shopping carts need fast read/write access and automatic TTL-based expiry. A relational database adds unnecessary latency.\n\n## Decision\n\nUse Redis 7 (AWS ElastiCache) for: JWT refresh token tracking (single-use), shopping cart storage (30-day TTL), and category cache (10-min TTL).\n\n## Consequences\n\n### Positive\n\n- Sub-millisecond read latency\n- Native TTL support\n- Pub/Sub available for future real-time features\n\n### Negative\n\n- Additional infrastructure to manage\n- Data loss on Redis failure without RDB/AOF backups\n\n## Alternatives Considered\n\n- DynamoDB — rejected due to higher per-request cost at low volume\n- Database sessions — rejected due to query overhead\n`,
  },
  {
    id: "ADR-004",
    status: "accepted",
    title: "Use Elasticsearch for product search and autocomplete",
    body: `## Context\n\nPostgreSQL full-text search (tsvector) cannot provide the relevance ranking, fuzzy matching, faceted aggregations, and sub-300 ms performance we need at scale.\n\n## Decision\n\nUse AWS OpenSearch Service (Elasticsearch 8-compatible) with a dedicated product index. Product documents synced via Debezium CDC pipeline from Postgres.\n\n## Consequences\n\n### Positive\n\n- BM25 relevance ranking with customisable boosting\n- Faceted aggregations in a single query\n- Edge-ngram tokenizer for autocomplete\n\n### Negative\n\n- Index lag of ~5 seconds under normal load\n- Additional operational complexity and cost\n- Requires careful mapping design upfront\n\n## Alternatives Considered\n\n- Algolia — rejected due to cost at high query volume\n- Typesense — considered but team has no production experience\n- Postgres FTS — rejected (no faceting, insufficient performance)\n`,
  },
  {
    id: "ADR-005",
    status: "proposed",
    title: "Use Stripe Connect for seller payouts",
    body: `## Context\n\nSellers need to receive payouts for their sales. Managing bank transfers directly would require significant compliance work (money transmitter licences).\n\n## Decision\n\nEvaluating Stripe Connect Express accounts to handle seller KYC, bank account collection, and payouts. Platform takes a fee as a Stripe application fee.\n\n## Consequences\n\n### Positive\n\n- Stripe handles KYC and compliance\n- Instant and scheduled payout options\n- Dashboard for sellers via Stripe-hosted UI\n\n### Negative\n\n- Vendor lock-in\n- Stripe Connect fees on top of transaction fees\n\n## Alternatives Considered\n\n- Adyen Marketplaces — richer features but higher integration complexity\n- Manual bank transfers — rejected due to compliance requirements\n`,
  },
];

/** @param {Function} write @param {Function} fm @returns {{ adrs: number, arch: number, specs: number }} */
module.exports = function seedTechnical(write, fm) {
  // ADRs
  for (const adr of adrs) {
    write(
      `technical/adr/${adr.id.toLowerCase()}.md`,
      fm({
        id: adr.id,
        type: "adr",
        title: adr.title,
        status: adr.status,
        created: "2026-05-01",
      }) + adr.body,
    );
  }

  // Architecture docs
  write(
    "technical/architecture/arch-001.md",
    fm({
      id: "ARCH-001",
      type: "arch",
      title: "System Architecture Overview",
      status: "active",
      created: "2026-05-01",
    }) +
      `## Overview\n\nThe marketplace is a modular monolith deployed on AWS, backed by PostgreSQL, Redis, and Elasticsearch. A React SPA communicates with a Node.js/Express API layer.\n\n## Diagram\n\n\`\`\`\n┌─────────────────────────────────────────────────────────┐\n│                     CloudFront CDN                      │\n└──────────────┬─────────────────────────────┬────────────┘\n               │ SPA (S3)                    │ API\n               ▼                             ▼\n        React Frontend          ┌────────────────────────┐\n        (Next.js / SSR)         │   Node.js API (ECS)    │\n                                │  ┌──────┐ ┌─────────┐  │\n                                │  │ Auth │ │ Catalog │  │\n                                │  └──────┘ └─────────┘  │\n                                │  ┌───────┐ ┌────────┐  │\n                                │  │ Orders│ │Payments│  │\n                                │  └───────┘ └────────┘  │\n                                └────────────────────────┘\n                                  │          │         │\n                              Postgres    Redis   OpenSearch\n                             (RDS MAZ)  (ElastiCache)  (AWS)\n\`\`\`\n\n## Components\n\n- **CloudFront** — CDN for static assets and API caching\n- **Next.js** — SSR for SEO-critical pages (product detail, category)\n- **API (ECS Fargate)** — Modular monolith; 2–10 replicas via auto-scaling\n- **PostgreSQL (RDS)** — Primary data store; Multi-AZ with read replica\n- **Redis (ElastiCache)** — Sessions, cart, category cache\n- **OpenSearch** — Product search and autocomplete\n- **S3 + Lambda** — Image storage and on-upload resizing\n- **SQS** — Async event queue (order events, email dispatch)\n\n## Interfaces\n\n- REST API: \`/api/v1/…\` — primary client-server interface\n- WebSocket: \`/ws\` — real-time order status updates\n- Webhooks: Stripe, PayPal, ShipStation inbound events\n`,
  );

  write(
    "technical/architecture/arch-002.md",
    fm({
      id: "ARCH-002",
      type: "arch",
      title: "Database Schema Design",
      status: "active",
      created: "2026-05-01",
    }) +
      `## Overview\n\nCore PostgreSQL schema for the marketplace, covering users, products, orders, and payments.\n\n## Diagram\n\n\`\`\`\nusers\n  id, email, password_hash, status, provider, provider_id\n  created_at, updated_at\n\nsellers  (extends users)\n  id, user_id FK, business_name, stripe_account_id, status\n\nproducts\n  id, seller_id FK, title, description, price, stock, status\n  category_id FK, created_at, updated_at\n\nproduct_images\n  id, product_id FK, s3_key, sort_order, blur_hash\n\ncategories\n  id, parent_id FK, name, slug, level\n\ncarts\n  id, user_id FK (nullable), session_id, updated_at\n\ncart_items\n  id, cart_id FK, product_id FK, quantity\n\norders\n  id, buyer_id FK, status, total_amount, created_at\n\norder_items\n  id, order_id FK, product_id FK, quantity, unit_price\n\npayments\n  id, order_id FK, provider, provider_payment_id, amount, status\n\nreviews\n  id, product_id FK, buyer_id FK, rating, title, body, status\n\`\`\`\n\n## Components\n\n- All tables use UUID primary keys\n- Soft deletes via \`status: archived\` columns\n- Audit timestamps on all mutable tables\n\n## Interfaces\n\n- Accessed via Prisma ORM\n- Migrations managed with Flyway\n`,
  );

  // Tech specs
  write(
    "technical/specs/spec-001.md",
    fm({
      id: "SPEC-001",
      type: "tech-spec",
      title: "Authentication Service",
      status: "active",
      created: "2026-05-01",
    }) +
      `## Overview\n\nHandles user registration, login (email/password + OAuth2), session management, and password reset. Implemented as the \`auth\` module within the monolith.\n\n## API / Interface\n\n\`\`\`\nPOST   /api/v1/auth/register          { email, password }\nPOST   /api/v1/auth/login             { email, password }\nPOST   /api/v1/auth/logout            (Bearer token)\nGET    /api/v1/auth/verify-email      ?token=…\nPOST   /api/v1/auth/forgot-password   { email }\nPOST   /api/v1/auth/reset-password    { token, password }\nGET    /api/v1/auth/me                (Bearer token)\nGET    /api/v1/auth/google            → OAuth2 redirect\nGET    /api/v1/auth/google/callback\nGET    /api/v1/auth/facebook\nGET    /api/v1/auth/facebook/callback\n\`\`\`\n\n## Data Model\n\n- \`users\`: id, email, password_hash, status (pending|active|suspended)\n- \`refresh_tokens\`: jti, user_id, expires_at (stored in Redis)\n- \`password_reset_tokens\`: stored as HMAC-SHA256 hash in Postgres\n\n## Dependencies\n\n- bcrypt (password hashing)\n- jsonwebtoken (JWT access/refresh tokens)\n- passport-google-oauth20, passport-facebook\n- nodemailer + SendGrid (email delivery)\n- Redis (refresh token store)\n\n## Error Handling\n\n- 400 Validation error (zod schema)\n- 401 Invalid credentials\n- 403 Account not verified\n- 409 Email already registered\n- 429 Rate limit exceeded (10 req/min per IP)\n`,
  );

  write(
    "technical/specs/spec-002.md",
    fm({
      id: "SPEC-002",
      type: "tech-spec",
      title: "Payment Service",
      status: "active",
      created: "2026-05-01",
    }) +
      `## Overview\n\nHandles payment authorisation, capture, and refunds via Stripe and PayPal. Processes inbound webhooks and records all events in an immutable audit log.\n\n## API / Interface\n\n\`\`\`\nPOST   /api/v1/payments/intent        { orderId } → { clientSecret }\nPOST   /api/v1/payments/paypal/create  { orderId } → { approvalUrl }\nPOST   /api/v1/payments/paypal/capture { token, PayerID }\nPOST   /api/v1/payments/refund        { paymentId, amount? }\nPOST   /api/v1/webhooks/stripe        (Stripe-Signature header)\nPOST   /api/v1/webhooks/paypal        (PayPal webhook)\n\`\`\`\n\n## Data Model\n\n- \`payments\`: id, order_id, provider (stripe|paypal), provider_payment_id, amount, currency, status, created_at\n- \`payment_events\`: id, payment_id, event_type, payload (JSONB), received_at\n\n## Dependencies\n\n- stripe (Node.js SDK v14)\n- @paypal/checkout-server-sdk\n- SQS (async order status updates post-payment)\n\n## Error Handling\n\n- 402 Payment required / declined — actionable message returned to client\n- 422 Invalid payment state (e.g. refund on non-captured payment)\n- Webhook signature verification failure → 400 (logged, not retried)\n- Idempotency keys on all Stripe API calls to handle retries\n`,
  );

  write(
    "technical/specs/spec-003.md",
    fm({
      id: "SPEC-003",
      type: "tech-spec",
      title: "Search Service (Elasticsearch)",
      status: "draft",
      created: "2026-05-01",
    }) +
      `## Overview\n\nProvides full-text search, faceted filtering, and autocomplete for products. Backed by AWS OpenSearch Service. The product index is populated via Debezium CDC from Postgres.\n\n## API / Interface\n\n\`\`\`\nGET    /api/v1/search?q=…&category=…&minPrice=…&maxPrice=…&rating=…&page=…\nGET    /api/v1/search/autocomplete?q=…  → [{ label, type }]\nPOST   /api/v1/admin/search/reindex    (admin only)\n\`\`\`\n\n## Data Model\n\n\`\`\`json\n// Product index mapping (simplified)\n{\n  "id": "keyword",\n  "title": "text (english analyser)",\n  "description": "text (english analyser)",\n  "category_path": "keyword",\n  "price": "scaled_float",\n  "average_rating": "float",\n  "in_stock": "boolean",\n  "seller_rating": "float",\n  "created_at": "date"\n}\n\`\`\`\n\n## Dependencies\n\n- @elastic/elasticsearch Node.js client\n- Debezium (Postgres CDC → Kafka → OpenSearch connector)\n- Kafka (AWS MSK)\n\n## Error Handling\n\n- Search errors return empty result set with error flag (never 500 to client)\n- Circuit breaker: fall back to Postgres FTS if OpenSearch latency > 1 s\n- Index lag alerted via CloudWatch if > 30 seconds\n`,
  );

  return { adrs: adrs.length, arch: 2, specs: 3 };
};
