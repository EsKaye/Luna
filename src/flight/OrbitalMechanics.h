// OrbitalMechanics.h
// Realistic Space Flight Physics Header for Celestial Syndicate
// Quantum Documentation: Provides quantum-level detail for all orbital mechanics interfaces
// Feature Context: Defines the complete orbital mechanics system for realistic space flight
// Dependencies: Unreal Engine, physics system, mathematics library, spacecraft system
// Usage Example: Integrated with spacecraft controller and navigation systems
// Security: Validates all physics calculations and prevents invalid orbital states
// Performance: Optimized for real-time simulation with efficient numerical methods

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Engine/DataTable.h"
#include "Engine/Engine.h"
#include "OrbitalMechanics.generated.h"

// Forward declarations
class ASpacecraft;

// Celestial body structure
USTRUCT(BlueprintType)
struct FCelestialBody
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString Name;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FVector Position;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FVector Velocity;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float Mass;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float Radius;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FLinearColor Color;

    FCelestialBody()
    {
        Name = TEXT("Unknown");
        Position = FVector::ZeroVector;
        Velocity = FVector::ZeroVector;
        Mass = 0.0f;
        Radius = 0.0f;
        Color = FLinearColor::White;
    }
};

// Transfer orbit structure
USTRUCT(BlueprintType)
struct FTransferOrbit
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float SemiMajorAxis;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float Eccentricity;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float TransferTime;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float DeltaV;

    FTransferOrbit()
    {
        SemiMajorAxis = 0.0f;
        Eccentricity = 0.0f;
        TransferTime = 0.0f;
        DeltaV = 0.0f;
    }
};

// Orbital events delegate declarations
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnPeriapsisReached);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnApoapsisReached);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnAtmosphericEntry);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnEscapeVelocityReached);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnTransferCalculated, FTransferOrbit);

// Main orbital mechanics component
UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class CELESTIALSYNDICATE_API UOrbitalMechanics : public UActorComponent
{
    GENERATED_BODY()

public:
    UOrbitalMechanics();

protected:
    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

public:
    // Physics Constants
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Orbital|Physics")
    float GravitationalConstant;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Orbital|Physics")
    float EarthMass;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Orbital|Physics")
    float EarthRadius;

    // Orbital Elements
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Orbital|Elements", Replicated)
    float SemiMajorAxis;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Orbital|Elements", Replicated)
    float Eccentricity;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Orbital|Elements", Replicated)
    float Inclination;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Orbital|Elements", Replicated)
    float ArgumentOfPeriapsis;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Orbital|Elements", Replicated)
    float LongitudeOfAscendingNode;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Orbital|Elements", Replicated)
    float TrueAnomaly;

    // Current State
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Orbital|State", Replicated)
    FVector CurrentPosition;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Orbital|State", Replicated)
    FVector CurrentVelocity;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Orbital|State")
    FVector CurrentAcceleration;

    // Time Management
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Orbital|Time")
    float SimulationTime;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Orbital|Time")
    float TimeStep;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Orbital|Time")
    float TimeAcceleration;

    // Celestial Bodies
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Orbital|Bodies")
    TArray<FCelestialBody> CelestialBodies;

    // Transfer Orbit
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Orbital|Transfer")
    FTransferOrbit TransferOrbit;

    // Orbital Events
    UPROPERTY(BlueprintAssignable, Category = "Orbital|Events")
    FOnPeriapsisReached OnPeriapsisReached;

    UPROPERTY(BlueprintAssignable, Category = "Orbital|Events")
    FOnApoapsisReached OnApoapsisReached;

    UPROPERTY(BlueprintAssignable, Category = "Orbital|Events")
    FOnAtmosphericEntry OnAtmosphericEntry;

    UPROPERTY(BlueprintAssignable, Category = "Orbital|Events")
    FOnEscapeVelocityReached OnEscapeVelocityReached;

    UPROPERTY(BlueprintAssignable, Category = "Orbital|Events")
    FOnTransferCalculated OnTransferCalculated;

    // Public Functions
    UFUNCTION(BlueprintCallable, Category = "Orbital|Physics")
    void CalculateOrbitalElements();

    UFUNCTION(BlueprintCallable, Category = "Orbital|Physics")
    void UpdateOrbitalPosition(float DeltaTime);

    UFUNCTION(BlueprintCallable, Category = "Orbital|Physics")
    void ApplyGravitationalForces();

    UFUNCTION(BlueprintCallable, Category = "Orbital|Physics")
    void CalculateOrbitalTransfer(const FVector& TargetPosition, const FVector& TargetVelocity);

    UFUNCTION(BlueprintCallable, Category = "Orbital|Time")
    void SetTimeAcceleration(float Acceleration);

    UFUNCTION(BlueprintPure, Category = "Orbital|State")
    FVector GetOrbitalVelocity() const;

    UFUNCTION(BlueprintPure, Category = "Orbital|State")
    FVector GetOrbitalPosition() const;

    UFUNCTION(BlueprintPure, Category = "Orbital|State")
    float GetOrbitalAltitude() const;

    UFUNCTION(BlueprintPure, Category = "Orbital|State")
    float GetOrbitalPeriod() const;

protected:
    // Internal helper functions
    void InitializeCelestialBodies();
    void InitializeSpacecraft(ASpacecraft* Spacecraft);
    void CalculateRemainingOrbitalElements(const FVector& R, const FVector& V, const FVector& H, const FVector& E);
    void UpdateEllipticalOrbit(float DeltaTime);
    void UpdateHyperbolicOrbit(float DeltaTime);
    void UpdateParabolicOrbit(float DeltaTime);
    float SolveKeplersEquation(float MeanAnomaly, float Eccentricity);
    FVector TransformOrbitalToWorld(const FVector& OrbitalVector);
    void ApplyThrustForces();
    void ApplyAtmosphericDrag();
    float CalculateAtmosphericDensity(float Altitude);
    void UpdateOrbitalElementsFromThrust(const FVector& ThrustAcceleration);
    void UpdateSpacecraftState();
    void CheckOrbitalEvents();
    void UpdatePhysics();

    // Timers
    FTimerHandle PhysicsTimer;

    // Networking
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
}; 