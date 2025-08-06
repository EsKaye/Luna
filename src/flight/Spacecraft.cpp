#include "Spacecraft.h"

ASpacecraft::ASpacecraft()
{
    PrimaryActorTick.bCanEverTick = true;

    // Create and setup components
    ShipMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("ShipMesh"));
    RootComponent = ShipMesh;

    CollisionBox = CreateDefaultSubobject<UBoxComponent>(TEXT("CollisionBox"));
    CollisionBox->SetupAttachment(RootComponent);

    // Initialize flight properties
    MaxThrust = 100000.0f;
    CurrentThrust = 0.0f;
    Mass = 1000.0f;
    DragCoefficient = 0.1f;

    // Initialize flight state
    Velocity = FVector::ZeroVector;
    Acceleration = FVector::ZeroVector;
}

void ASpacecraft::BeginPlay()
{
    Super::BeginPlay();
    InitializeComponents();
    SetupPhysics();
}

void ASpacecraft::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);
    UpdateFlightPhysics(DeltaTime);
}

void ASpacecraft::InitializeComponents()
{
    // Setup collision
    CollisionBox->SetCollisionProfileName(TEXT("PhysicsActor"));
    CollisionBox->SetSimulatePhysics(true);
    CollisionBox->SetEnableGravity(false);

    // Setup mesh
    ShipMesh->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
    ShipMesh->SetCollisionProfileName(TEXT("PhysicsActor"));
}

void ASpacecraft::SetupPhysics()
{
    // Configure physics properties
    if (UPrimitiveComponent* PrimitiveComponent = Cast<UPrimitiveComponent>(ShipMesh))
    {
        PrimitiveComponent->SetSimulatePhysics(true);
        PrimitiveComponent->SetEnableGravity(false);
        PrimitiveComponent->SetMassOverrideInKg(NAME_None, Mass);
        PrimitiveComponent->SetLinearDamping(DragCoefficient);
        PrimitiveComponent->SetAngularDamping(DragCoefficient);
    }
}

void ASpacecraft::ApplyThrust(float ThrustAmount)
{
    // Clamp thrust to valid range
    CurrentThrust = FMath::Clamp(ThrustAmount, 0.0f, MaxThrust);
    
    // Calculate thrust direction based on ship's forward vector
    FVector ThrustDirection = GetActorForwardVector();
    FVector ThrustForce = ThrustDirection * CurrentThrust;

    // Apply force to the ship
    if (UPrimitiveComponent* PrimitiveComponent = Cast<UPrimitiveComponent>(ShipMesh))
    {
        PrimitiveComponent->AddForce(ThrustForce);
    }
}

void ASpacecraft::ApplyRotation(float Pitch, float Yaw, float Roll)
{
    // Create rotation delta
    FRotator RotationDelta(Pitch, Yaw, Roll);
    
    // Apply rotation
    AddActorLocalRotation(RotationDelta);
}

void ASpacecraft::UpdateFlightPhysics(float DeltaTime)
{
    // Update velocity based on current forces
    if (UPrimitiveComponent* PrimitiveComponent = Cast<UPrimitiveComponent>(ShipMesh))
    {
        Velocity = PrimitiveComponent->GetPhysicsLinearVelocity();
        Acceleration = (Velocity - Velocity) / DeltaTime;
    }
} 