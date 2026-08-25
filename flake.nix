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
          ];
          shellHook = ''
            export RUST_BACKTRACE=1
            echo "organization MCP development shell: Rust + Zed manifest + SOPS/age"
          '';
        };
      });
    };
}
