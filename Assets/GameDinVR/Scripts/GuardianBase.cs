using UnityEngine;

/// <summary>
/// Base behaviour for all guardians, providing common message handling
/// and helper methods for whispering across the ops bus.
/// </summary>
public class GuardianBase : MonoBehaviour
{
    [Header("Identity")]
    public string GuardianName = "Guardian"; // Display name used on the bus
    public string Role = "Undefined";       // High level role description

    protected virtual void OnEnable()
    {
        if (LilybearOpsBus.I != null)
        {
            LilybearOpsBus.I.OnWhisper += HandleWhisper; // Register handler
        }
    }

    protected virtual void OnDisable()
    {
        if (LilybearOpsBus.I != null)
        {
            LilybearOpsBus.I.OnWhisper -= HandleWhisper; // Clean up
        }
    }

    /// <summary>
    /// Default whisper handler; forwards to OnMessage when addressed.
    /// </summary>
    protected virtual void HandleWhisper(string from, string to, string message)
    {
        if (to == GuardianName || to == "*")
        {
            Debug.Log($"[{GuardianName}] received from {from}: {message}");
            OnMessage(from, message);
        }
    }

    /// <summary>
    /// Override in subclasses to respond to messages.
    /// </summary>
    public virtual void OnMessage(string from, string message) { }

    /// <summary>
    /// Helper for transmitting messages via the bus.
    /// </summary>
    protected void Whisper(string to, string message)
    {
        LilybearOpsBus.I?.Say(GuardianName, to, message);
    }
}
