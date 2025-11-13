# Shared Docs Overview

This folder contains the sharded (sectioned) documentation, split from larger markdown files to improve readability, reuse, and cross‑linking. Each original document is exploded into level‑2 (##) sections, with a local `index.md` for navigation.

## Canonical Entrypoint
- Start here: [Shared Docs Index](./index/index.md)
- Source originals live in:
  - Documentation/index.md (root project index)
  - Documentation/project-overview.md (overview summary)

## Folder Structure
- ./index/
  - [index.md](./index/index.md)
  - [project-overview.md](./index/project-overview.md)
  - [quick-reference.md](./index/quick-reference.md)
  - [generated-documentation.md](./index/generated-documentation.md)
- ./project-overview/
  - [index.md](./project-overview/index.md)
  - [executive-summary.md](./project-overview/executive-summary.md)
  - [tech-stack-summary.md](./project-overview/tech-stack-summary.md)
  - [repository-structure.md](./project-overview/repository-structure.md)
  - [links.md](./project-overview/links.md)

## Editing & Sharding Workflow
Use docs‑as‑code and keep originals authoritative. When making broad edits:
1. Edit the original file(s) under `Documentation/` (e.g., `index.md`, `project-overview.md`).
2. Re‑shard to update these folders (level‑2 sections become files):
   ```bash
   npx -p @kayvan/markdown-tree-parser md-tree explode Documentation/index.md Documentation/shared-docs/index
   npx -p @kayvan/markdown-tree-parser md-tree explode Documentation/project-overview.md Documentation/shared-docs/project-overview
   ```
3. If you edited sharded files and need to recompose a single doc, you can assemble:
   ```bash
   npx -p @kayvan/markdown-tree-parser md-tree assemble Documentation/shared-docs/index Documentation/index.md
   npx -p @kayvan/markdown-tree-parser md-tree assemble Documentation/shared-docs/project-overview Documentation/project-overview.md
   ```

Notes
- CommonMark only; use relative links.
- One concept per section; prefer clear, task‑oriented headings.
- Validate PRs by opening `./index/index.md` and clicking through links.

## Link Conventions
- Always use relative paths (e.g., `./project-overview/executive-summary.md`).
- Cross‑link between sections when helpful; avoid duplicate content.

## Audience Guide
- PM: start with [Executive Summary](./project-overview/executive-summary.md) and [Quick Reference](./index/quick-reference.md).
- Developers: see [Tech Stack Summary](./project-overview/tech-stack-summary.md), [API Contracts](../api-contracts-part-1.md), and [Data Models](../data-models-part-1.md).
- Test/QA: use [Generated Documentation](./index/generated-documentation.md) and link out to API/Data references.

## Maintenance Checklist
- After significant changes, re‑run “explode” to refresh sharded files.
- Keep `Documentation/index.md` pointing to `./shared-docs/index/index.md`.
- Verify `index.md` pages render and all links resolve.
