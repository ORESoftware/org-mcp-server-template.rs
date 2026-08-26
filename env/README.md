# Environment files

Secrets for `ores/org-mcp-server-template.rs` are **committed, encrypted**, with [sops] + [age],
following the fleet-wide `ORESoftware/ores-sops` contract.

```
env/enc/dev.env.enc     ciphertext — committed. This is the source of truth.
env/enc/prod.env.enc    ciphertext — committed.
env/dec/dev.env         plaintext  — gitignored, mode 0600, disposable.
env/dec/prod.env        plaintext  — gitignored, mode 0600, disposable.
.env                    relative managed symlink -> env/dec/<name>.env
```

See this repo's `AGENTS.md` and the parent
`~/codes/oresoftware/my-ai/AGENTS.md`.

```sh
just env-keygen
just env-whoami
just env-decrypt
just env-use dev
just env-check
```

`.just/env.just` and `.just/dotenv.py` are a shared module. Do not fork them.

[sops]: https://github.com/getsops/sops
[age]: https://github.com/FiloSottile/age
