use sqlx::postgres::{PgPoolOptions, PgPool};
use anyhow::Result;
use tracing::info;

#[derive(Clone)]
pub struct Database {
    pub pool: PgPool,
}

impl Database {
    pub async fn connect(url: &str) -> Result<Self> {
        info!("Connecting to database...");

        // 1. Attempt to connect to the target database directly
        let pool_result = PgPoolOptions::new()
            .max_connections(5)
            .connect(url)
            .await;

        let pool = match pool_result {
            Ok(p) => p,
            Err(_) => {
                info!("Target database does not exist. Attempting to create it...");
                // 2. Fallback: Connect to 'postgres' database to create the new DB
                let (base_url, db_name) = url.rsplit_once('/').expect("Invalid DATABASE_URL format");
                let maintenance_url = format!("{}/postgres", base_url);
                
                let maintenance_pool = PgPoolOptions::new()
                    .connect(&maintenance_url)
                    .await
                    .map_err(|e| anyhow::anyhow!("Failed to connect to maintenance database (postgres): {}", e))?;

                // Check if db exists first (to avoid error if race condition)
                let exists: bool = sqlx::query_scalar(
                    "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1)"
                )
                .bind(db_name)
                .fetch_one(&maintenance_pool)
                .await?;

                if !exists {
                    // CREATE DATABASE cannot run in a transaction block, and simple query execution often wraps.
                    // But sqlx execute should be fine.
                    // Note: Parameterized queries don't work for identifiers like DB name in CREATE DATABASE
                    let query = format!("CREATE DATABASE \"{}\"", db_name);
                    sqlx::query(&query).execute(&maintenance_pool).await?;
                    info!("Database '{}' created successfully!", db_name);
                }
                
                maintenance_pool.close().await;

                // 3. Retry connection to the new database
                PgPoolOptions::new()
                    .max_connections(5)
                    .connect(url)
                    .await?
            }
        };
            
        info!("Database connected!");
        
        // Run migrations
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await?;
            
        info!("Migrations applied!");

        Ok(Self { pool })
    }
}
