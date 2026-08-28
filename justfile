set shell := ["bash", "-euo", "pipefail", "-c"]

default:
    @just --list

check:
    cargo fmt --all -- --check
    cargo clippy --locked --all-targets -- -D warnings
    cargo test --locked --all-targets
    cargo audit --deny warnings
    just env-policy

run profile="dev":
    @test -f "env/enc/{{ profile }}.env.enc"
    @ores-sops ensure-dec
    @sops exec-env --same-process --input-type dotenv "env/enc/{{ profile }}.env.enc" 'cargo run --locked --release'

test-with-env profile="dev":
    @test -f "env/enc/{{ profile }}.env.enc"
    @ores-sops ensure-dec
    @sops exec-env --input-type dotenv "env/enc/{{ profile }}.env.enc" 'cargo test --locked --all-targets'

decrypt profile="dev":
    @test -f "env/enc/{{ profile }}.env.enc"
    @ores-sops ensure-dec
    @umask 077; sops --decrypt --input-type dotenv --output-type dotenv --output "env/dec/{{ profile }}.env" "env/enc/{{ profile }}.env.enc"
    @chmod 600 "env/dec/{{ profile }}.env"
    @printf '%s\n' "decrypted env/dec/{{ profile }}.env (ignored; remove it when finished)"

encrypt profile="dev":
    @test -f "env/dec/{{ profile }}.env"
    @test -f .sops.yaml
    @sops --encrypt --input-type dotenv --output-type dotenv --output "env/enc/{{ profile }}.env.enc" "env/dec/{{ profile }}.env"
    @printf '%s\n' "encrypted env/enc/{{ profile }}.env.enc"

edit profile="dev":
    @test -f "env/enc/{{ profile }}.env.enc"
    @sops "env/enc/{{ profile }}.env.enc"

env-policy:
    @test -f .sops.yaml
    @test -n "$(find env/enc -mindepth 1 -maxdepth 1 -type f -name '*.env.enc' -print -quit)"
    @test -z "$(git ls-files 'env/dec/*.env' '.env' '.env.*')"
    @for file in env/enc/*.env.enc; do sops filestatus --input-type dotenv "$file" | grep -q '"encrypted"[[:space:]]*:[[:space:]]*true'; done
    @printf '%s\n' 'environment policy verified'
