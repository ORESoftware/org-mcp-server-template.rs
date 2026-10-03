Resolution: kept the PR's .just/env.just lifecycle (superset of the old recipes); `_env-dec` now calls
`ores-sops ensure-dec` when installed (main's addition) before its local mkdir/chmod 700 fallback; main's recipe
names test-with-env / decrypt / encrypt / env-policy are kept as wrappers over env-run / env-decrypt /
env-encrypt / env-check so nothing that called them breaks.
