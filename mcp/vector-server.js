#!/usr/bin/env node
"use strict";

/**
 * Project Spec — Vector Search MCP Server
 *
 * Semantic search over .spec/ files using local embeddings via Ollama.
 * Each panel has its own index file — no combined file.
 * Search without a panel merges all available panel files at query time.
 *
 *   .spec/.vector-index/
 *     requirements.json   fr, nfr
 *     backlog.json        epic, story, task, bug
 *     sprints.json        sprint, release
 *     technical.json      adr, arch, service, data-proc, cicd, auth-spec
 *     database.json       db-table
 *     team.json           member
 *     concept.json        concept
 *     *.meta.json         metadata per index
 *     .gitignore          auto-created; excludes this directory from git
 *
 * Tools: semantic_search · reindex_vector_store · get_vector_status
 *
 * MCP server:            node mcp/vector-server.js
 * Reindex one panel:     node mcp/vector-server.js --reindex --panel=backlog
 * Reindex all (global):  node mcp/vector-server.js --reindex
 *
 * Env vars:
 *   OLLAMA_URL         (default: http://localhost:11434)
 *   OLLAMA_EMBED_MODEL (default: nomic-embed-text)
 */

const readline = require("readline");
const fs = require("fs");
const path = require("path");

const workspaceRoot = process.cwd();
const INDEX_DIR = path.join(workspaceRoot, ".spec", ".vector-index");

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

// ---------------------------------------------------------------------------
// Panel definitions — mirror the VS Code sidebar panels
// ---------------------------------------------------------------------------

const PANELS = {
  requirements: { types: ["fr", "nfr"], label: "Requirements" },
  backlog: { types: ["epic", "story", "task", "bug"], label: "Backlog" },
  sprints: { types: ["sprint", "release"], label: "Sprints & Releases" },
  technical: {
    types: ["adr", "arch", "service", "data-proc", "cicd", "auth-spec"],
    label: "Technical",
  },
  database: { types: ["db-table"], label: "Database" },
  team: { types: ["member"], label: "Team" },
  concept: { types: ["concept"], label: "Concept" },
};

const ALL_PANEL_NAMES = Object.keys(PANELS);

function indexFileFor(panel) {
  return path.join(INDEX_DIR, `${panel}.json`);
}

function metaFileFor(panel) {
  return path.join(INDEX_DIR, `${panel}.meta.json`);
}

// ---------------------------------------------------------------------------
// Embedding via Ollama
// ---------------------------------------------------------------------------

async function getEmbedding(text) {
  const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });
  if (!response.ok) {
    throw new Error(
      `Ollama /api/embeddings failed: ${response.status} ${response.statusText}\n` +
        `Make sure Ollama is running and '${EMBED_MODEL}' is pulled:\n` +
        `  ollama pull ${EMBED_MODEL}`,
    );
  }
  const data = await response.json();
  if (!Array.isArray(data.embedding)) {
    throw new Error(
      `Ollama returned unexpected response: ${JSON.stringify(data)}`,
    );
  }
  return data.embedding;
}

// ---------------------------------------------------------------------------
// Spec file parsing
// ---------------------------------------------------------------------------

function parseFrontMatter(content) {
  const match = content.match(
    /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/,
  );
  if (!match) return { data: {}, body: content };

  const yamlBlock = match[1];
  const body = match[2] ?? "";
  const raw = {};

  for (const line of yamlBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx <= 0) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed
      .slice(colonIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    raw[key] = value;
  }

  return {
    data: {
      id: raw["id"],
      type: raw["type"],
      title: raw["title"],
      status: raw["status"] ?? "draft",
      created: raw["created"],
      epicId: raw["epicId"],
      storyId: raw["storyId"],
      linkedIds: raw["linkedIds"],
      dependsOn: raw["dependsOn"],
      sprintId: raw["sprintId"],
      releaseId: raw["releaseId"],
      startDate: raw["startDate"],
      dueDate: raw["dueDate"],
      priority: raw["priority"],
      assigneeId: raw["assigneeId"],
      role: raw["role"],
      processType: raw["processType"],
    },
    body,
  };
}

const SPEC_SUBDIRS = [
  "requirements/fr",
  "requirements/nfr",
  "backlog/epics",
  "backlog/stories",
  "backlog/tasks",
  "planning/sprints",
  "planning/releases",
  "technical/adr",
  "technical",
  "technical/data-processes",
  "technical/services",
  "technical/database",
  "technical/cicd",
  "technical/auth",
  "team/members",
  "concept/history",
  "concept/goals",
  "concept/principles",
  "concept/risks",
  "concept/sysdesign",
  "concept/sysimpl",
];

function readSpecFiles(typeFilter) {
  const specDir = path.join(workspaceRoot, ".spec");
  if (!fs.existsSync(specDir)) return [];

  const files = [];
  const seen = new Set();

  for (const subdir of SPEC_SUBDIRS) {
    const dirPath = path.join(specDir, subdir);
    if (!fs.existsSync(dirPath)) continue;
    for (const file of fs.readdirSync(dirPath)) {
      if (!file.endsWith(".md")) continue;
      const filePath = path.join(dirPath, file);
      if (seen.has(filePath)) continue;
      seen.add(filePath);
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const { data, body } = parseFrontMatter(content);
        if (!data.id || !data.type || !data.title) continue;
        if (typeFilter && !typeFilter.includes(data.type)) continue;
        files.push({ filePath, data, body });
      } catch {
        // skip unreadable files
      }
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Chunking
//
// Per spec file:
//   1. Meta chunk    — all front-matter fields as a single searchable string
//   2. Section chunks — body split on "## Heading" boundaries; large sections
//                       (> 800 chars) are further split by paragraph
//   3. Paragraph fallback — used when body has no ## headings
//
// Every chunk is prefixed "[ID: Title]" so context is always retrievable.
// ---------------------------------------------------------------------------

function buildMetaText(data) {
  const parts = [
    `[${(data.type || "").toUpperCase()} ${data.id}] ${data.title}`,
    `type: ${data.type}`,
    `status: ${data.status}`,
  ];
  if (data.priority) parts.push(`priority: ${data.priority}`);
  if (data.epicId) parts.push(`epic: ${data.epicId}`);
  if (data.storyId) parts.push(`story: ${data.storyId}`);
  if (data.sprintId) parts.push(`sprint: ${data.sprintId}`);
  if (data.releaseId) parts.push(`release: ${data.releaseId}`);
  if (data.assigneeId) parts.push(`assignee: ${data.assigneeId}`);
  if (data.role) parts.push(`role: ${data.role}`);
  if (data.processType) parts.push(`processType: ${data.processType}`);
  if (data.linkedIds) parts.push(`linked: ${data.linkedIds}`);
  if (data.dependsOn) parts.push(`dependsOn: ${data.dependsOn}`);
  if (data.startDate) parts.push(`start: ${data.startDate}`);
  if (data.dueDate) parts.push(`due: ${data.dueDate}`);
  return parts.join(" | ");
}

function splitBySections(body) {
  const parts = body.split(/^(?=##[ \t])/m);
  const sections = [];
  for (const part of parts) {
    const headingMatch = part.match(/^##[ \t]+(.+)$/m);
    const text = headingMatch
      ? part.slice(part.indexOf("\n") + 1).trim()
      : part.trim();
    const heading = headingMatch ? headingMatch[1].trim() : null;
    if (text.length >= 20) sections.push({ heading, text });
  }
  return sections;
}

function groupParagraphs(text, maxLen = 800) {
  const groups = [];
  let current = "";
  for (const para of text.split(/\n\n+/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    if (current && current.length + trimmed.length + 2 > maxLen) {
      groups.push(current);
      current = trimmed;
    } else {
      current = current ? `${current}\n\n${trimmed}` : trimmed;
    }
  }
  if (current.trim().length >= 20) groups.push(current.trim());
  return groups;
}

function chunkSpecFile({ data, body }) {
  const prefix = `[${data.id}: ${data.title}]`;
  const chunks = [];

  // 1. Meta chunk — always present
  chunks.push({
    chunkId: `${data.id}#meta`,
    specId: data.id,
    type: data.type,
    title: data.title,
    status: data.status,
    chunkType: "meta",
    sectionName: null,
    text: buildMetaText(data),
  });

  if (!body.trim()) return chunks;

  const sections = splitBySections(body);

  if (sections.length > 0) {
    // 2. Section chunks
    sections.forEach(({ heading, text }, si) => {
      const subchunks = text.length > 800 ? groupParagraphs(text) : [text];
      subchunks.forEach((sub, pi) => {
        if (sub.length < 20) return;
        const headingLabel = heading ? `## ${heading}\n\n` : "";
        chunks.push({
          chunkId: `${data.id}#s${si}p${pi}`,
          specId: data.id,
          type: data.type,
          title: data.title,
          status: data.status,
          chunkType: "section",
          sectionName: heading,
          text: `${prefix} ${headingLabel}${sub}`,
        });
      });
    });
  } else {
    // 3. Paragraph fallback
    groupParagraphs(body).forEach((para, i) => {
      if (para.length < 20) return;
      chunks.push({
        chunkId: `${data.id}#p${i}`,
        specId: data.id,
        type: data.type,
        title: data.title,
        status: data.status,
        chunkType: "paragraph",
        sectionName: null,
        text: `${prefix} ${para}`,
      });
    });
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Index persistence
// ---------------------------------------------------------------------------

function ensureIndexDir() {
  if (!fs.existsSync(INDEX_DIR)) {
    fs.mkdirSync(INDEX_DIR, { recursive: true });
  }
  const gi = path.join(INDEX_DIR, ".gitignore");
  if (!fs.existsSync(gi)) {
    fs.writeFileSync(gi, "*\n", "utf-8");
  }
}

function loadIndex(panel) {
  const file = indexFileFor(panel);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function loadMeta(panel) {
  const file = metaFileFor(panel);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function saveIndex(panel, chunks) {
  ensureIndexDir();
  fs.writeFileSync(indexFileFor(panel), JSON.stringify(chunks), "utf-8");
  const meta = {
    panel,
    lastIndexed: new Date().toISOString(),
    fileCount: new Set(chunks.map((c) => c.specId)).size,
    chunkCount: chunks.length,
    model: EMBED_MODEL,
  };
  fs.writeFileSync(metaFileFor(panel), JSON.stringify(meta, null, 2), "utf-8");
  return meta;
}

// ---------------------------------------------------------------------------
// Cosine similarity search
// ---------------------------------------------------------------------------

function cosineSimilarity(a, b) {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function searchChunks(chunks, queryEmbedding, limit, typeFilter) {
  let candidates = chunks;
  if (typeFilter) {
    const types = typeFilter.split(",").map((t) => t.trim());
    candidates = candidates.filter((c) => types.includes(c.type));
  }
  return candidates
    .map((chunk) => ({
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
      specId: chunk.specId,
      type: chunk.type,
      title: chunk.title,
      status: chunk.status,
      chunkType: chunk.chunkType,
      sectionName: chunk.sectionName,
      text: chunk.text,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Reindex — single panel or all panels
// ---------------------------------------------------------------------------

async function buildPanelIndex(panel, onProgress) {
  const typeFilter = PANELS[panel]?.types ?? null;
  const specFiles = readSpecFiles(typeFilter);

  if (specFiles.length === 0) {
    return {
      warning: `No spec files found${panel ? ` for panel '${panel}'` : ""}.`,
      indexed: 0,
      chunks: 0,
      duration: "0ms",
    };
  }

  const allChunks = specFiles.flatMap(chunkSpecFile);
  const start = Date.now();
  const embedded = [];

  for (let i = 0; i < allChunks.length; i++) {
    onProgress?.(i + 1, allChunks.length, allChunks[i].specId);
    const embedding = await getEmbedding(allChunks[i].text);
    embedded.push({ ...allChunks[i], embedding });
  }

  const meta = saveIndex(panel, embedded);
  return {
    panel,
    indexed: meta.fileCount,
    chunks: meta.chunkCount,
    duration: `${Date.now() - start}ms`,
    model: EMBED_MODEL,
  };
}

// Reindex all panels — each gets its own index file, no combined file
async function buildAllIndexes(onProgress) {
  const results = [];
  for (const panel of ALL_PANEL_NAMES) {
    const r = await buildPanelIndex(panel, onProgress);
    results.push(r);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Load chunks for search — falls back gracefully
// ---------------------------------------------------------------------------

function resolveChunksForSearch(panel) {
  if (panel) {
    const chunks = loadIndex(panel);
    return { chunks, source: panel };
  }

  // No panel specified → merge all available per-panel indexes
  const merged = [];
  const sources = [];
  for (const p of ALL_PANEL_NAMES) {
    const idx = loadIndex(p);
    if (idx) {
      merged.push(...idx);
      sources.push(p);
    }
  }
  return merged.length > 0
    ? { chunks: merged, source: sources.join(", ") }
    : { chunks: null, source: null };
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "semantic_search",
    description:
      "Search the project spec by meaning rather than exact keywords. " +
      "Returns spec items ranked by relevance — useful for finding requirements, " +
      "decisions, or context related to a concept. " +
      "Use the 'panel' parameter to restrict search to one sidebar panel " +
      "(requirements, backlog, sprints, technical, database, team, concept). " +
      "Omit 'panel' to search across everything. " +
      "The index must be built first — run reindex_vector_store or use the " +
      "$(database) button in the VS Code sidebar.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Natural language search query (e.g. 'authentication flow', 'performance requirements').",
        },
        panel: {
          type: "string",
          enum: [
            "requirements",
            "backlog",
            "sprints",
            "technical",
            "database",
            "team",
            "concept",
          ],
          description:
            "Restrict search to this panel's types. Omit to search across all indexed content.",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 5, max: 20).",
        },
        type: {
          type: "string",
          description:
            "Further restrict by comma-separated spec types (e.g. 'fr,nfr'). Optional.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "reindex_vector_store",
    description:
      "Rebuild the semantic vector index. " +
      "Specify 'panel' to reindex only that panel (requirements, backlog, sprints, " +
      "technical, database, team, concept). " +
      "Omit 'panel' to reindex all panels (each gets its own index file). " +
      "Requires Ollama running locally with nomic-embed-text pulled " +
      "(ollama pull nomic-embed-text).",
    inputSchema: {
      type: "object",
      properties: {
        panel: {
          type: "string",
          enum: [
            "requirements",
            "backlog",
            "sprints",
            "technical",
            "database",
            "team",
            "concept",
          ],
          description:
            "Which panel's index to rebuild. Omit to rebuild all indexes.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_vector_status",
    description:
      "Returns the current state of all vector indexes: when each was last built, " +
      "file/chunk counts, and which embedding model was used.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------

async function callTool(name, args) {
  switch (name) {
    case "semantic_search": {
      const { query, panel, limit = 5, type } = args;
      if (!query) return "❌ query is required.";

      const { chunks, source } = resolveChunksForSearch(panel ?? null);
      if (!chunks) {
        const hint = panel
          ? `'${panel}' panel index`
          : "any vector index";
        return (
          `❌ No ${hint} found.\n\n` +
          "Run reindex_vector_store first, or click the $(database) button " +
          "in the VS Code sidebar panel."
        );
      }

      let queryEmbedding;
      try {
        queryEmbedding = await getEmbedding(query);
      } catch (err) {
        return `❌ Embedding failed: ${err.message}`;
      }

      const results = searchChunks(
        chunks,
        queryEmbedding,
        Math.min(limit, 20),
        type,
      );
      if (results.length === 0) return "No results found.";

      const lines = [
        `# Semantic search: "${query}"`,
        `_Searched: ${source}_\n`,
      ];
      for (const r of results) {
        const pct = (r.score * 100).toFixed(1);
        lines.push(`## [${r.specId}] ${r.title}  (${pct}% match)`);
        lines.push(`- **type**: ${r.type}  **status**: ${r.status}`);
        if (r.sectionName) lines.push(`- **section**: ${r.sectionName}`);
        lines.push(`\n${r.text}\n`);
      }
      return lines.join("\n");
    }

    case "reindex_vector_store": {
      const { panel } = args;
      if (panel && !PANELS[panel]) {
        return `❌ Unknown panel: "${panel}". Valid: ${ALL_PANEL_NAMES.join(", ")}`;
      }
      try {
        if (panel) {
          const result = await buildPanelIndex(panel);
          if (result.warning) return `⚠️ ${result.warning}`;
          return (
            `✅ Panel '${panel}' indexed — ${result.indexed} files, ${result.chunks} chunks in ${result.duration}\n` +
            `Model: ${result.model}`
          );
        }
        const results = await buildAllIndexes();
        const total = results.reduce((s, r) => s + (r.chunks ?? 0), 0);
        return (
          `✅ All panel indexes built — ${total} chunks total\n` +
          results
            .map((r) => `  ${r.panel}: ${r.indexed ?? 0} files, ${r.chunks ?? 0} chunks`)
            .join("\n")
        );
      } catch (err) {
        return `❌ Reindex failed: ${err.message}`;
      }
    }

    case "get_vector_status": {
      const lines = ["## Vector Index Status\n"];
      let anyBuilt = false;
      for (const p of ALL_PANEL_NAMES) {
        const meta = loadMeta(p);
        const label = `${p} (${PANELS[p].label})`;
        if (meta) {
          anyBuilt = true;
          lines.push(
            `### ${label}`,
            `- Last indexed: ${meta.lastIndexed}`,
            `- Files: ${meta.fileCount}  Chunks: ${meta.chunkCount}`,
            `- Model: ${meta.model}`,
            "",
          );
        } else {
          lines.push(`### ${label}`, `- _not built_`, "");
        }
      }
      if (!anyBuilt) {
        return (
          "No indexes built yet.\nRun reindex_vector_store or click the " +
          "$(database) button in the VS Code sidebar."
        );
      }
      lines.push(`Index location: .spec/.vector-index/`);
      return lines.join("\n");
    }

    default:
      return `❌ Unknown tool: ${name}`;
  }
}

// ---------------------------------------------------------------------------
// MCP JSON-RPC 2.0 stdio transport
// ---------------------------------------------------------------------------

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

async function handleRequest(msg) {
  const { id, method, params } = msg;
  if (id === undefined || id === null) return; // notifications

  switch (method) {
    case "initialize":
      send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "project-spec-vector", version: "1.1.0" },
        },
      });
      break;

    case "tools/list":
      send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
      break;

    case "tools/call": {
      const toolName = params?.name;
      const toolArgs = params?.arguments ?? {};
      let resultText;
      try {
        resultText = await callTool(toolName, toolArgs);
      } catch (err) {
        resultText = `❌ Error: ${err.message}`;
      }
      send({
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: resultText }] },
      });
      break;
    }

    default:
      send({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
  }
}

// ---------------------------------------------------------------------------
// Main — dual mode: MCP server  OR  --reindex CLI
// ---------------------------------------------------------------------------

async function main() {
  if (process.argv.includes("--reindex")) {
    const panelArg = process.argv
      .find((a) => a.startsWith("--panel="))
      ?.slice("--panel=".length);

    if (panelArg && !PANELS[panelArg]) {
      process.stderr.write(
        `Error: unknown panel '${panelArg}'. Valid: ${ALL_PANEL_NAMES.join(", ")}\n`,
      );
      process.exit(1);
    }

    try {
      if (panelArg) {
        process.stderr.write(
          `Indexing '${panelArg}' panel with ${EMBED_MODEL}...\n`,
        );
        const result = await buildPanelIndex(panelArg, (done, total, id) => {
          process.stderr.write(`  [${done}/${total}] ${id}\n`);
        });
        if (result.warning) {
          process.stderr.write(`Warning: ${result.warning}\n`);
          process.exit(0);
        }
        process.stdout.write(
          `Indexed '${panelArg}': ${result.indexed} files, ${result.chunks} chunks (${result.duration})\n`,
        );
      } else {
        process.stderr.write(
          `Indexing all panels with ${EMBED_MODEL}...\n`,
        );
        const results = await buildAllIndexes((done, total, id) => {
          process.stderr.write(`  [${done}/${total}] ${id}\n`);
        });
        const total = results.reduce((s, r) => s + (r.chunks ?? 0), 0);
        process.stdout.write(
          `Indexed all panels: ${total} total chunks across ${results.length} panels\n`,
        );
      }
      process.exit(0);
    } catch (err) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
  }

  // --search mode: usable directly via Bash tool even when MCP isn't loaded
  if (process.argv.includes("--search")) {
    const idx = process.argv.indexOf("--search");
    const query = process.argv[idx + 1];
    if (!query || query.startsWith("--")) {
      process.stderr.write("Usage: node mcp/vector-server.js --search \"query\" [--panel=<panel>] [--limit=N]\n");
      process.exit(1);
    }
    const panelArg = process.argv.find((a) => a.startsWith("--panel="))?.slice("--panel=".length) ?? null;
    const limitArg = parseInt(process.argv.find((a) => a.startsWith("--limit="))?.slice("--limit=".length) ?? "5", 10);
    if (panelArg && !PANELS[panelArg]) {
      process.stderr.write(`Error: unknown panel '${panelArg}'. Valid: ${ALL_PANEL_NAMES.join(", ")}\n`);
      process.exit(1);
    }
    try {
      const { chunks, source } = resolveChunksForSearch(panelArg);
      if (!chunks) {
        process.stderr.write(
          `No index found${panelArg ? ` for panel '${panelArg}'` : ""}.\n` +
          `Run first: node mcp/vector-server.js --reindex${panelArg ? ` --panel=${panelArg}` : ""}\n`,
        );
        process.exit(1);
      }
      const queryEmbedding = await getEmbedding(query);
      const results = searchChunks(chunks, queryEmbedding, Math.min(limitArg || 5, 20), null);
      if (results.length === 0) {
        process.stdout.write("No results found.\n");
      } else {
        process.stdout.write(`# Semantic search: "${query}" [${source}]\n\n`);
        for (const r of results) {
          const pct = (r.score * 100).toFixed(1);
          process.stdout.write(`## [${r.specId}] ${r.title} (${pct}%)\n`);
          process.stdout.write(`type: ${r.type} | status: ${r.status}${r.sectionName ? ` | section: ${r.sectionName}` : ""}\n\n`);
          process.stdout.write(`${r.text}\n\n---\n\n`);
        }
      }
      process.exit(0);
    } catch (err) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
  }

  // MCP server mode
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      handleRequest(JSON.parse(trimmed)).catch(() => {});
    } catch {
      // ignore malformed lines
    }
  });
  rl.on("close", () => process.exit(0));
}

main();
