#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "SpacecraftController.generated.h"

class ASpacecraft;

UCLASS()
class CELESTIALSYNDICATE_API ASpacecraftController : public APlayerController
{
    GENERATED_BODY()

public:
    ASpacecraftController();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaTime) override;
    virtual void SetupInputComponent() override;

protected:
    // Input functions
    UFUNCTION()
    void HandleThrustInput(float Value);

    UFUNCTION()
    void HandlePitchInput(float Value);

    UFUNCTION()
    void HandleYawInput(float Value);

    UFUNCTION()
    void HandleRollInput(float Value);

    // Flight control properties
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flight")
    float ThrustSensitivity;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flight")
    float RotationSensitivity;

private:
    ASpacecraft* ControlledSpacecraft;
    void FindAndPossessSpacecraft();
}; 