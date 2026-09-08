import "@typespec/json-schema";
using TypeSpec.JsonSchema;

// Independently authored authority. Do not generate this from authored.schema.json.
@jsonSchema
@extension("additionalProperties", false)
model NoArguments {}

// The pinned cf4523ec runtime's identity contract, not the newer provider runtime.
@jsonSchema
@extension("additionalProperties", false)
model OrgIdentity {
  @minLength(1) organization: string;
  @minLength(1) repository: string;
  @minLength(1) service: string;
  @minLength(1) package: string;
  @minLength(1) version: string;
  transport: "stdio";
  accessMode: "read_only";
}
