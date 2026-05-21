"use strict";

/** @param {Function} write @param {Function} fm @returns {number} */
module.exports = function seedReleases(write, fm) {
  write(
    "planning/releases/rel-001.md",
    fm({
      id: "REL-001",
      type: "release",
      title: "v1.0.0 — MVP Launch",
      status: "active",
      releaseDate: "2026-06-30",
      created: "2026-04-28",
    }) +
      `## Overview\n\nFirst public release of the marketplace platform with core buyer and seller workflows.\n\n` +
      `## What's Included\n\n- User authentication & profiles\n- Product catalog & listings\n- Shopping cart & checkout\n` +
      `- Payment processing (Stripe + PayPal)\n- Order management & tracking\n- Basic search\n\n` +
      `## Release Notes\n\n- Initial public release\n- Supports 10 000 concurrent users\n- PCI DSS compliant payment flow\n`,
  );

  write(
    "planning/releases/rel-002.md",
    fm({
      id: "REL-002",
      type: "release",
      title: "v1.1.0 — Seller & Discovery",
      status: "draft",
      releaseDate: "2026-07-31",
      created: "2026-04-28",
    }) +
      `## Overview\n\nEnhanced seller tools, faceted search, reviews & ratings, and return/refund workflows.\n\n` +
      `## What's Included\n\n- Seller portal with inventory management\n- Advanced search with filters & autocomplete\n` +
      `- Product reviews & star ratings\n- Review moderation tools\n- Return & refund flow\n\n` +
      `## Release Notes\n\n- TBD\n`,
  );

  return 2;
};
