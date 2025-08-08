using UnityEngine;

/// <summary>
/// Athena oversees strategy & intelligence, replying with system status
/// when prompted.
/// </summary>
public class AthenaGuardian : GuardianBase
{
    void Start()
    {
        GuardianName = "Athena";
        Role = "Strategy & Intelligence";
    }

    /// <inheritdoc />
    public override void OnMessage(string from, string message)
    {
        if (message.Contains("status"))
        {
            Whisper("Lilybear", "Athena: All systems nominal.");
        }
    }
}
