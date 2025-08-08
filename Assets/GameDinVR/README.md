# GameDinVR Scripts

## Architectural Overview
These Unity scripts establish an in-world messaging fabric for the ShadowFlower
Council. `LilybearOpsBus` acts as an event bus while individual guardians inherit
from `GuardianBase` to react to whispers. The design keeps logic modular so
additional guardians can be added without touching existing code.

## Usage
1. Add the `LilybearOpsBus` component to an empty GameObject in your scene.
2. Drop desired guardian prefabs or empty GameObjects with guardian scripts
   attached (`AthenaGuardian`, `SerafinaGuardian`, `ShadowFlowersGuardian`).
3. Optionally link UI elements like `TextMesh` to guardian fields for visual
   feedback.
4. Run the scene and invoke whispers from the Unity inspector or from the
   Serafina bot via HTTP relay.

## Further Improvements
- Persist guardian registry to allow runtime spawning/despawning
- Implement OSC bridge for live updates from MCP/Discord
- Replace `TextMesh` placeholders with UGUI or TMP components
