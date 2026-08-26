{
  description = "Hardened Rust organization MCP server with Zed and SOPS+age tooling";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "aarch64-darwin" "x86_64-darwin" "aarch64-linux" "x86_64-linux" ];
      eachSystem = function:
        nixpkgs.lib.genAttrs systems (system: function (import nixpkgs { inherit system; }));
    in {
      devShells = eachSystem (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            age
            cargo
            cargo-audit
            clippy
            git
            jq
            just
            rustc
            rustfmt
            sops
            python3
          ];
          shellHook = ''
            export RUST_BACKTRACE=1
            _repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
            umask 077
            mkdir -p "$_repo_root/env/dec"
            chmod 700 "$_repo_root/env/dec"
            echo "organization MCP development shell: Rust + Zed + SOPS/age"
            if [ -z "''${SOPS_AGE_KEY_FILE:-}" ]; then
              for _k in "''${XDG_CONFIG_HOME:-$HOME/.config}/sops/age/keys.txt" \
                        "$HOME/Library/Application Support/sops/age/keys.txt"; do
                if [ -f "$_k" ]; then export SOPS_AGE_KEY_FILE="$_k"; break; fi
              done
            fi
          '';
        };
      });
    };
}
