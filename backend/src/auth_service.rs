use crate::codec::{Authenticate, Reject};
use crate::db::Database;
use anyhow::Result;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use tracing::info;

pub enum AuthDecision {
    Accepted { username: String },
    Rejected(Reject),
}

pub async fn authenticate_or_register(db: &Database, auth: Authenticate) -> Result<AuthDecision> {
    let username = auth.username.unwrap_or("Unknown".to_string());
    let password = auth.password.unwrap_or_default();

    if let Some(user) = db.get_user_by_username(&username).await? {
        let parsed_hash = PasswordHash::new(&user.password_hash)
            .map_err(|e| anyhow::anyhow!("Invalid hash in DB: {}", e))?;

        if Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok()
        {
            info!("User {} logged in successfully via DB.", username);
            return Ok(AuthDecision::Accepted { username });
        }

        let mut reject = Reject::default();
        reject.reason = Some("Invalid password".into());
        reject.r#type = Some(1);
        return Ok(AuthDecision::Rejected(reject));
    }

    info!("User {} not found. Registering...", username);
    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| anyhow::anyhow!("Hashing failed: {}", e))?
        .to_string();

    let _new_user = db.create_user(&username, &password_hash).await?;
    info!("User {} registered successfully.", username);

    Ok(AuthDecision::Accepted { username })
}
