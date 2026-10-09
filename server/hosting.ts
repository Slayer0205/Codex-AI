export function configureHosting(env = process.env) {
  if (env.RENDER === "true") {
    if (env.DEMO_MODE !== "false")
      throw new Error("Public Render deployment requires DEMO_MODE=false");
    if (!/^postgres(ql)?:/.test(env.DATABASE_URL || ""))
      throw new Error(
        "Render requires a persistent PostgreSQL DATABASE_URL, such as Neon; local SQLite files are ephemeral",
      );
  }
  if (env.RENDER_EXTERNAL_URL) {
    const url = new URL(env.RENDER_EXTERNAL_URL);
    if (url.protocol !== "https:")
      throw new Error("RENDER_EXTERNAL_URL must use HTTPS");
    env.APP_URL ||= url.origin;
    env.WEB_APP_URL ||= env.APP_URL;
  }
}
