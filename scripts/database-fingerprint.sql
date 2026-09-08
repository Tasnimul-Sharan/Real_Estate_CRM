CREATE TEMP TABLE fingerprints (table_name text, row_count bigint, digest text);
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename LOOP
    EXECUTE format('INSERT INTO fingerprints SELECT %L, count(*), md5(coalesce(string_agg(row_to_json(x)::text, E''\n'' ORDER BY row_to_json(x)::text), '''')) FROM public.%I x', t, t);
  END LOOP;
END $$;
SELECT table_name || '|' || row_count || '|' || digest FROM fingerprints ORDER BY table_name;
