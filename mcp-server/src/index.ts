#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from "node-fetch";
import { x as tarExtract } from "tar";
import { pipeline } from "stream/promises";
import path from "path";

const ENDPOINT = (process.env.TOKENLENS_ENDPOINT ?? "http://localhost:8000").replace(/\/$/, "");
const API_KEY = process.env.TOKENLENS_API_KEY ?? "";

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) h["Authorization"] = `Bearer ${API_KEY}`;
  return h;
}

async function apiFetch(path: string, init?: Parameters<typeof fetch>[1]) {
  const res = await fetch(`${ENDPOINT}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res;
}

const server = new McpServer({
  name: "tokenlens",
  version: "1.0.0",
});

// ── search_skills ────────────────────────────────────────────────────────────
server.tool(
  "search_skills",
  "Search the TokenLens skill registry",
  {
    query: z.string().describe("Free-text search query"),
    tag: z.string().optional().describe("Filter by tag slug"),
    sort: z.enum(["new", "popular", "rating"]).optional().describe("Sort order (default: new)"),
  },
  async ({ query, tag, sort }) => {
    const params = new URLSearchParams({ search: query });
    if (tag) params.set("tag", tag);
    if (sort) params.set("sort", sort);
    const res = await apiFetch(`/api/v1/skills?${params}`);
    const skills = (await res.json()) as Array<{
      id: string;
      name: string;
      description: string;
      tags: string[];
      avg_rating: number | null;
      download_count: number;
    }>;
    if (skills.length === 0) return { content: [{ type: "text", text: "No skills found." }] };
    const lines = skills.map(
      (s) =>
        `• ${s.id} — ${s.name}\n  ${s.description}\n  tags: ${s.tags.join(", ") || "—"}  rating: ${s.avg_rating?.toFixed(1) ?? "—"}  downloads: ${s.download_count}`
    );
    return { content: [{ type: "text", text: lines.join("\n\n") }] };
  }
);

// ── get_skill ────────────────────────────────────────────────────────────────
server.tool(
  "get_skill",
  "Get full metadata and usage instructions for a skill",
  { id: z.string().describe("Skill ID") },
  async ({ id }) => {
    const res = await apiFetch(`/api/v1/skills/${encodeURIComponent(id)}`);
    const s = (await res.json()) as {
      id: string;
      name: string;
      description: string;
      tags: string[];
      latest_version: string | null;
      avg_rating: number | null;
      download_count: number;
      usage_instructions: string | null;
      created_at: string;
    };
    const text = [
      `**${s.name}** (${s.id})`,
      `Version: ${s.latest_version ?? "—"}`,
      `Tags: ${s.tags.join(", ") || "—"}`,
      `Rating: ${s.avg_rating?.toFixed(1) ?? "—"}  Downloads: ${s.download_count}`,
      `Created: ${s.created_at}`,
      "",
      s.description,
      ...(s.usage_instructions ? ["", "## Usage", s.usage_instructions] : []),
    ].join("\n");
    return { content: [{ type: "text", text }] };
  }
);

// ── add_skill_to_workspace ───────────────────────────────────────────────────
server.tool(
  "add_skill_to_workspace",
  "Download and extract a skill tarball into the working directory",
  {
    id: z.string().describe("Skill ID"),
    target: z
      .string()
      .optional()
      .describe("Target directory (default: current working directory)"),
  },
  async ({ id, target }) => {
    const dest = path.resolve(target ?? process.cwd());
    const res = await apiFetch(`/api/v1/skills/${encodeURIComponent(id)}/download`);
    if (!res.body) throw new Error("Empty response body from download endpoint");
    await pipeline(res.body as unknown as NodeJS.ReadableStream, tarExtract({ cwd: dest, strip: 1 }));
    return {
      content: [{ type: "text", text: `Skill "${id}" extracted to ${dest}` }],
    };
  }
);

// ── rate_skill ───────────────────────────────────────────────────────────────
server.tool(
  "rate_skill",
  "Submit a star rating (1–5) for a skill",
  {
    id: z.string().describe("Skill ID"),
    stars: z.number().int().min(1).max(5).describe("Star rating 1–5"),
    comment: z.string().optional().describe("Optional review comment"),
  },
  async ({ id, stars, comment }) => {
    const body: Record<string, unknown> = { stars };
    if (comment) body.comment = comment;
    const res = await apiFetch(`/api/v1/skills/${encodeURIComponent(id)}/ratings`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const rating = (await res.json()) as { id: string; stars: number };
    return {
      content: [{ type: "text", text: `Rating submitted: ${rating.stars}★ for skill "${id}"` }],
    };
  }
);

// ── start ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
