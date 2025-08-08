import fetch from 'node-fetch';

/**
 * Relays a message to the Unity ops bus via HTTP. The Unity project is
 * expected to expose a lightweight endpoint that forwards payloads to
 * LilybearOpsBus.
 */
export async function relayToUnity(to: string, message: string): Promise<void> {
  const url = process.env.UNITY_BRIDGE_URL;
  if (!url) return; // Bridge optional, fail silently if not configured

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, message }),
    });
  } catch (err) {
    // Intentionally swallow errors; network failures shouldn't crash the bot
    console.error('Unity relay failed:', err);
  }
}
