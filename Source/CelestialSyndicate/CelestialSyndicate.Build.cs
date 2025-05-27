using UnrealBuildTool;

public class CelestialSyndicate : ModuleRules
{
    public CelestialSyndicate(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[] { 
            "Core", 
            "CoreUObject", 
            "Engine", 
            "InputCore",
            "EnhancedInput",
            "PhysicsControl",
            "NetworkPrediction",
            "GameplayAbilities"
        });

        PrivateDependencyModuleNames.AddRange(new string[] { });
    }
} 