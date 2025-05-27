#include "SpacecraftController.h"
#include "Spacecraft.h"

ASpacecraftController::ASpacecraftController()
{
    // Initialize control properties
    ThrustSensitivity = 1.0f;
    RotationSensitivity = 1.0f;
    ControlledSpacecraft = nullptr;
}

void ASpacecraftController::BeginPlay()
{
    Super::BeginPlay();
    FindAndPossessSpacecraft();
}

void ASpacecraftController::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);
}

void ASpacecraftController::SetupInputComponent()
{
    Super::SetupInputComponent();

    // Bind thrust input
    InputComponent->BindAxis("Thrust", this, &ASpacecraftController::HandleThrustInput);

    // Bind rotation inputs
    InputComponent->BindAxis("Pitch", this, &ASpacecraftController::HandlePitchInput);
    InputComponent->BindAxis("Yaw", this, &ASpacecraftController::HandleYawInput);
    InputComponent->BindAxis("Roll", this, &ASpacecraftController::HandleRollInput);
}

void ASpacecraftController::FindAndPossessSpacecraft()
{
    // Find the first spacecraft in the level
    TArray<AActor*> FoundSpacecraft;
    UGameplayStatics::GetAllActorsOfClass(GetWorld(), ASpacecraft::StaticClass(), FoundSpacecraft);

    if (FoundSpacecraft.Num() > 0)
    {
        ControlledSpacecraft = Cast<ASpacecraft>(FoundSpacecraft[0]);
        if (ControlledSpacecraft)
        {
            Possess(ControlledSpacecraft);
        }
    }
}

void ASpacecraftController::HandleThrustInput(float Value)
{
    if (ControlledSpacecraft)
    {
        float ThrustAmount = Value * ThrustSensitivity;
        ControlledSpacecraft->ApplyThrust(ThrustAmount);
    }
}

void ASpacecraftController::HandlePitchInput(float Value)
{
    if (ControlledSpacecraft)
    {
        float PitchAmount = Value * RotationSensitivity;
        ControlledSpacecraft->ApplyRotation(PitchAmount, 0.0f, 0.0f);
    }
}

void ASpacecraftController::HandleYawInput(float Value)
{
    if (ControlledSpacecraft)
    {
        float YawAmount = Value * RotationSensitivity;
        ControlledSpacecraft->ApplyRotation(0.0f, YawAmount, 0.0f);
    }
}

void ASpacecraftController::HandleRollInput(float Value)
{
    if (ControlledSpacecraft)
    {
        float RollAmount = Value * RotationSensitivity;
        ControlledSpacecraft->ApplyRotation(0.0f, 0.0f, RollAmount);
    }
} 