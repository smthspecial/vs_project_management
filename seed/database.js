"use strict";

const dbTables = [
  {
    id: "TBL-001",
    title: "users",
    relations: "",
    body:
      `## Business Purpose\n\nCentral identity table for all platform users — buyers, sellers, and admins.\n\n` +
      `## Columns\n\n` +
      `| Name | Type | Constraints |\n` +
      `|------|------|-------------|\n` +
      `| id | uuid | PK NOT NULL |\n` +
      `| email | varchar(255) | UNIQUE NOT NULL |\n` +
      `| password_hash | varchar(60) | NULLABLE |\n` +
      `| display_name | varchar(100) | NOT NULL |\n` +
      `| avatar_s3_key | varchar(500) | NULLABLE |\n` +
      `| status | varchar(20) | NOT NULL DEFAULT pending |\n` +
      `| provider | varchar(20) | NULLABLE |\n` +
      `| provider_id | varchar(255) | NULLABLE |\n` +
      `| created_at | timestamptz | NOT NULL DEFAULT now() |\n` +
      `| updated_at | timestamptz | NOT NULL DEFAULT now() |\n`,
  },
  {
    id: "TBL-002",
    title: "sellers",
    relations: "user_id:TBL-001",
    body:
      `## Business Purpose\n\nSeller profile linked to a user account, required for publishing products.\n\n` +
      `## Columns\n\n` +
      `| Name | Type | Constraints |\n` +
      `|------|------|-------------|\n` +
      `| id | uuid | PK NOT NULL |\n` +
      `| user_id | uuid | FK UNIQUE NOT NULL |\n` +
      `| business_name | varchar(200) | NOT NULL |\n` +
      `| stripe_account_id | varchar(100) | NULLABLE |\n` +
      `| status | varchar(20) | NOT NULL DEFAULT pending |\n` +
      `| created_at | timestamptz | NOT NULL DEFAULT now() |\n`,
  },
  {
    id: "TBL-003",
    title: "categories",
    relations: "parent_id:TBL-003",
    body:
      `## Business Purpose\n\nSelf-referencing product category tree (root categories have null parent).\n\n` +
      `## Columns\n\n` +
      `| Name | Type | Constraints |\n` +
      `|------|------|-------------|\n` +
      `| id | uuid | PK NOT NULL |\n` +
      `| parent_id | uuid | FK NULLABLE |\n` +
      `| name | varchar(100) | NOT NULL |\n` +
      `| slug | varchar(100) | UNIQUE NOT NULL |\n` +
      `| created_at | timestamptz | NOT NULL DEFAULT now() |\n`,
  },
  {
    id: "TBL-004",
    title: "products",
    relations: "seller_id:TBL-002,category_id:TBL-003",
    body:
      `## Business Purpose\n\nProduct listings published by sellers, browsable and searchable by buyers.\n\n` +
      `## Columns\n\n` +
      `| Name | Type | Constraints |\n` +
      `|------|------|-------------|\n` +
      `| id | uuid | PK NOT NULL |\n` +
      `| seller_id | uuid | FK NOT NULL |\n` +
      `| category_id | uuid | FK NOT NULL |\n` +
      `| title | varchar(255) | NOT NULL |\n` +
      `| description | text | NULLABLE |\n` +
      `| price | numeric(12,2) | NOT NULL |\n` +
      `| stock_qty | int | NOT NULL DEFAULT 0 |\n` +
      `| status | varchar(20) | NOT NULL DEFAULT draft |\n` +
      `| average_rating | float | NULLABLE |\n` +
      `| created_at | timestamptz | NOT NULL DEFAULT now() |\n` +
      `| updated_at | timestamptz | NOT NULL DEFAULT now() |\n`,
  },
  {
    id: "TBL-005",
    title: "product_images",
    relations: "product_id:TBL-004",
    body:
      `## Business Purpose\n\nS3-backed image assets belonging to a product listing.\n\n` +
      `## Columns\n\n` +
      `| Name | Type | Constraints |\n` +
      `|------|------|-------------|\n` +
      `| id | uuid | PK NOT NULL |\n` +
      `| product_id | uuid | FK NOT NULL |\n` +
      `| s3_key | varchar(500) | NOT NULL |\n` +
      `| position | int | NOT NULL DEFAULT 0 |\n` +
      `| created_at | timestamptz | NOT NULL DEFAULT now() |\n`,
  },
  {
    id: "TBL-006",
    title: "carts",
    relations: "user_id:TBL-001",
    body:
      `## Business Purpose\n\nPersistent shopping cart for authenticated users (30-day TTL enforced in Redis).\n\n` +
      `## Columns\n\n` +
      `| Name | Type | Constraints |\n` +
      `|------|------|-------------|\n` +
      `| id | uuid | PK NOT NULL |\n` +
      `| user_id | uuid | FK UNIQUE NOT NULL |\n` +
      `| created_at | timestamptz | NOT NULL DEFAULT now() |\n` +
      `| updated_at | timestamptz | NOT NULL DEFAULT now() |\n`,
  },
  {
    id: "TBL-007",
    title: "cart_items",
    relations: "cart_id:TBL-006,product_id:TBL-004",
    body:
      `## Business Purpose\n\nLine items inside a shopping cart — one row per product in the cart.\n\n` +
      `## Columns\n\n` +
      `| Name | Type | Constraints |\n` +
      `|------|------|-------------|\n` +
      `| id | uuid | PK NOT NULL |\n` +
      `| cart_id | uuid | FK NOT NULL |\n` +
      `| product_id | uuid | FK NOT NULL |\n` +
      `| quantity | int | NOT NULL DEFAULT 1 |\n` +
      `| added_at | timestamptz | NOT NULL DEFAULT now() |\n`,
  },
  {
    id: "TBL-008",
    title: "orders",
    relations: "buyer_id:TBL-001",
    body:
      `## Business Purpose\n\nConfirmed purchase intent capturing buyer, shipping info, and totals at checkout time.\n\n` +
      `## Columns\n\n` +
      `| Name | Type | Constraints |\n` +
      `|------|------|-------------|\n` +
      `| id | uuid | PK NOT NULL |\n` +
      `| buyer_id | uuid | FK NOT NULL |\n` +
      `| status | varchar(20) | NOT NULL DEFAULT pending |\n` +
      `| total_amount | numeric(12,2) | NOT NULL |\n` +
      `| shipping_address | jsonb | NOT NULL |\n` +
      `| created_at | timestamptz | NOT NULL DEFAULT now() |\n` +
      `| updated_at | timestamptz | NOT NULL DEFAULT now() |\n`,
  },
  {
    id: "TBL-009",
    title: "order_items",
    relations: "order_id:TBL-008,product_id:TBL-004,seller_id:TBL-002",
    body:
      `## Business Purpose\n\nProduct lines within an order; price locked at purchase time.\n\n` +
      `## Columns\n\n` +
      `| Name | Type | Constraints |\n` +
      `|------|------|-------------|\n` +
      `| id | uuid | PK NOT NULL |\n` +
      `| order_id | uuid | FK NOT NULL |\n` +
      `| product_id | uuid | FK NOT NULL |\n` +
      `| seller_id | uuid | FK NOT NULL |\n` +
      `| quantity | int | NOT NULL |\n` +
      `| unit_price | numeric(12,2) | NOT NULL |\n` +
      `| created_at | timestamptz | NOT NULL DEFAULT now() |\n`,
  },
  {
    id: "TBL-010",
    title: "payments",
    relations: "order_id:TBL-008",
    body:
      `## Business Purpose\n\nPayment transactions tied to an order; supports Stripe and PayPal.\n\n` +
      `## Columns\n\n` +
      `| Name | Type | Constraints |\n` +
      `|------|------|-------------|\n` +
      `| id | uuid | PK NOT NULL |\n` +
      `| order_id | uuid | FK NOT NULL |\n` +
      `| provider | varchar(20) | NOT NULL |\n` +
      `| provider_payment_id | varchar(255) | NOT NULL |\n` +
      `| amount | numeric(12,2) | NOT NULL |\n` +
      `| currency | char(3) | NOT NULL DEFAULT USD |\n` +
      `| status | varchar(20) | NOT NULL |\n` +
      `| created_at | timestamptz | NOT NULL DEFAULT now() |\n`,
  },
  {
    id: "TBL-011",
    title: "payment_events",
    relations: "payment_id:TBL-010",
    body:
      `## Business Purpose\n\nImmutable audit log of every payment lifecycle event for reconciliation and disputes.\n\n` +
      `## Columns\n\n` +
      `| Name | Type | Constraints |\n` +
      `|------|------|-------------|\n` +
      `| id | uuid | PK NOT NULL |\n` +
      `| payment_id | uuid | FK NOT NULL |\n` +
      `| event_type | varchar(100) | NOT NULL |\n` +
      `| payload | jsonb | NOT NULL |\n` +
      `| received_at | timestamptz | NOT NULL DEFAULT now() |\n`,
  },
  {
    id: "TBL-012",
    title: "reviews",
    relations: "product_id:TBL-004,buyer_id:TBL-001",
    body:
      `## Business Purpose\n\nVerified buyer reviews and star ratings; one review per buyer per product after delivery.\n\n` +
      `## Columns\n\n` +
      `| Name | Type | Constraints |\n` +
      `|------|------|-------------|\n` +
      `| id | uuid | PK NOT NULL |\n` +
      `| product_id | uuid | FK NOT NULL |\n` +
      `| buyer_id | uuid | FK NOT NULL |\n` +
      `| rating | int | NOT NULL CHECK 1-5 |\n` +
      `| title | varchar(80) | NULLABLE |\n` +
      `| body | text | NULLABLE |\n` +
      `| status | varchar(20) | NOT NULL DEFAULT pending |\n` +
      `| created_at | timestamptz | NOT NULL DEFAULT now() |\n`,
  },
  {
    id: "TBL-013",
    title: "return_requests",
    relations: "order_id:TBL-008,buyer_id:TBL-001",
    body:
      `## Business Purpose\n\nBuyer return requests triggering seller notification and refund workflow within 30 days.\n\n` +
      `## Columns\n\n` +
      `| Name | Type | Constraints |\n` +
      `|------|------|-------------|\n` +
      `| id | uuid | PK NOT NULL |\n` +
      `| order_id | uuid | FK NOT NULL |\n` +
      `| buyer_id | uuid | FK NOT NULL |\n` +
      `| reason | varchar(50) | NOT NULL |\n` +
      `| notes | text | NULLABLE |\n` +
      `| status | varchar(20) | NOT NULL DEFAULT pending |\n` +
      `| return_label_s3_key | varchar(500) | NULLABLE |\n` +
      `| created_at | timestamptz | NOT NULL DEFAULT now() |\n` +
      `| resolved_at | timestamptz | NULLABLE |\n`,
  },
];

/** @param {Function} write @param {Function} fm @returns {number} */
module.exports = function seedDatabase(write, fm) {
  for (const tbl of dbTables) {
    write(
      `technical/database/${tbl.id.toLowerCase()}.md`,
      fm({
        id: tbl.id,
        type: "db-table",
        title: tbl.title,
        status: "active",
        relations: tbl.relations || undefined,
        created: "2026-05-01",
      }) + tbl.body,
    );
  }
  return dbTables.length;
};
