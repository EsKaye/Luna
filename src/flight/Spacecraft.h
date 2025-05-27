#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Components/StaticMeshComponent.h"
#include "Components/BoxComponent.h"
#include "Spacecraft.generated.h"

UCLASS()
class CELESTIALSYNDICATE_API ASpacecraft : public AActor
{
    GENERATED_BODY()

public:
    ASpacecraft();

    virtual void Tick(float DeltaTime) override;
    virtual void BeginPlay() override;

protected:
    // Components
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
    UStaticMeshComponent* ShipMesh;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
    UBoxComponent* CollisionBox;

    // Flight Properties
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flight")
    float MaxThrust;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flight")
    float CurrentThrust;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flight")
    float Mass;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flight")
    float DragCoefficient;

    // Flight State
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Flight")
    FVector Velocity;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Flight")
    FVector Acceleration;

    // Flight Controls
    UFUNCTION(BlueprintCallable, Category = "Flight")
    void ApplyThrust(float ThrustAmount);

    UFUNCTION(BlueprintCallable, Category = "Flight")
    void ApplyRotation(float Pitch, float Yaw, float Roll);

    UFUNCTION(BlueprintCallable, Category = "Flight")
    void UpdateFlightPhysics(float DeltaTime);

private:
    void InitializeComponents();
    void SetupPhysics();
}; 