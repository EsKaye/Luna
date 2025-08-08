using UnityEngine;

/// <summary>
/// ShadowFlowers channels sentiment & rituals, displaying blessings on
/// demand.
/// </summary>
public class ShadowFlowersGuardian : GuardianBase
{
    public TextMesh BlessingText; // Optional target for visual feedback

    void Start()
    {
        GuardianName = "ShadowFlowers";
        Role = "Sentiment & Rituals";
    }

    /// <inheritdoc />
    public override void OnMessage(string from, string message)
    {
        if (message.Contains("blessing"))
        {
            var line = "\uD83C\uDF38 May your path be protected and your heart be held.";
            if (BlessingText) BlessingText.text = line; // Render text if provided
            Whisper("Lilybear", "Blessing delivered.");
        }
    }
}
