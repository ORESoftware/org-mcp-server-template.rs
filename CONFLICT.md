# ORESoftware/org-mcp-server-template.rs#1 — docs: add AGENTS.md and fleet sops env layout

head: chore/agents-md-and-sops-env  base: main  author: ORESoftware  updated: 2026-08-29T01:45:25Z
dir: /Users/maca5/codes/.claude-fleet/scratch/merge/ORESoftware_org-mcp-server-template.rs__1

## conflicted files
- justfile

## base (main) last 8 commits
2815a8f Merge pull request #2 from ORESoftware/agent/ores-sops-ensure-dec-20260828
0a2751b Unblock cargo-audit by moving off yanked chacha20 0.10.1.
d0bc7c7 Cover remaining env/dec creation paths with ores-sops ensure-dec.
26cbeb4 Refuse unguarded env/dec mkdir before ores-sops.
eb1302c fix: recover from oversized MCP stdio frames
b54877c feat: establish hardened organization MCP template

## head (chore/agents-md-and-sops-env) last 8 commits
60d9bfb docs: add AGENTS.md and fleet sops env layout
eb1302c fix: recover from oversized MCP stdio frames
b54877c feat: establish hardened organization MCP template

## merge-base: eb1302c17eca19ee9a14cfda624c4f8e3a3a3b42

## PR diff stat (merge-base..head)
 .envrc                              |   7 +
 .github/workflows/secrets-audit.yml |  32 +++
 .gitignore                          |  17 ++
 .just/dotenv.py                     |  87 +++++++
 .just/env.just                      | 461 ++++++++++++++++++++++++++++++++++++
 .sops.yaml                          |  27 ++-
 AGENTS.md                           |  88 +++++++
 env/README.md                       |  28 +++
 env/enc/prod.env.enc                |  10 +
 flake.nix                           |  13 +-
 justfile                            |  76 +++---
 11 files changed, 810 insertions(+), 36 deletions(-)

## base diff stat (merge-base..base)
 Cargo.lock | 4 ++--
 justfile   | 4 +++-
 2 files changed, 5 insertions(+), 3 deletions(-)

## merge output
Auto-merging justfile
CONFLICT (content): Merge conflict in justfile
Automatic merge failed; fix conflicts and then commit the result.
