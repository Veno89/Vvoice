use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::postgres::{PgPool, PgPoolOptions};
use tracing::info;

#[derive(Clone)]
pub struct Database {
    pub pool: PgPool,
}

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize)]
pub struct DbUser {
    pub id: i32,
    pub username: String,
    pub password_hash: String,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize)]
pub struct DbChannel {
    pub id: i32,
    pub name: String,
    pub parent_id: Option<i32>,
    pub description: Option<String>,
}

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize)]
pub struct DbMessage {
    pub id: i32,
    pub sender_name: String,
    pub channel_id: i32,
    pub content: String,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
}

impl Database {
    pub async fn connect(url: &str) -> Result<Self> {
        info!("Connecting to database...");

        // 1. Attempt to connect to the target database directly
        let pool_result = PgPoolOptions::new().max_connections(5).connect(url).await;

        let pool = match pool_result {
            Ok(p) => p,
            Err(_) => {
                info!("Target database does not exist. Attempting to create it...");
                let (base_url, db_name) = url
                    .rsplit_once('/')
                    .ok_or_else(|| anyhow::anyhow!("Invalid DATABASE_URL format"))?;
                let maintenance_url = format!("{}/postgres", base_url);

                let maintenance_pool = PgPoolOptions::new()
                    .connect(&maintenance_url)
                    .await
                    .map_err(|e| {
                        anyhow::anyhow!("Failed to connect to maintenance database: {}", e)
                    })?;

                let exists: bool = sqlx::query_scalar(
                    "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1)",
                )
                .bind(db_name)
                .fetch_one(&maintenance_pool)
                .await?;

                if !exists {
                    let query = format!("CREATE DATABASE \"{}\"", db_name);
                    sqlx::query(&query).execute(&maintenance_pool).await?;
                    info!("Database '{}' created successfully!", db_name);
                }

                maintenance_pool.close().await;

                PgPoolOptions::new().max_connections(5).connect(url).await?
            }
        };

        info!("Database connected!");

        // Run migrations
        sqlx::migrate!("./migrations").run(&pool).await?;

        info!("Migrations applied!");

        Ok(Self { pool })
    }

    pub async fn get_user_by_username(&self, username: &str) -> Result<Option<DbUser>> {
        let user = sqlx::query_as::<_, DbUser>("SELECT * FROM users WHERE username = $1")
            .bind(username)
            .fetch_optional(&self.pool)
            .await?;
        Ok(user)
    }

    pub async fn create_user(&self, username: &str, password_hash: &str) -> Result<DbUser> {
        let user = sqlx::query_as::<_, DbUser>(
            "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *",
        )
        .bind(username)
        .bind(password_hash)
        .fetch_one(&self.pool)
        .await?;
        Ok(user)
    }

    pub async fn get_all_channels(&self) -> Result<Vec<DbChannel>> {
        let channels = sqlx::query_as::<_, DbChannel>("SELECT * FROM channels ORDER BY id ASC")
            .fetch_all(&self.pool)
            .await?;
        Ok(channels)
    }

    pub async fn save_message(
        &self,
        sender_name: &str,
        channel_id: i32,
        content: &str,
    ) -> Result<()> {
        sqlx::query("INSERT INTO messages (sender_name, channel_id, content) VALUES ($1, $2, $3)")
            .bind(sender_name)
            .bind(channel_id)
            .bind(content)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_recent_messages(&self, channel_id: i32, limit: i64) -> Result<Vec<DbMessage>> {
        let messages = sqlx::query_as::<_, DbMessage>(
            "SELECT * FROM messages WHERE channel_id = $1 ORDER BY created_at DESC LIMIT $2",
        )
        .bind(channel_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        // Reverse to return chronological order
        Ok(messages.into_iter().rev().collect())
    }
}
