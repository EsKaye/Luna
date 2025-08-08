using UnityEngine;
using System;

/// <summary>
/// Central in-world message bus enabling guardians to communicate.
/// </summary>
public class LilybearOpsBus : MonoBehaviour
{
    public static LilybearOpsBus I; // Singleton instance for easy access

    void Awake()
    {
        I = this; // Assign on scene load
    }

    /// <summary>
    /// Delegate for routing whispers across guardians.
    /// </summary>
    public delegate void Whisper(string from, string to, string message);
    public event Whisper OnWhisper;

    /// <summary>
    /// Broadcast a message to another guardian.
    /// </summary>
    public void Say(string from, string to, string message)
    {
        OnWhisper?.Invoke(from, to, message);
        Debug.Log($"[LilybearBus] {from} → {to}: {message}");
    }
}
