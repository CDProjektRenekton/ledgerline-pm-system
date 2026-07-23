// Decides whether the Postgres connection should use SSL.
//
// Render (and most managed Postgres hosts, e.g. Neon) require SSL on every
// connection, but a local/Docker Postgres does not support it at all — so
// the default behavior guesses from the hostname in DATABASE_URL.
//
// That guess breaks for Docker Compose's internal networking, where the
// database host is a service name like "postgres" rather than "localhost"
// or "127.0.0.1", even though it's just as local and just as SSL-less.
// Rather than special-case that one hostname (fragile, and "postgres"
// could theoretically appear in a real remote host), DATABASE_SSL is an
// explicit override: set it to "false" or "true" to skip the guess
// entirely. Leave it unset and every existing deployment (Render, Neon,
// native local, Podman) behaves exactly as before.
function resolveSsl(connectionString) {
  const override = (process.env.DATABASE_SSL || "").toLowerCase();
  if (override === "false") return false;
  if (override === "true") return { rejectUnauthorized: false };

  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString || "");
  return isLocal ? false : { rejectUnauthorized: false };
}

module.exports = { resolveSsl };
