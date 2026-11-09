-- =====================================================
-- VIBEMEET AUTH TRIGGERS & SYNC
-- Synchronize auth.users with public.users automatically
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.users (
        id,
        name,
        email,
        avatar
    )
    VALUES (
        NEW.id,
        COALESCE(
            NULLIF(btrim(NEW.raw_user_meta_data->>'name'), ''),
            SPLIT_PART(NEW.email, '@', 1),
            'VibeUser'
        ),
        NEW.email,
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = COALESCE(EXCLUDED.email, public.users.email),
        avatar = COALESCE(EXCLUDED.avatar, public.users.avatar);

    RETURN NEW;
END;
$$;

-- Drop trigger if it already exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Trigger for user updates (e.g. metadata updates)
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE OF email, raw_user_meta_data ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

