"use strict";

const epics = [
  {
    id: "EPIC-001",
    title: "User Authentication & Profiles",
    status: "active",
    startDate: "2026-05-01",
    dueDate: "2026-05-28",
  },
  {
    id: "EPIC-002",
    title: "Product Catalog & Listings",
    status: "active",
    startDate: "2026-05-01",
    dueDate: "2026-06-14",
  },
  {
    id: "EPIC-003",
    title: "Shopping Cart & Checkout",
    status: "active",
    startDate: "2026-05-15",
    dueDate: "2026-06-14",
  },
  {
    id: "EPIC-004",
    title: "Payment Processing",
    status: "active",
    startDate: "2026-06-01",
    dueDate: "2026-06-30",
  },
  {
    id: "EPIC-005",
    title: "Seller Portal",
    status: "active",
    startDate: "2026-05-15",
    dueDate: "2026-07-14",
  },
  {
    id: "EPIC-006",
    title: "Search & Discovery",
    status: "active",
    startDate: "2026-06-01",
    dueDate: "2026-07-14",
  },
  {
    id: "EPIC-007",
    title: "Reviews & Ratings",
    status: "draft",
    startDate: "2026-07-01",
    dueDate: "2026-07-31",
  },
  {
    id: "EPIC-008",
    title: "Order Management",
    status: "active",
    startDate: "2026-06-01",
    dueDate: "2026-06-30",
  },
];

const epicBodies = {
  "EPIC-001": `## Description\n\nHandle all authentication flows: registration, login, social OAuth, password reset, and user profile CRUD.\n\n## Acceptance Criteria\n\n- [ ] Users can register with email + password\n- [ ] Users can log in via Google and Facebook OAuth\n- [ ] Users can reset forgotten passwords via email link\n- [ ] Users can edit their display name, avatar, and contact info\n\n## Notes\n\nJWT-based sessions with 7-day refresh tokens.\n`,
  "EPIC-002": `## Description\n\nAllow sellers to create and manage product listings, and buyers to browse, filter, and view product details.\n\n## Acceptance Criteria\n\n- [ ] Sellers can create listings with title, description, price, and images\n- [ ] Buyers can browse by category\n- [ ] Product detail page shows images, specs, seller info, and related items\n\n## Notes\n\nImages stored in S3; CDN-served.\n`,
  "EPIC-003": `## Description\n\nFull shopping cart experience from adding items to placing an order, including guest checkout.\n\n## Acceptance Criteria\n\n- [ ] Authenticated users have a persistent cart\n- [ ] Guest users can check out without registering\n- [ ] Order confirmation email sent on successful checkout\n\n## Notes\n\nCart state stored in Redis for 30-day TTL.\n`,
  "EPIC-004": `## Description\n\nSecure payment processing via Stripe and PayPal with refund support.\n\n## Acceptance Criteria\n\n- [ ] Stripe credit/debit card payments work end-to-end\n- [ ] PayPal redirect flow completes successfully\n- [ ] Refunds can be initiated by sellers or admins\n\n## Notes\n\nPCI DSS SAQ-A compliance via hosted payment fields.\n`,
  "EPIC-005": `## Description\n\nSelf-serve seller registration, dashboard, and inventory management tools.\n\n## Acceptance Criteria\n\n- [ ] Sellers complete onboarding with business details and bank account\n- [ ] Dashboard shows revenue, orders, and top products\n- [ ] Sellers can adjust stock levels and pause listings\n\n## Notes\n\nSeller verification via Stripe Connect.\n`,
  "EPIC-006": `## Description\n\nPowered by Elasticsearch: full-text search, faceted filters, and autocomplete.\n\n## Acceptance Criteria\n\n- [ ] Search results appear in < 300 ms\n- [ ] Filters for category, price range, rating, and availability\n- [ ] Autocomplete suggestions after 2 characters typed\n\n## Notes\n\nSearch index updated via async events on product save.\n`,
  "EPIC-007": `## Description\n\nBuyers can leave star ratings and written reviews; moderation queue for admins.\n\n## Acceptance Criteria\n\n- [ ] Only buyers who completed a purchase can review that product\n- [ ] Average rating displayed on product card and detail page\n- [ ] Admins can approve, reject, or flag reviews\n\n## Notes\n\nReviews stored in Postgres; average recalculated on write.\n`,
  "EPIC-008": `## Description\n\nOrder lifecycle management: tracking, cancellation, and returns.\n\n## Acceptance Criteria\n\n- [ ] Buyers can view order status and tracking number\n- [ ] Orders can be cancelled within 1 hour of placement\n- [ ] Return requests trigger a seller notification and refund workflow\n\n## Notes\n\nIntegrate with ShipStation for tracking events.\n`,
};

/** @param {Function} write @param {Function} fm @returns {number} */
module.exports = function seedEpics(write, fm) {
  for (const e of epics) {
    write(
      `backlog/epics/${e.id.toLowerCase()}.md`,
      fm({
        id: e.id,
        type: "epic",
        title: e.title,
        status: e.status,
        startDate: e.startDate,
        dueDate: e.dueDate,
        created: "2026-05-01",
      }) +
        (epicBodies[e.id] ||
          `## Description\n\n${e.title}\n\n## Acceptance Criteria\n\n- [ ] \n\n## Notes\n\n`),
    );
  }
  return epics.length;
};
