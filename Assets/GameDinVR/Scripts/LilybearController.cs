using UnityEngine;

/// <summary>
/// Lilybear acts as voice & operations guardian, routing commands and
/// maintaining a debug log of the latest message.
/// </summary>
public class LilybearController : GuardianBase
{
    [TextArea]
    public string LastMessage; // Exposed for quick debugging in the inspector

    void Start()
    {
        GuardianName = "Lilybear";
        Role = "Voice & Operations";
    }

    /// <inheritdoc />
    public override void OnMessage(string from, string message)
    {
        LastMessage = $"{from}: {message}"; // Track most recent whisper

        // Basic routing demonstration – broadcast when a route command appears
        if (message.StartsWith("/route "))
        {
            var payload = message.Substring(7); // Remove command prefix
            Whisper("*", payload); // Broadcast to all guardians
        }
    }

    /// <summary>
    /// Inspector helper for quickly testing the bus wiring.
    /// </summary>
    [ContextMenu("Test Whisper")]
    void TestWhisper()
    {
        Whisper("*", "The council is assembled.");
    }
}
