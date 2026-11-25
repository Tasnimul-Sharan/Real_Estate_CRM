export function resolveDirectDatabaseUrl(databaseUrl: string, explicitDirect?: unknown): string {
  if (typeof explicitDirect === 'string' && /^postgres(ql)?:\/\//.test(explicitDirect)) {
    return explicitDirect;
  }
  return databaseUrl.replace(/-pooler(\.[^/?]+neon\.tech)/i, '$1');
}

export function validateEnvironment(env: Record<string, unknown>) {
  if (typeof env.DATABASE_URL !== 'string' || !/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL');
  }
  const directUrl = resolveDirectDatabaseUrl(env.DATABASE_URL, env.DATABASE_URL_UNPOOLED);
  env.DATABASE_URL_UNPOOLED = directUrl;
  process.env.DATABASE_URL_UNPOOLED ??= directUrl;

  const secret = String(env.JWT_SECRET ?? '');
  if (secret.length < 32 || /change.this|dev.secret|replace.with/i.test(secret)) {
    throw new Error('JWT_SECRET must be a unique random secret of at least 32 characters');
  }
  const origins = String(env.CORS_ORIGIN ?? '').split(',').map((x) => x.trim());
  if (
    !origins.length ||
    origins.some((x) => {
      try {
        const u = new URL(x);
        return !['http:', 'https:'].includes(u.protocol) || u.origin !== x;
      } catch {
        return true;
      }
    })
  ) {
    throw new Error('CORS_ORIGIN must contain explicit HTTP(S) origins');
  }
  return env;
}
