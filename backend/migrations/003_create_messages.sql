CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_name VARCHAR(255) NOT NULL,
    channel_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_channel_created ON messages(channel_id, created_at DESC);
