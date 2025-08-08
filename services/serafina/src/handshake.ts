/**
 * Architectural Preamble
 * ----------------------
 * Defines the handshake message used for cross-repo discovery. Each service
 * announces itself to peers so the ShadowFlower Council forms a dynamic mesh.
 * The design favors stateless HTTP POSTs for simplicity and compatibility.
 */

import fetch from 'node-fetch';

/** Shape of the handshake payload exchanged between services. */
export interface HandshakePayload {
  name: string; // Unique service name, e.g., "Serafina"
  repo: string; // GitHub repository identifier
  version: string; // Semantic version of the service
  capabilities: string[]; // Feature flags advertised to peers
  timestamp: string; // ISO timestamp when handshake sent
}

/**
 * Broadcasts this service's handshake to peer URLs supplied via HANDSHAKE_URLS.
 * This lets sibling repositories discover capabilities without central
 * orchestration.
 */
export async function announceHandshake(): Promise<void> {
  const urls = (process.env.HANDSHAKE_URLS || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  if (!urls.length) return; // No peers configured

  const payload: HandshakePayload = {
    name: 'Serafina',
    repo: 'MKWorldWide/Serafina',
    version: '0.1.0',
    capabilities: ['discord-routing', 'nightly-report', 'unity-bridge'],
    timestamp: new Date().toISOString(),
  };

  await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          console.warn(`Handshake failed for ${url}: ${res.status}`);
        }
      } catch (err) {
        console.warn(`Handshake error for ${url}:`, err);
      }
    })
  );
}

/**
 * Further Improvements
 * - Sign payloads to ensure authenticity between services.
 * - Retry with exponential backoff for transient network errors.
 * - Persist peer registry to disk or a database for richer coordination.
 */
