-- Initial schema.
-- Apply locally:  pnpm run db:migrate:local
-- Apply remotely: pnpm run db:migrate:remote

-- People who signed in with a social login.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,          -- 'github' | 'google'
  provider_user_id TEXT NOT NULL,  -- stable id from the provider
  login TEXT NOT NULL,             -- GitHub username or Google e-mail (used for owner matching)
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (provider, provider_user_id)
);

-- Login sessions. `id` is the SHA-256 of the cookie token, so a database
-- leak does not leak usable session cookies.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user_id ON sessions (user_id);

-- The wishlist itself. Owned and edited by the site owner; not secret.
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  url TEXT,
  image_url TEXT,
  price TEXT,                      -- free text, e.g. "£25" or "~$40"
  priority INTEGER NOT NULL DEFAULT 2,  -- 1 = would love, 2 = would like, 3 = nice to have
  quantity INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Purchase and group-gift state, deliberately opaque.
-- Each row is either an AES-GCM encrypted entry or random decoy bytes that
-- fail authentication. There is no item id, user id or timestamp in clear
-- text. See src/server/ledger.ts and README.md → "How surprises stay secret".
CREATE TABLE sync_state (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
