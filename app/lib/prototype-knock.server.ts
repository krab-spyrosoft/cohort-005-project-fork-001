// PROTOTYPE — throwaway Knock spike for "Does Knock hold up against Cadence?".
// Lives on the prototype/knock-spike branch only. Never merge.
import { Knock, signUserToken } from "@knocklabs/node";

try {
  process.loadEnvFile?.(".env");
} catch {
  // .env missing — the errors below say which key is absent.
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`PROTOTYPE: ${name} is not set in .env`);
  return value;
}

export const knock = new Knock({ apiKey: env("KNOCK_SECRET_API_KEY") });

export const knockPublic = {
  publicApiKey: env("KNOCK_PUBLIC_API_KEY"),
  feedChannelId: env("KNOCK_FEED_CHANNEL_ID"),
};

export function signKnockToken(userId: string) {
  return signUserToken(userId, {
    signingKey: env("KNOCK_SIGNING_KEY"),
    expiresInSeconds: 60 * 60,
  });
}
