
-- =====================================================
-- VIBEMEET DATABASE SCHEMA
-- Next.js + Supabase + LiveKit
-- =====================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- =====================================================
-- 2. USERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
    email TEXT,
    avatar TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_email_not_empty
        CHECK (email IS NULL OR char_length(btrim(email)) > 0)
);

-- Prevent duplicate email addresses (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
ON public.users (LOWER(email))
WHERE email IS NOT NULL;


-- =====================================================
-- 3. MEETINGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    room_code TEXT NOT NULL UNIQUE
        CHECK (room_code ~ '^RAJ-[0-9]{3}-[0-9]{3}$'),

    title TEXT NOT NULL
        CHECK (char_length(btrim(title)) BETWEEN 1 AND 100),

    description TEXT NOT NULL DEFAULT '',

    host_id UUID NOT NULL
        REFERENCES public.users(id) ON DELETE RESTRICT,

    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,

    is_locked BOOLEAN NOT NULL DEFAULT FALSE,

    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('scheduled', 'active', 'ended')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT meetings_valid_timestamps
        CHECK (
            ended_at IS NULL
            OR (
                started_at IS NOT NULL
                AND ended_at >= started_at
            )
        )
);


-- =====================================================
-- 4. PARTICIPANTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    meeting_id UUID NOT NULL
        REFERENCES public.meetings(id) ON DELETE CASCADE,

    user_id UUID
        REFERENCES public.users(id) ON DELETE SET NULL,

    guest_name TEXT NOT NULL
        CHECK (char_length(btrim(guest_name)) BETWEEN 1 AND 100),

    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at TIMESTAMPTZ,

    is_removed BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT participants_valid_timestamps
        CHECK (left_at IS NULL OR left_at >= joined_at)
);

-- Prevent the same registered user from joining
-- the same meeting multiple times.
CREATE UNIQUE INDEX IF NOT EXISTS participants_user_unique_idx
ON public.participants (meeting_id, user_id)
WHERE user_id IS NOT NULL;

-- Efficient meeting participant lookup
CREATE INDEX IF NOT EXISTS participants_meeting_joined_idx
ON public.participants (meeting_id, joined_at);

-- Efficient user participation history
CREATE INDEX IF NOT EXISTS participants_user_idx
ON public.participants (user_id)
WHERE user_id IS NOT NULL;


-- =====================================================
-- 5. MESSAGES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    meeting_id UUID NOT NULL
        REFERENCES public.meetings(id) ON DELETE CASCADE,

    sender_name TEXT NOT NULL
        CHECK (char_length(btrim(sender_name)) BETWEEN 1 AND 100),

    content TEXT NOT NULL
        CHECK (char_length(btrim(content)) BETWEEN 1 AND 4000),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Efficient chronological message retrieval
CREATE INDEX IF NOT EXISTS messages_meeting_created_idx
ON public.messages (meeting_id, created_at DESC);


-- =====================================================
-- 6. RECORDINGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    meeting_id UUID NOT NULL
        REFERENCES public.meetings(id) ON DELETE CASCADE,

    url TEXT NOT NULL
        CHECK (char_length(btrim(url)) > 0),

    duration INTEGER
        CHECK (duration IS NULL OR duration >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Efficient recording lookup
CREATE INDEX IF NOT EXISTS recordings_meeting_created_idx
ON public.recordings (meeting_id, created_at DESC);


-- =====================================================
-- 7. MEETING INDEXES
-- =====================================================

-- Find meetings hosted by a particular user
CREATE INDEX IF NOT EXISTS meetings_host_scheduled_idx
ON public.meetings (host_id, scheduled_at);

-- Find recently started meetings
CREATE INDEX IF NOT EXISTS meetings_host_started_idx
ON public.meetings (host_id, started_at DESC);

-- Find upcoming scheduled meetings efficiently
CREATE INDEX IF NOT EXISTS meetings_upcoming_idx
ON public.meetings (scheduled_at)
WHERE status = 'scheduled';


-- =====================================================
-- 8. API RATE LIMITS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
    key TEXT PRIMARY KEY
        CHECK (char_length(btrim(key)) BETWEEN 1 AND 512),

    window_started_at TIMESTAMPTZ NOT NULL,

    hits INTEGER NOT NULL
        CHECK (hits > 0)
);


-- =====================================================
-- 9. RATE LIMIT FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
    p_key TEXT,
    p_limit INTEGER,
    p_window_seconds INTEGER
)
RETURNS BOOLEAN

LANGUAGE plpgsql
SECURITY DEFINER

SET search_path = public, pg_temp

AS $$
DECLARE
    current_hits INTEGER;
BEGIN

    -- Validate input parameters
    IF p_key IS NULL OR char_length(btrim(p_key)) = 0 THEN
        RAISE EXCEPTION 'Rate limit key cannot be empty';
    END IF;

    IF p_limit IS NULL OR p_limit <= 0 THEN
        RAISE EXCEPTION 'Rate limit must be greater than zero';
    END IF;

    IF p_window_seconds IS NULL OR p_window_seconds <= 0 THEN
        RAISE EXCEPTION 'Window duration must be greater than zero';
    END IF;

    -- Atomic rate limit update
    INSERT INTO public.api_rate_limits (
        key,
        window_started_at,
        hits
    )
    VALUES (
        p_key,
        NOW(),
        1
    )

    ON CONFLICT (key)
    DO UPDATE SET

        window_started_at = CASE
            WHEN public.api_rate_limits.window_started_at
                <= NOW() - make_interval(secs => p_window_seconds)
            THEN NOW()
            ELSE public.api_rate_limits.window_started_at
        END,

        hits = CASE
            WHEN public.api_rate_limits.window_started_at
                <= NOW() - make_interval(secs => p_window_seconds)
            THEN 1
            ELSE public.api_rate_limits.hits + 1
        END

    RETURNING hits INTO current_hits;

    RETURN current_hits <= p_limit;

END;
$$;


-- =====================================================
-- 10. FUNCTION PERMISSIONS
-- =====================================================

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER)
TO service_role;


-- =====================================================
-- 11. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 12. DATABASE SECURITY
-- =====================================================

-- Browser clients cannot directly access these tables.
-- All database operations must go through trusted
-- Next.js server-side code.

REVOKE ALL ON TABLE
    public.users,
    public.meetings,
    public.participants,
    public.messages,
    public.recordings,
    public.api_rate_limits

FROM anon, authenticated;


-- Allow trusted backend operations using service_role.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public.users,
    public.meetings,
    public.participants,
    public.messages,
    public.recordings,
    public.api_rate_limits

TO service_role;


-- =====================================================
-- END OF VIBEMEET DATABASE MIGRATION
-- =====================================================

