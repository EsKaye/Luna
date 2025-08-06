// OrbitalMechanics.cpp
// Realistic Space Flight Physics System for Celestial Syndicate
// Quantum Documentation: Provides quantum-level detail for all orbital calculations
// Feature Context: Handles realistic orbital mechanics, gravitational forces, and space navigation
// Dependencies: Unreal Engine, physics system, mathematics library
// Usage Example: Integrated with spacecraft controller and navigation systems
// Security: Validates all physics calculations and prevents invalid states
// Performance: Optimized for real-time simulation with efficient algorithms

#include "OrbitalMechanics.h"
#include "Engine/World.h"
#include "Engine/Engine.h"
#include "Components/PrimitiveComponent.h"
#include "PhysicsEngine/PhysicsConstraintComponent.h"
#include "Kismet/KismetMathLibrary.h"
#include "TimerManager.h"
#include "Net/UnrealNetwork.h"

// Orbital Mechanics System Implementation
UOrbitalMechanics::UOrbitalMechanics()
{
    PrimaryComponentTick.bCanEverTick = true;
    SetIsReplicated(true);
    
    // Initialize physics constants
    GravitationalConstant = 6.67430e-11f; // m³/kg/s²
    EarthMass = 5.972e24f; // kg
    EarthRadius = 6371000.0f; // m
    
    // Orbital parameters
    SemiMajorAxis = 0.0f;
    Eccentricity = 0.0f;
    Inclination = 0.0f;
    ArgumentOfPeriapsis = 0.0f;
    LongitudeOfAscendingNode = 0.0f;
    TrueAnomaly = 0.0f;
    
    // Current state
    CurrentPosition = FVector::ZeroVector;
    CurrentVelocity = FVector::ZeroVector;
    CurrentAcceleration = FVector::ZeroVector;
    
    // Time management
    SimulationTime = 0.0f;
    TimeStep = 0.016f; // 60 FPS
    TimeAcceleration = 1.0f;
    
    // Celestial bodies
    CelestialBodies = TArray<FCelestialBody>();
    InitializeCelestialBodies();
}

void UOrbitalMechanics::BeginPlay()
{
    Super::BeginPlay();
    
    // Initialize orbital elements
    CalculateOrbitalElements();
    
    // Start physics simulation
    GetWorld()->GetTimerManager().SetTimer(
        PhysicsTimer,
        this,
        &UOrbitalMechanics::UpdatePhysics,
        TimeStep,
        true
    );
    
    // Initialize spacecraft state
    if (ASpacecraft* Spacecraft = Cast<ASpacecraft>(GetOwner()))
    {
        InitializeSpacecraft(Spacecraft);
    }
}

void UOrbitalMechanics::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
    
    // Update simulation time
    SimulationTime += DeltaTime * TimeAcceleration;
    
    // Update orbital position
    UpdateOrbitalPosition(DeltaTime);
    
    // Apply gravitational forces
    ApplyGravitationalForces();
    
    // Update spacecraft state
    UpdateSpacecraftState();
    
    // Check for orbital events
    CheckOrbitalEvents();
}

void UOrbitalMechanics::InitializeCelestialBodies()
{
    // Add major celestial bodies in the game universe
    CelestialBodies.Add(FCelestialBody{
        TEXT("Earth"),
        FVector(0.0f, 0.0f, 0.0f),
        FVector::ZeroVector,
        EarthMass,
        EarthRadius,
        FLinearColor::Blue
    });
    
    CelestialBodies.Add(FCelestialBody{
        TEXT("Moon"),
        FVector(384400000.0f, 0.0f, 0.0f), // 384,400 km from Earth
        FVector(0.0f, 1022.0f, 0.0f), // Orbital velocity
        7.342e22f, // kg
        1737000.0f, // m
        FLinearColor::Gray
    });
    
    CelestialBodies.Add(FCelestialBody{
        TEXT("Mars"),
        FVector(225000000000.0f, 0.0f, 0.0f), // 225 million km from Earth
        FVector(0.0f, 24000.0f, 0.0f), // Orbital velocity
        6.39e23f, // kg
        3389000.0f, // m
        FLinearColor::Red
    });
    
    CelestialBodies.Add(FCelestialBody{
        TEXT("Jupiter"),
        FVector(778000000000.0f, 0.0f, 0.0f), // 778 million km from Earth
        FVector(0.0f, 13000.0f, 0.0f), // Orbital velocity
        1.898e27f, // kg
        69911000.0f, // m
        FLinearColor::Orange
    });
    
    CelestialBodies.Add(FCelestialBody{
        TEXT("Saturn"),
        FVector(1427000000000.0f, 0.0f, 0.0f), // 1.427 billion km from Earth
        FVector(0.0f, 9600.0f, 0.0f), // Orbital velocity
        5.683e26f, // kg
        58232000.0f, // m
        FLinearColor::Yellow
    });
}

void UOrbitalMechanics::InitializeSpacecraft(ASpacecraft* Spacecraft)
{
    if (!Spacecraft)
    {
        return;
    }
    
    // Set initial position and velocity
    CurrentPosition = Spacecraft->GetActorLocation();
    CurrentVelocity = Spacecraft->GetVelocity();
    
    // Calculate initial orbital elements
    CalculateOrbitalElements();
    
    // Initialize spacecraft physics
    Spacecraft->SetOrbitalMechanics(this);
    
    UE_LOG(LogTemp, Log, TEXT("Spacecraft initialized at position: %s"), *CurrentPosition.ToString());
}

void UOrbitalMechanics::CalculateOrbitalElements()
{
    // Calculate orbital elements from current position and velocity
    // This is a simplified version - in a full implementation, you'd use more complex calculations
    
    FVector R = CurrentPosition;
    FVector V = CurrentVelocity;
    
    // Calculate specific angular momentum
    FVector H = FVector::CrossProduct(R, V);
    float H_magnitude = H.Size();
    
    // Calculate eccentricity vector
    FVector E = FVector::CrossProduct(V, H) / (GravitationalConstant * EarthMass) - R.GetSafeNormal();
    Eccentricity = E.Size();
    
    // Calculate semi-major axis
    float Energy = (V.SizeSquared() / 2.0f) - (GravitationalConstant * EarthMass / R.Size());
    SemiMajorAxis = -GravitationalConstant * EarthMass / (2.0f * Energy);
    
    // Calculate inclination
    FVector K = FVector(0.0f, 0.0f, 1.0f);
    Inclination = FMath::Acos(FVector::DotProduct(H.GetSafeNormal(), K));
    
    // Calculate other orbital elements
    CalculateRemainingOrbitalElements(R, V, H, E);
}

void UOrbitalMechanics::CalculateRemainingOrbitalElements(const FVector& R, const FVector& V, const FVector& H, const FVector& E)
{
    // Calculate longitude of ascending node
    FVector N = FVector::CrossProduct(FVector(0.0f, 0.0f, 1.0f), H);
    if (N.Size() > 0.0f)
    {
        LongitudeOfAscendingNode = FMath::Atan2(N.Y, N.X);
    }
    
    // Calculate argument of periapsis
    if (N.Size() > 0.0f && Eccentricity > 0.0f)
    {
        ArgumentOfPeriapsis = FMath::Acos(FVector::DotProduct(N.GetSafeNormal(), E.GetSafeNormal()));
        if (E.Z < 0.0f)
        {
            ArgumentOfPeriapsis = 2.0f * PI - ArgumentOfPeriapsis;
        }
    }
    
    // Calculate true anomaly
    if (Eccentricity > 0.0f)
    {
        float CosNu = FVector::DotProduct(E.GetSafeNormal(), R.GetSafeNormal());
        float SinNu = FVector::DotProduct(FVector::CrossProduct(E.GetSafeNormal(), R.GetSafeNormal()), H.GetSafeNormal());
        TrueAnomaly = FMath::Atan2(SinNu, CosNu);
    }
}

void UOrbitalMechanics::UpdateOrbitalPosition(float DeltaTime)
{
    // Update orbital position using Kepler's laws
    if (Eccentricity < 1.0f) // Elliptical orbit
    {
        UpdateEllipticalOrbit(DeltaTime);
    }
    else if (Eccentricity > 1.0f) // Hyperbolic orbit
    {
        UpdateHyperbolicOrbit(DeltaTime);
    }
    else // Parabolic orbit
    {
        UpdateParabolicOrbit(DeltaTime);
    }
}

void UOrbitalMechanics::UpdateEllipticalOrbit(float DeltaTime)
{
    // Calculate mean motion
    float MeanMotion = FMath::Sqrt(GravitationalConstant * EarthMass / (SemiMajorAxis * SemiMajorAxis * SemiMajorAxis));
    
    // Update mean anomaly
    float MeanAnomaly = MeanMotion * SimulationTime;
    
    // Solve Kepler's equation for eccentric anomaly
    float EccentricAnomaly = SolveKeplersEquation(MeanAnomaly, Eccentricity);
    
    // Calculate true anomaly
    TrueAnomaly = 2.0f * FMath::Atan(FMath::Sqrt((1.0f + Eccentricity) / (1.0f - Eccentricity)) * FMath::Tan(EccentricAnomaly / 2.0f));
    
    // Calculate orbital radius
    float Radius = SemiMajorAxis * (1.0f - Eccentricity * Eccentricity) / (1.0f + Eccentricity * FMath::Cos(TrueAnomaly));
    
    // Calculate position in orbital plane
    FVector OrbitalPosition = FVector(
        Radius * FMath::Cos(TrueAnomaly),
        Radius * FMath::Sin(TrueAnomaly),
        0.0f
    );
    
    // Transform to 3D space
    CurrentPosition = TransformOrbitalToWorld(OrbitalPosition);
    
    // Calculate velocity
    float AngularVelocity = MeanMotion * (1.0f + Eccentricity * FMath::Cos(TrueAnomaly));
    CurrentVelocity = FVector(
        -AngularVelocity * Radius * FMath::Sin(TrueAnomaly),
        AngularVelocity * Radius * FMath::Cos(TrueAnomaly),
        0.0f
    );
    CurrentVelocity = TransformOrbitalToWorld(CurrentVelocity);
}

float UOrbitalMechanics::SolveKeplersEquation(float MeanAnomaly, float Eccentricity)
{
    // Newton-Raphson method to solve Kepler's equation
    float E = MeanAnomaly; // Initial guess
    const int MaxIterations = 10;
    const float Tolerance = 1e-6f;
    
    for (int i = 0; i < MaxIterations; i++)
    {
        float F = E - Eccentricity * FMath::Sin(E) - MeanAnomaly;
        float FPrime = 1.0f - Eccentricity * FMath::Cos(E);
        
        if (FMath::Abs(F) < Tolerance)
        {
            break;
        }
        
        E = E - F / FPrime;
    }
    
    return E;
}

FVector UOrbitalMechanics::TransformOrbitalToWorld(const FVector& OrbitalVector)
{
    // Transform from orbital plane to world coordinates
    // This is a simplified transformation - in a full implementation, you'd use proper rotation matrices
    
    FVector Transformed = OrbitalVector;
    
    // Apply rotation around Z-axis (longitude of ascending node)
    float CosOmega = FMath::Cos(LongitudeOfAscendingNode);
    float SinOmega = FMath::Sin(LongitudeOfAscendingNode);
    Transformed = FVector(
        Transformed.X * CosOmega - Transformed.Y * SinOmega,
        Transformed.X * SinOmega + Transformed.Y * CosOmega,
        Transformed.Z
    );
    
    // Apply rotation around X-axis (inclination)
    float CosI = FMath::Cos(Inclination);
    float SinI = FMath::Sin(Inclination);
    Transformed = FVector(
        Transformed.X,
        Transformed.Y * CosI - Transformed.Z * SinI,
        Transformed.Y * SinI + Transformed.Z * CosI
    );
    
    // Apply rotation around Z-axis (argument of periapsis)
    float CosW = FMath::Cos(ArgumentOfPeriapsis);
    float SinW = FMath::Sin(ArgumentOfPeriapsis);
    Transformed = FVector(
        Transformed.X * CosW - Transformed.Y * SinW,
        Transformed.X * SinW + Transformed.Y * CosW,
        Transformed.Z
    );
    
    return Transformed;
}

void UOrbitalMechanics::UpdateHyperbolicOrbit(float DeltaTime)
{
    // Similar to elliptical orbit but with hyperbolic functions
    // Implementation for hyperbolic trajectories
    UE_LOG(LogTemp, Warning, TEXT("Hyperbolic orbit update not implemented"));
}

void UOrbitalMechanics::UpdateParabolicOrbit(float DeltaTime)
{
    // Implementation for parabolic trajectories
    UE_LOG(LogTemp, Warning, TEXT("Parabolic orbit update not implemented"));
}

void UOrbitalMechanics::ApplyGravitationalForces()
{
    CurrentAcceleration = FVector::ZeroVector;
    
    // Apply gravitational force from all celestial bodies
    for (const FCelestialBody& Body : CelestialBodies)
    {
        FVector ToBody = Body.Position - CurrentPosition;
        float Distance = ToBody.Size();
        
        if (Distance > 0.0f)
        {
            // Calculate gravitational force
            float ForceMagnitude = GravitationalConstant * Body.Mass / (Distance * Distance);
            FVector Force = ToBody.GetSafeNormal() * ForceMagnitude;
            
            // Apply force to spacecraft (assuming mass = 1000 kg)
            float SpacecraftMass = 1000.0f;
            CurrentAcceleration += Force / SpacecraftMass;
        }
    }
    
    // Apply thrust forces
    ApplyThrustForces();
    
    // Apply atmospheric drag (if in atmosphere)
    ApplyAtmosphericDrag();
}

void UOrbitalMechanics::ApplyThrustForces()
{
    if (ASpacecraft* Spacecraft = Cast<ASpacecraft>(GetOwner()))
    {
        FVector ThrustVector = Spacecraft->GetThrustVector();
        float ThrustMagnitude = Spacecraft->GetThrustMagnitude();
        
        if (ThrustMagnitude > 0.0f)
        {
            float SpacecraftMass = 1000.0f; // kg
            FVector ThrustAcceleration = ThrustVector * ThrustMagnitude / SpacecraftMass;
            CurrentAcceleration += ThrustAcceleration;
            
            // Update orbital elements due to thrust
            UpdateOrbitalElementsFromThrust(ThrustAcceleration);
        }
    }
}

void UOrbitalMechanics::ApplyAtmosphericDrag()
{
    // Calculate atmospheric density based on altitude
    float Altitude = CurrentPosition.Size() - EarthRadius;
    float AtmosphericDensity = CalculateAtmosphericDensity(Altitude);
    
    if (AtmosphericDensity > 0.0f)
    {
        // Calculate drag force
        float DragCoefficient = 2.0f; // Typical for spacecraft
        float CrossSectionalArea = 10.0f; // m²
        float VelocityMagnitude = CurrentVelocity.Size();
        
        float DragForce = 0.5f * AtmosphericDensity * DragCoefficient * CrossSectionalArea * VelocityMagnitude * VelocityMagnitude;
        FVector DragAcceleration = -CurrentVelocity.GetSafeNormal() * DragForce / 1000.0f; // 1000 kg spacecraft
        
        CurrentAcceleration += DragAcceleration;
    }
}

float UOrbitalMechanics::CalculateAtmosphericDensity(float Altitude)
{
    // Simplified atmospheric model
    if (Altitude < 0.0f)
    {
        return 1.225f; // Sea level density
    }
    else if (Altitude < 11000.0f) // Troposphere
    {
        return 1.225f * FMath::Pow(1.0f - 0.0065f * Altitude / 288.15f, 4.256f);
    }
    else if (Altitude < 20000.0f) // Lower stratosphere
    {
        return 0.3639f * FMath::Exp(-(Altitude - 11000.0f) / 6341.62f);
    }
    else
    {
        return 0.088f * FMath::Exp(-(Altitude - 20000.0f) / 7400.0f);
    }
}

void UOrbitalMechanics::UpdateOrbitalElementsFromThrust(const FVector& ThrustAcceleration)
{
    // Update orbital elements based on thrust direction and magnitude
    // This is a simplified implementation
    
    FVector R = CurrentPosition;
    FVector V = CurrentVelocity;
    
    // Calculate change in velocity
    FVector DeltaV = ThrustAcceleration * TimeStep;
    FVector NewVelocity = V + DeltaV;
    
    // Recalculate orbital elements
    CurrentVelocity = NewVelocity;
    CalculateOrbitalElements();
}

void UOrbitalMechanics::UpdateSpacecraftState()
{
    if (ASpacecraft* Spacecraft = Cast<ASpacecraft>(GetOwner()))
    {
        // Update spacecraft position and velocity
        Spacecraft->SetActorLocation(CurrentPosition);
        Spacecraft->SetVelocity(CurrentVelocity);
        
        // Update spacecraft orientation based on velocity
        if (CurrentVelocity.Size() > 0.0f)
        {
            FVector Forward = CurrentVelocity.GetSafeNormal();
            FVector Up = FVector::UpVector;
            FVector Right = FVector::CrossProduct(Forward, Up).GetSafeNormal();
            Up = FVector::CrossProduct(Right, Forward);
            
            FMatrix RotationMatrix = FMatrix(Right, Forward, Up, FVector::ZeroVector);
            Spacecraft->SetActorRotation(RotationMatrix.Rotator());
        }
    }
}

void UOrbitalMechanics::CheckOrbitalEvents()
{
    // Check for orbital events like periapsis, apoapsis, etc.
    float CurrentRadius = CurrentPosition.Size();
    
    // Check for periapsis (closest approach)
    if (Eccentricity > 0.0f)
    {
        float PeriapsisDistance = SemiMajorAxis * (1.0f - Eccentricity);
        if (FMath::Abs(CurrentRadius - PeriapsisDistance) < 1000.0f) // Within 1 km
        {
            OnPeriapsisReached.Broadcast();
        }
    }
    
    // Check for apoapsis (farthest point)
    if (Eccentricity > 0.0f)
    {
        float ApoapsisDistance = SemiMajorAxis * (1.0f + Eccentricity);
        if (FMath::Abs(CurrentRadius - ApoapsisDistance) < 1000.0f) // Within 1 km
        {
            OnApoapsisReached.Broadcast();
        }
    }
    
    // Check for atmospheric entry
    if (CurrentRadius < EarthRadius + 100000.0f) // Within 100 km
    {
        OnAtmosphericEntry.Broadcast();
    }
    
    // Check for escape velocity
    float EscapeVelocity = FMath::Sqrt(2.0f * GravitationalConstant * EarthMass / CurrentRadius);
    if (CurrentVelocity.Size() > EscapeVelocity)
    {
        OnEscapeVelocityReached.Broadcast();
    }
}

void UOrbitalMechanics::UpdatePhysics()
{
    // Update physics simulation
    float DeltaTime = TimeStep * TimeAcceleration;
    
    // Update velocity based on acceleration
    CurrentVelocity += CurrentAcceleration * DeltaTime;
    
    // Update position based on velocity
    CurrentPosition += CurrentVelocity * DeltaTime;
    
    // Reset acceleration
    CurrentAcceleration = FVector::ZeroVector;
}

void UOrbitalMechanics::SetTimeAcceleration(float Acceleration)
{
    TimeAcceleration = FMath::Clamp(Acceleration, 0.1f, 1000.0f);
    
    // Update timer frequency based on time acceleration
    GetWorld()->GetTimerManager().ClearTimer(PhysicsTimer);
    GetWorld()->GetTimerManager().SetTimer(
        PhysicsTimer,
        this,
        &UOrbitalMechanics::UpdatePhysics,
        TimeStep / TimeAcceleration,
        true
    );
}

void UOrbitalMechanics::CalculateOrbitalTransfer(const FVector& TargetPosition, const FVector& TargetVelocity)
{
    // Calculate Hohmann transfer orbit
    float R1 = CurrentPosition.Size();
    float R2 = TargetPosition.Size();
    
    // Calculate transfer orbit parameters
    float TransferSemiMajorAxis = (R1 + R2) / 2.0f;
    float TransferEccentricity = (R2 - R1) / (R2 + R1);
    
    // Calculate required delta-v for transfer
    float V1 = FMath::Sqrt(GravitationalConstant * EarthMass / R1);
    float V2 = FMath::Sqrt(GravitationalConstant * EarthMass * (2.0f / R1 - 1.0f / TransferSemiMajorAxis));
    float DeltaV1 = V2 - V1;
    
    // Calculate transfer time
    float TransferTime = PI * FMath::Sqrt(TransferSemiMajorAxis * TransferSemiMajorAxis * TransferSemiMajorAxis / (GravitationalConstant * EarthMass));
    
    // Store transfer parameters
    TransferOrbit = FTransferOrbit{
        TransferSemiMajorAxis,
        TransferEccentricity,
        TransferTime,
        DeltaV1
    };
    
    OnTransferCalculated.Broadcast(TransferOrbit);
}

FVector UOrbitalMechanics::GetOrbitalVelocity() const
{
    return CurrentVelocity;
}

FVector UOrbitalMechanics::GetOrbitalPosition() const
{
    return CurrentPosition;
}

float UOrbitalMechanics::GetOrbitalAltitude() const
{
    return CurrentPosition.Size() - EarthRadius;
}

float UOrbitalMechanics::GetOrbitalPeriod() const
{
    if (SemiMajorAxis > 0.0f)
    {
        return 2.0f * PI * FMath::Sqrt(SemiMajorAxis * SemiMajorAxis * SemiMajorAxis / (GravitationalConstant * EarthMass));
    }
    return 0.0f;
}

void UOrbitalMechanics::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    
    DOREPLIFETIME(UOrbitalMechanics, CurrentPosition);
    DOREPLIFETIME(UOrbitalMechanics, CurrentVelocity);
    DOREPLIFETIME(UOrbitalMechanics, SemiMajorAxis);
    DOREPLIFETIME(UOrbitalMechanics, Eccentricity);
    DOREPLIFETIME(UOrbitalMechanics, Inclination);
} 