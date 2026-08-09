const requiredEnvironmentVariables = [
  "DISCORD_TOKEN",
  "GOOGLE_SHEET_ID",
] as const;

const missing = requiredEnvironmentVariables.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.warn(
    `Skeleton started without external connections. Missing: ${missing.join(", ")}`,
  );
} else {
  console.info("Configuration detected. Discord and Sheets adapters are not implemented yet.");
}

console.info("comiketDiscord skeleton is running.");

const shutdown = (signal: string): void => {
  console.info(`Received ${signal}; shutting down.`);
  process.exit(0);
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

setInterval(() => undefined, 60_000);
