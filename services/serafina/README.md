# Serafina Bot

## Architectural Overview
Serafina acts as the communications switchboard for the ShadowFlower Council. The
service bridges Discord guild channels, the MCP backend, and an optional Unity
ops bus so in-world avatars can react to council chatter. Design emphasis is on
modularity and stateless HTTP calls so sibling repositories can integrate with
minimal coupling.

### Features
- `/council-report` slash command and scheduled nightly report
- Inter-repo handshake broadcast for service discovery
- HTTP relay to Unity's `LilybearOpsBus`
- Environment-driven configuration; no secrets committed

## Setup
1. Ensure Node.js 18+ and npm are installed.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and populate values.
4. Build the TypeScript sources:
   ```bash
   npm run build
   ```
5. Start the bot:
   ```bash
   npm start
   ```

## Environment Variables
| Name | Purpose |
| ---- | ------- |
| `DISCORD_TOKEN` | Bot token used to authenticate with Discord |
| `OWNER_ID` | Discord user ID with elevated permissions |
| `GUILD_ID` | Guild where slash commands are registered |
| `MCP_URL` | Base URL of the MCP HTTP server |
| `CHN_COUNCIL` | Discord channel ID for council messages |
| `GH_REPOS` | Comma-separated list of repositories included in nightly reports |
| `UNITY_BRIDGE_URL` | Optional HTTP endpoint for Unity relay |
| `WH_LILYBEAR` | Optional webhook for pretty nightly report messages |
| `HANDSHAKE_URLS` | Comma-separated peer URLs for the startup handshake |

## Further Improvements
- Add unit tests for handshake retries and report generation
- Expose health endpoint for uptime monitoring
- Swap to structured logging library for observability
