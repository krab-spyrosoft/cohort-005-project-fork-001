// PROTOTYPE, throwaway. "What does the Notification Feed look like in Cadence?"
// (krab-spyrosoft/cohort-005-project-fork-001#22). Lives on
// prototype/notification-feed only.
import Knock, { signUserToken } from "@knocklabs/node";

if (!process.env.KNOCK_SECRET_API_KEY) {
  // Vite doesn't put non-VITE_ vars on process.env, so load .env ourselves.
  process.loadEnvFile(".env");
}

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`PROTOTYPE: ${name} missing from .env`);
  return value;
}

export const knock = new Knock({ apiKey: env("KNOCK_SECRET_API_KEY") });

export function knockUserId(cadenceUserId: number) {
  return String(cadenceUserId);
}

export async function getFeedConfig(cadenceUserId: number) {
  return {
    knockUserId: knockUserId(cadenceUserId),
    publicApiKey: env("KNOCK_PUBLIC_API_KEY"),
    feedChannelId: env("KNOCK_FEED_CHANNEL_ID"),
    userToken: await signUserToken(knockUserId(cadenceUserId), {
      signingKey: env("KNOCK_SIGNING_KEY"),
      expiresInSeconds: 60 * 60,
    }),
  };
}

export type FeedConfig = Awaited<ReturnType<typeof getFeedConfig>>;
