using UnityEngine;

/// <summary>
/// Serafina handles communications & routing, dispatching blessings on
/// request.
/// </summary>
public class SerafinaGuardian : GuardianBase
{
    void Start()
    {
        GuardianName = "Serafina";
        Role = "Comms & Routing";
    }

    /// <inheritdoc />
    public override void OnMessage(string from, string message)
    {
        if (message.StartsWith("bless"))
        {
            Whisper("ShadowFlowers", "Please deliver a blessing to the hall.");
        }
    }
}
