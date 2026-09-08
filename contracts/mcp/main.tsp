// Independently authored TypeSpec authority; never overwrite from JSON Schema.
model NoArguments {}

model OrgIdentity {
  @minLength(1) @maxLength(256) organization: string;
  @minLength(3) @maxLength(256) repository: string;
  @minLength(1) @maxLength(256) service: string;
  @minLength(1) @maxLength(256) package: string;
  @minLength(1) version: string;
  transport: "stdio";
  accessMode: "read_only";
}

model ZedDependencyGraph {
  @minLength(1) organization: string;
  @minLength(3) repository: string;
  @minLength(1) package: string;
  materializationDirectory: ".vendor/.zed";
  @minItems(1) @maxItems(128) dependencies: string[];
  submoduleInterop: {
    gitAuthority: "exact committed checkout and source transport";
    zedAuthority: "package identity, dependency intent, materialization, and lock provenance";
    adoptionCommand: "zed overtake --git-submodules";
  };
}

model TelemetryStatus {
  @minLength(1) implementation: string;
  @minLength(40) @maxLength(40) revision: string;
  stdoutReservedForMcp: true;
  stderrJsonLogging: true;
  subscriberInstalled: boolean;
  exporters: { traces: boolean; metrics: boolean; logs: boolean; };
  attributes: "bounded_low_cardinality_no_credentials_or_payloads";
}

model SharedAuthPolicy {
  configured: boolean;
  authority: "shared-auth";
  ordinaryVerification: "local_ES256_JWKS_exact_issuer_audience_client_realm";
  immediateRevocation: "protected_server_to_server_introspection_only";
  productAuthorization: "owning_product_database_and_policy";
  realms: "admin_and_customer_are_independent";
  @minItems(4) @maxItems(4) outcomes: string[];
  credentialsAcceptedByThisTool: false;
}

model EnvironmentPolicy {
  encryptedGlob: "env/enc/*.env.enc";
  decryptedGlob: "env/dec/*.env";
  cipher: "sops_age";
  taskRunner: "just";
  toolchain: "nix";
  plaintextTracked: false;
  privateAgeIdentityTracked: false;
  secretValuesLogged: false;
}

model SecurityBaseline {
  mutations: "none";
  toolInputs: "closed_no_argument_schemas";
  toolOutputBytesMax: 65536;
  protocolStdoutOnly: true;
  logs: "structured_json_stderr";
  telemetry: "ores-otel_bounded_low_cardinality";
  authentication: "shared-auth_when_a_product_boundary_requires_it";
  authorization: "product_local_never_inferred_from_identity";
  dependencyManagement: "zed-pkg_with_immutable_git_revisions";
  secrets: "sops_age_env_injection_never_cli_flags_or_logs";
}

// Explicit newer fleet contract; legacy servers do not silently qualify for it.
model OrgIdentityV2 {
  @minLength(1) @maxLength(256) organization: string;
  @minLength(3) @maxLength(256) repository: string;
  @minLength(1) @maxLength(256) service: string;
  @minLength(1) @maxLength(256) package: string;
  @minLength(1) version: string;
  protocol: "2025-11-25";
  @minItems(2) @maxItems(2) transports: string[];
  @minItems(6) @maxItems(6) clients: string[];
  accessMode: "read_only";
}

model SecurityBaselineV2 {
  mutations: "none";
  toolInputs: "closed_no_argument_schemas";
  // Shared fleet provider outputs have a separate 512 KiB global ceiling.
  toolOutputBytesMax: 524288;
  protocolStdoutOnly: true;
  remoteProtocol: "oauth_protected_streamable_http";
  credentialedHttp: "exact_host_no_proxy_no_redirect";
  logs: "structured_json_stderr";
  telemetry: "ores-otel_bounded_low_cardinality";
  authentication: "shared-auth_when_a_product_boundary_requires_it";
  authorization: "product_local_never_inferred_from_identity";
  dependencyManagement: "zed-pkg_with_immutable_git_revisions";
  secrets: "sops_age_env_injection_never_cli_flags_or_logs";
}
