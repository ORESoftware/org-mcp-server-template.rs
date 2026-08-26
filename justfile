# org-mcp-server — task runner. Run `just` to see everything.
#
# Secrets: env/enc/*.env.enc (sops + age). See env/README.md and AGENTS.md.

set shell := ["bash", "-euo", "pipefail", "-c"]
set dotenv-load := false

import '.just/env.just'

default:
    @just --list

alias use := env-use
alias edit := env-edit
alias audit := env-check
alias env-audit := env-check

[group('env')]
env-use name: (env-decrypt name)
    #!/usr/bin/env bash
    set -euo pipefail
    cd "{{ justfile_directory() }}"
    target="env/dec/{{ name }}.env"
    [[ -f $target ]] || { echo "missing $target" >&2; exit 1; }
    if [[ -e .env || -L .env ]]; then
      if [[ -L .env ]] && [[ $(readlink .env) == env/dec/*.env ]]; then
        rm -f .env
      else
        echo "refusing to replace unmanaged .env (not a symlink into env/dec/)" >&2
        exit 1
      fi
    fi
    ln -s "$target" .env
    echo ".env -> $target"

[group('env')]
env-unuse:
    #!/usr/bin/env bash
    set -euo pipefail
    cd "{{ justfile_directory() }}"
    if [[ -L .env ]] && [[ $(readlink .env) == env/dec/*.env ]]; then
      rm -f .env; echo "removed .env symlink"
    elif [[ -e .env ]]; then
      echo "refusing to remove unmanaged .env" >&2; exit 1
    else
      echo "no .env to remove"
    fi

check:
    cargo fmt --all -- --check
    cargo clippy --locked --all-targets -- -D warnings
    cargo test --locked --all-targets
    cargo audit --deny warnings
    just env-check

run profile="dev":
    just env-run {{ profile }} cargo run --locked --release
