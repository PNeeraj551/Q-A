-- Q&A Platform — Supabase PostgreSQL Migration
-- Run this in Supabase Dashboard → SQL Editor

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL CHECK (char_length(name) <= 80),
  email      TEXT UNIQUE NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('admin','user')),
  is_active  BOOLEAN NOT NULL DEFAULT true,
  is_root    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QnA Posts
CREATE TABLE qna_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL CHECK (char_length(title) <= 120),
  description TEXT NOT NULL DEFAULT '',
  visibility  TEXT NOT NULL CHECK (visibility IN ('PUBLIC','PRIVATE')),
  status      TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  created_by  UUID NOT NULL REFERENCES users(id),
  end_at      TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Private board access (junction table)
CREATE TABLE qna_allowed_users (
  qna_id  UUID NOT NULL REFERENCES qna_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (qna_id, user_id)
);

-- Questions
CREATE TABLE questions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qna_id            UUID NOT NULL REFERENCES qna_posts(id),
  text              TEXT NOT NULL CHECK (char_length(text) <= 5000),
  author_id         UUID NOT NULL REFERENCES users(id),
  author_name       TEXT NOT NULL,
  likes_count       INTEGER NOT NULL DEFAULT 0,
  reply_count       INTEGER NOT NULL DEFAULT 0,
  view_count        INTEGER NOT NULL DEFAULT 0,
  accepted_reply_id UUID,
  is_deleted        BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Question likes (many-to-many)
CREATE TABLE question_likes (
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, user_id)
);

-- Replies
CREATE TABLE replies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id),
  qna_id      UUID NOT NULL REFERENCES qna_posts(id),
  text        TEXT NOT NULL CHECK (char_length(text) <= 1000),
  author_id   UUID NOT NULL REFERENCES users(id),
  author_name TEXT NOT NULL,
  is_deleted  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Accepted reply FK (after replies table exists)
ALTER TABLE questions ADD CONSTRAINT fk_accepted_reply
  FOREIGN KEY (accepted_reply_id) REFERENCES replies(id);

-- OTPs
CREATE TABLE otps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  otp_hash   TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT false,
  attempts   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_qna_posts_visibility  ON qna_posts(visibility);
CREATE INDEX idx_qna_posts_created_at  ON qna_posts(created_at DESC);
CREATE INDEX idx_qna_allowed_users_user ON qna_allowed_users(user_id);
CREATE INDEX idx_questions_qna_feed    ON questions(qna_id, is_deleted, likes_count DESC, created_at ASC);
CREATE INDEX idx_replies_question      ON replies(question_id, is_deleted, created_at ASC);
CREATE INDEX idx_otps_email            ON otps(email);
CREATE INDEX idx_otps_email_active     ON otps(email, expires_at) WHERE used = false;

-- updated_at auto-trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_qna_posts_updated_at BEFORE UPDATE ON qna_posts   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_questions_updated_at BEFORE UPDATE ON questions    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_replies_updated_at   BEFORE UPDATE ON replies      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- OTP cleanup (called before inserting a new OTP)
CREATE OR REPLACE FUNCTION delete_expired_otps(p_email TEXT)
RETURNS void AS $$
  DELETE FROM otps WHERE email = p_email AND (expires_at < NOW() OR used = true);
$$ LANGUAGE sql;

-- Atomic like toggle
CREATE OR REPLACE FUNCTION toggle_question_like(p_question_id UUID, p_user_id UUID)
RETURNS TABLE(likes_count INTEGER, liked_by_me BOOLEAN) AS $$
DECLARE
  v_exists BOOLEAN;
  v_count  INTEGER;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM question_likes WHERE question_id = p_question_id AND user_id = p_user_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM question_likes WHERE question_id = p_question_id AND user_id = p_user_id;
    UPDATE questions SET likes_count = GREATEST(0, questions.likes_count - 1)
      WHERE id = p_question_id RETURNING questions.likes_count INTO v_count;
    RETURN QUERY SELECT v_count, FALSE;
  ELSE
    INSERT INTO question_likes (question_id, user_id) VALUES (p_question_id, p_user_id) ON CONFLICT DO NOTHING;
    UPDATE questions SET likes_count = questions.likes_count + 1
      WHERE id = p_question_id RETURNING questions.likes_count INTO v_count;
    RETURN QUERY SELECT v_count, TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Reply count helpers
CREATE OR REPLACE FUNCTION increment_reply_count(p_question_id UUID)
RETURNS void AS $$
  UPDATE questions SET reply_count = reply_count + 1 WHERE id = p_question_id;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION decrement_reply_count(p_question_id UUID)
RETURNS void AS $$
  UPDATE questions SET reply_count = GREATEST(0, reply_count - 1) WHERE id = p_question_id;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION increment_view_count(p_question_id UUID)
RETURNS void AS $$
  UPDATE questions SET view_count = view_count + 1 WHERE id = p_question_id;
$$ LANGUAGE sql;

-- Analytics aggregation
CREATE OR REPLACE FUNCTION get_analytics()
RETURNS JSON AS $$
DECLARE
  v_total_posts     INTEGER;
  v_total_questions INTEGER;
  v_total_replies   INTEGER;
  v_public_count    INTEGER;
  v_private_count   INTEGER;
  v_top_topics      JSON;
BEGIN
  SELECT COUNT(*)                                   INTO v_total_posts     FROM qna_posts;
  SELECT COUNT(*) FILTER (WHERE NOT is_deleted)     INTO v_total_questions FROM questions;
  SELECT COUNT(*) FILTER (WHERE NOT is_deleted)     INTO v_total_replies   FROM replies;
  SELECT COUNT(*) FILTER (WHERE visibility='PUBLIC') INTO v_public_count   FROM qna_posts;
  SELECT COUNT(*) FILTER (WHERE visibility='PRIVATE') INTO v_private_count FROM qna_posts;

  SELECT json_agg(t) INTO v_top_topics FROM (
    SELECT qp.id AS qna_id, qp.title, COUNT(q.id) AS question_count
    FROM qna_posts qp
    LEFT JOIN questions q ON q.qna_id = qp.id AND NOT q.is_deleted
    GROUP BY qp.id, qp.title
    ORDER BY question_count DESC
    LIMIT 5
  ) t;

  RETURN json_build_object(
    'total_posts',         v_total_posts,
    'total_questions',     v_total_questions,
    'total_replies',       v_total_replies,
    'visibility',          json_build_object('public', v_public_count, 'private', v_private_count),
    'most_active_topics',  COALESCE(v_top_topics, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql;

-- Enable Realtime broadcast on the project
ALTER PUBLICATION supabase_realtime ADD TABLE qna_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE questions;
ALTER PUBLICATION supabase_realtime ADD TABLE replies;
