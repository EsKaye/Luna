using UnityEngine;

/// <summary>
/// Placeholder for future OSC bridge; allows external services to update
/// a TextMesh within the scene.
/// </summary>
public class OSCTextBridge : MonoBehaviour
{
    public TextMesh Target; // Assigned via inspector

    /// <summary>
    /// Sets the text of the target mesh if one is assigned.
    /// </summary>
    public void SetText(string content)
    {
        if (Target)
        {
            Target.text = content;
        }
    }
}
