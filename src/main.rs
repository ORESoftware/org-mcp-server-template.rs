//! Fleet-generated organization MCP server entry point.

use ore_mcp_org_server::{run_stdio, OrgSpec};

const DEPENDENCIES: &[&str] = &[
    "ORESoftware/mcp-rust-libs",
    "ores-otel/ores-mcp-server-core-libs.rs",
    "shared-auth/shared-auth-clients",
    "shared-auth/shared-auth-interfaces",
    "shared-auth/shared-auth-lib",
    "zed-pkg/zed-cli",
];

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    run_stdio(OrgSpec {
        organization: "ORESoftware",
        repository: "ORESoftware/org-mcp-server-template.rs",
        service_name: "org-mcp-server-template",
        package_name: "org-mcp-server-template",
        dependencies: DEPENDENCIES,
        version: env!("CARGO_PKG_VERSION"),
    })
    .await
}
