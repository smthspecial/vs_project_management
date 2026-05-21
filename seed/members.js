"use strict";

const members = [
  { id: "MBR-001", title: "Alice Johnson", role: "frontend", status: "active" },
  { id: "MBR-002", title: "Bob Smith", role: "backend", status: "active" },
  { id: "MBR-003", title: "Carol White", role: "fullstack", status: "active" },
  { id: "MBR-004", title: "David Lee", role: "qa", status: "active" },
  { id: "MBR-005", title: "Eva Martinez", role: "devops", status: "active" },
];

/** @param {Function} write @param {Function} fm @returns {number} */
module.exports = function seedMembers(write, fm) {
  for (const m of members) {
    write(
      `team/members/${m.id.toLowerCase()}.md`,
      fm({
        id: m.id,
        type: "member",
        title: m.title,
        status: m.status,
        role: m.role,
        created: "2026-05-01",
      }) + `## Bio\n\n${m.title} — ${m.role} engineer.\n`,
    );
  }
  return members.length;
};
