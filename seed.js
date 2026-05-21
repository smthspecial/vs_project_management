#!/usr/bin/env node
const path = require("path");
const { fm, makeWrite } = require("./seed/helpers");
const seedSprints = require("./seed/sprints");
const seedReleases = require("./seed/releases");
const seedEpics = require("./seed/epics");
const seedStories = require("./seed/stories");
const seedTasks = require("./seed/tasks");
const seedRequirements = require("./seed/requirements");
const seedTechnical = require("./seed/technical");
const seedDatabase = require("./seed/database");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const specRoot = path.join(root, ".spec");
const write = makeWrite(specRoot, root);

const sprintCount = seedSprints(write, fm);
const releaseCount = seedReleases(write, fm);
const epicCount = seedEpics(write, fm);
const storyCount = seedStories(write, fm);
const { tasks: taskCount, bugs: bugCount } = seedTasks(write, fm);
const { frs: frCount, nfrs: nfrCount } = seedRequirements(write, fm);
const {
  adrs: adrCount,
  arch: archCount,
  specs: specCount,
} = seedTechnical(write, fm);
const dbCount = seedDatabase(write, fm);

const counts = {
  sprints: sprintCount,
  releases: releaseCount,
  epics: epicCount,
  stories: storyCount,
  tasks: taskCount,
  bugs: bugCount,
  frs: frCount,
  nfrs: nfrCount,
  adrs: adrCount,
  arch: archCount,
  specs: specCount,
  database: dbCount,
};

console.log("\n✓ Seed complete! Created:");
for (const [k, v] of Object.entries(counts)) {
  console.log("  " + v.toString().padStart(3) + "  " + k);
}
console.log("\n  Spec root: " + specRoot + "\n");
