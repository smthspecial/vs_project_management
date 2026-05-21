"use strict";

/** @param {Function} write @param {Function} fm @returns {number} */
module.exports = function seedSprints(write, fm) {
  write(
    "planning/sprints/spr-001.md",
    fm({
      id: "SPR-001",
      type: "sprint",
      title: "Sprint 1 — Foundation",
      status: "done",
      startDate: "2026-05-01",
      dueDate: "2026-05-14",
      created: "2026-04-28",
    }) +
      `## Goal\n\nEstablish core infrastructure: auth, product listings, and CI/CD pipeline.\n\n` +
      `## Stories\n\n- US-001 User registration\n- US-002 Social login\n- US-005 Product listing creation\n- US-006 Product image upload\n`,
  );

  write(
    "planning/sprints/spr-002.md",
    fm({
      id: "SPR-002",
      type: "sprint",
      title: "Sprint 2 — Core Commerce",
      status: "active",
      startDate: "2026-05-15",
      dueDate: "2026-05-28",
      created: "2026-04-28",
    }) +
      `## Goal\n\nDeliver shopping cart, checkout flow, and seller onboarding.\n\n` +
      `## Stories\n\n- US-003 User profile management\n- US-004 Password reset\n- US-007 Browse by category\n- US-008 Product detail page\n` +
      `- US-009 Add to cart\n- US-010 Edit cart\n- US-016 Seller registration\n- US-017 Seller dashboard\n`,
  );

  write(
    "planning/sprints/spr-003.md",
    fm({
      id: "SPR-003",
      type: "sprint",
      title: "Sprint 3 — Payments & Search",
      status: "planned",
      startDate: "2026-06-01",
      dueDate: "2026-06-14",
      created: "2026-04-28",
    }) +
      `## Goal\n\nIntegrate Stripe/PayPal payments, Elasticsearch search, and order tracking.\n\n` +
      `## Stories\n\n` +
      `- US-011 Guest checkout\n- US-012 Order confirmation email\n- US-013 Card payment\n- US-014 PayPal integration\n` +
      `- US-019 Full-text search\n- US-020 Faceted filtering\n- US-025 Order tracking\n`,
  );

  return 3;
};
