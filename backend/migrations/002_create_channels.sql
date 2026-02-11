-- Create Channels Table
CREATE TABLE IF NOT EXISTS channels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert Root Channel (ID 0)
INSERT INTO channels (id, name, parent_id, description)
VALUES (0, 'Root', NULL, 'Server Root')
ON CONFLICT (id) DO NOTHING;

-- Insert Default Channels with Explicit IDs to avoid sequence issues and ensure determinism
INSERT INTO channels (id, name, parent_id, description)
VALUES (1, 'General', 0, 'General Chat')
ON CONFLICT (id) DO NOTHING;

INSERT INTO channels (id, name, parent_id, description)
VALUES (2, 'Gaming', 0, 'Gaming Lounge')
ON CONFLICT (id) DO NOTHING;

-- Reset sequence to the highest ID (which will be >= 2, so valid)
SELECT setval('channels_id_seq', (SELECT MAX(id) FROM channels));
