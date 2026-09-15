use std::fs;
use std::path::PathBuf;

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn lock_config() -> String {
    fs::read_to_string(root().join(".ores-lock.toml")).expect("checked-in .ores-lock.toml")
}

#[test]
fn lock_policy_shape_matches_service_composed_v1() {
    let lock = lock_config();
    assert!(lock.contains("schema_version = \"ores.lock.config.v1\""));
    assert!(lock.contains("default_profile = \"service-composed\""));
    assert!(lock.contains("selected_profile_env = \"ORES_LOCK_PROFILE\""));
    assert!(lock.contains("[profiles.providers]\nlocal_file = false\nfiducia = true\npg_advisory = true"));
    assert!(lock.contains("[profiles.postgres]"));
    assert!(lock.contains("scope = \"transaction\""));
}

#[test]
fn lock_policy_keeps_secrets_environment_owned() {
    let lock = lock_config();
    assert!(lock.contains("key = \"FIDUCIA_AUTH_TOKEN\"\nkind = \"string\"\nrequired = true\nsecret = true"));
    assert!(lock.contains("key = \"DATABASE_URL\"\nkind = \"string\"\nrequired = true\nsecret = true"));
    assert!(lock.contains("database_url_env = \"DATABASE_URL\""));
    for forbidden in ["postgres://", "postgresql://", "Bearer ", "auth_token =", "database_url ="] {
        assert!(!lock.contains(forbidden), "literal secret/connection shape leaked: {forbidden}");
    }
}

#[test]
fn zpkg_does_not_own_runtime_lock_policy() {
    let path = root().join(".zpkg.toml");
    let Ok(zpkg) = fs::read_to_string(path) else { return };
    for forbidden in [
        "wait_timeout_ms",
        "retry_interval_ms",
        "ttl_ms",
        "renew_interval_ms",
        "FIDUCIA_AUTH_TOKEN",
        "DATABASE_URL",
    ] {
        assert!(!zpkg.contains(forbidden), ".zpkg.toml absorbed runtime lock policy: {forbidden}");
    }
}
