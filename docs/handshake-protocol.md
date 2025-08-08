# Inter-Repo Handshake Protocol

## Purpose
Establishes a lightweight mesh between ShadowFlower Council services so each repository can announce its presence, capabilities, and version to peers. This allows autonomous nodes to discover and coordinate with each other without central orchestration.

## Message Schema
```json
{
  "name": "Serafina",                 // service identifier
  "repo": "MKWorldWide/Serafina",     // GitHub repo reference
  "version": "0.1.0",                 // semantic version
  "capabilities": ["discord-routing"], // feature flags
  "timestamp": "2024-01-01T00:00:00Z"  // ISO 8601 time
}
```

## HTTP Flow
1. Each service exposes a `POST /handshake` endpoint that accepts the message schema above.
2. On boot, services broadcast their handshake to all peer URLs defined in `HANDSHAKE_URLS` (comma‑separated).
3. Receivers may respond with `200 OK` to acknowledge and optionally record the payload for status pages or routing tables.

## Environment Variables
```
HANDSHAKE_URLS=http://peer1/handshake,http://peer2/handshake
```

## Example
Serafina announcing to Athena and Lilybear:
```
HANDSHAKE_URLS=https://athena.example.com/handshake,https://lilybear.example.com/handshake
```
On startup, Serafina sends the handshake payload to both URLs, enabling peers to register her capabilities and establish follow‑up links.

## Future Extensions
- Signed handshakes using shared secrets or public keys for authentication.
- WebSocket subscription after handshake for low-latency messaging.
- Periodic re-handshakes to update version or capability changes.

