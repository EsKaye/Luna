// CombatSystem.h
// FPS Combat System Header for Celestial Syndicate
// Quantum Documentation: Provides quantum-level detail for all combat system interfaces
// Feature Context: Defines the complete combat system architecture for FPS gameplay
// Dependencies: Unreal Engine, AI system, weapon system, damage system
// Usage Example: Integrated with player controller and AI character classes
// Security: Validates all combat inputs and prevents unauthorized actions
// Performance: Optimized for real-time multiplayer with efficient networking

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Engine/DataTable.h"
#include "Particles/ParticleSystem.h"
#include "Sound/SoundBase.h"
#include "Animation/AnimMontage.h"
#include "Blueprint/UserWidget.h"
#include "CombatSystem.generated.h"

// Forward declarations
class AWeapon;
class AAICharacter;
class UDamageNumber;

// Weapon types enumeration
UENUM(BlueprintType)
enum class EWeaponType : uint8
{
    PulseRifle     UMETA(DisplayName = "Pulse Rifle"),
    PlasmaCannon   UMETA(DisplayName = "Plasma Cannon"),
    QuantumBlaster UMETA(DisplayName = "Quantum Blaster"),
    LaserRifle     UMETA(DisplayName = "Laser Rifle"),
    IonCannon      UMETA(DisplayName = "Ion Cannon"),
    MissileLauncher UMETA(DisplayName = "Missile Launcher")
};

// Combat actions enumeration
UENUM(BlueprintType)
enum class ECombatAction : uint8
{
    WeaponFired    UMETA(DisplayName = "Weapon Fired"),
    DamageTaken    UMETA(DisplayName = "Damage Taken"),
    TargetAcquired UMETA(DisplayName = "Target Acquired"),
    TargetLost     UMETA(DisplayName = "Target Lost"),
    CoverTaken     UMETA(DisplayName = "Cover Taken"),
    ReloadStarted  UMETA(DisplayName = "Reload Started"),
    ReloadComplete UMETA(DisplayName = "Reload Complete")
};

// Weapon data structure
USTRUCT(BlueprintType)
struct FWeaponData
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    EWeaponType WeaponType;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString WeaponName;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 MaxAmmo;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float Damage;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float FireRate;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float Range;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float ReloadTime;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TSubclassOf<AWeapon> WeaponClass;

    FWeaponData()
    {
        WeaponType = EWeaponType::PulseRifle;
        WeaponName = TEXT("Default Weapon");
        MaxAmmo = 30;
        Damage = 100.0f;
        FireRate = 0.1f;
        Range = 800.0f;
        ReloadTime = 2.0f;
        WeaponClass = nullptr;
    }
};

// AI combat data structure
USTRUCT(BlueprintType)
struct FAICombatData
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float CombatRange;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float TacticalRange;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float CoverPreference;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float AggressionLevel;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float LastTargetUpdateTime;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FVector LastKnownTargetLocation;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    bool bHasLineOfSight;

    void UpdateCombatState(float DeltaTime)
    {
        LastTargetUpdateTime += DeltaTime;
    }

    FAICombatData()
    {
        CombatRange = 1000.0f;
        TacticalRange = 500.0f;
        CoverPreference = 0.7f;
        AggressionLevel = 0.5f;
        LastTargetUpdateTime = 0.0f;
        LastKnownTargetLocation = FVector::ZeroVector;
        bHasLineOfSight = false;
    }
};

// Combat statistics structure
USTRUCT(BlueprintType)
struct FCombatStats
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Kills;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Deaths;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Assists;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float TotalDamageDealt;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float TotalDamageTaken;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 ShotsFired;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 ShotsHit;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 TargetsHit;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float Accuracy;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float KillDeathRatio;

    void UpdateAccuracy()
    {
        if (ShotsFired > 0)
        {
            Accuracy = (float)ShotsHit / (float)ShotsFired * 100.0f;
        }
    }

    void UpdateKDRatio()
    {
        if (Deaths > 0)
        {
            KillDeathRatio = (float)Kills / (float)Deaths;
        }
        else
        {
            KillDeathRatio = (float)Kills;
        }
    }

    FCombatStats()
    {
        Kills = 0;
        Deaths = 0;
        Assists = 0;
        TotalDamageDealt = 0.0f;
        TotalDamageTaken = 0.0f;
        ShotsFired = 0;
        ShotsHit = 0;
        TargetsHit = 0;
        Accuracy = 0.0f;
        KillDeathRatio = 0.0f;
    }
};

// Combat events delegate declarations
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnHealthChanged, float, NewHealth);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnHealthChangedWithMax, float, NewHealth, float, MaxHealth);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnShieldChanged, float, NewShield, float, MaxShield);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnWeaponEquipped, AWeapon*, Weapon);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnCombatAction, ECombatAction, Action);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnDeath, AActor*, Killer);

// Main combat system component
UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class CELESTIALSYNDICATE_API UCombatSystem : public UActorComponent
{
    GENERATED_BODY()

public:
    UCombatSystem();

protected:
    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

public:
    // Health and Shield Management
    UFUNCTION(BlueprintCallable, Category = "Combat|Health")
    void TakeDamage(float Damage, AActor* DamageCauser);

    UFUNCTION(BlueprintCallable, Category = "Combat|Health")
    void Heal(float Amount);

    UFUNCTION(BlueprintCallable, Category = "Combat|Shield")
    void RechargeShield();

    UFUNCTION(BlueprintPure, Category = "Combat|Health")
    float GetCurrentHealth() const { return CurrentHealth; }

    UFUNCTION(BlueprintPure, Category = "Combat|Health")
    float GetMaxHealth() const { return MaxHealth; }

    UFUNCTION(BlueprintPure, Category = "Combat|Shield")
    float GetCurrentShield() const { return CurrentShield; }

    UFUNCTION(BlueprintPure, Category = "Combat|Shield")
    float GetMaxShield() const { return ShieldCapacity; }

    // Weapon Management
    UFUNCTION(BlueprintCallable, Category = "Combat|Weapons")
    void EquipWeapon(int32 WeaponIndex);

    UFUNCTION(BlueprintCallable, Category = "Combat|Weapons")
    void FireWeapon();

    UFUNCTION(BlueprintCallable, Category = "Combat|Weapons")
    void ReloadWeapon();

    UFUNCTION(BlueprintCallable, Category = "Combat|Weapons")
    void SwitchWeapon(int32 WeaponIndex);

    UFUNCTION(BlueprintPure, Category = "Combat|Weapons")
    AWeapon* GetCurrentWeapon() const { return CurrentWeapon; }

    UFUNCTION(BlueprintPure, Category = "Combat|Weapons")
    bool IsReloading() const { return bIsReloading; }

    UFUNCTION(BlueprintPure, Category = "Combat|Weapons")
    bool CanFire() const;

    // AI Combat Functions
    UFUNCTION(BlueprintCallable, Category = "Combat|AI")
    void InitializeAICombat(AAICharacter* AICharacter);

    UFUNCTION(BlueprintCallable, Category = "Combat|AI")
    void UpdateAICombat(AAICharacter* AICharacter, float DeltaTime);

    UFUNCTION(BlueprintCallable, Category = "Combat|AI")
    void SearchForTargets(AAICharacter* AICharacter);

    UFUNCTION(BlueprintCallable, Category = "Combat|AI")
    void MakeCombatDecision(AAICharacter* AICharacter, AActor* Target);

    // Combat State
    UFUNCTION(BlueprintPure, Category = "Combat|State")
    bool IsInCombat() const { return bIsInCombat; }

    UFUNCTION(BlueprintPure, Category = "Combat|State")
    bool IsAlive() const { return CurrentHealth > 0.0f; }

    // Combat Statistics
    UFUNCTION(BlueprintPure, Category = "Combat|Stats")
    FCombatStats GetCombatStats() const { return CombatStats; }

    UFUNCTION(BlueprintCallable, Category = "Combat|Stats")
    void ResetCombatStats();

protected:
    // Health and Shield Properties
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Health", Replicated)
    float MaxHealth;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Health", Replicated)
    float CurrentHealth;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Shield", Replicated)
    float ShieldCapacity;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Shield", Replicated)
    float CurrentShield;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Shield")
    float ShieldRechargeRate;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Shield")
    float ShieldRechargeDelay;

    // Weapon System
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Weapons")
    TArray<AWeapon*> WeaponInventory;

    UPROPERTY(BlueprintReadOnly, Category = "Combat|Weapons")
    AWeapon* CurrentWeapon;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Weapons")
    bool bIsReloading;

    // Combat State
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|State", Replicated)
    bool bIsInCombat;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|State")
    float LastDamageTime;

    // AI Combat Data
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|AI")
    FAICombatData AICombatData;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|AI")
    float CombatRange;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|AI")
    float TacticalRange;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|AI")
    float CoverPreference;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|AI")
    float AggressionLevel;

    // Combat Statistics
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Stats")
    FCombatStats CombatStats;

    // Effects and Sounds
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Effects")
    UParticleSystem* ImpactEffect;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Effects")
    UParticleSystem* DamageEffect;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Effects")
    UParticleSystem* ShieldHitEffect;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Effects")
    UParticleSystem* DeathEffect;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Effects")
    UParticleSystem* MuzzleFlashEffect;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Sounds")
    USoundBase* ImpactSound;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Sounds")
    USoundBase* DamageSound;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Sounds")
    USoundBase* ShieldHitSound;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Sounds")
    USoundBase* DeathSound;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Sounds")
    USoundBase* WeaponFireSound;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Sounds")
    USoundBase* ReloadSound;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Sounds")
    USoundBase* ReloadCompleteSound;

    // Animations
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Animations")
    UAnimMontage* ReloadMontage;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|Animations")
    UAnimMontage* DeathMontage;

    // UI Elements
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat|UI")
    TSubclassOf<UDamageNumber> DamageNumberClass;

    // Timers
    FTimerHandle ShieldRechargeTimer;
    FTimerHandle ReloadTimer;

    // Combat Events
    UPROPERTY(BlueprintAssignable, Category = "Combat|Events")
    FOnHealthChangedWithMax OnHealthChanged;

    UPROPERTY(BlueprintAssignable, Category = "Combat|Events")
    FOnShieldChanged OnShieldChanged;

    UPROPERTY(BlueprintAssignable, Category = "Combat|Events")
    FOnWeaponEquipped OnWeaponEquipped;

    UPROPERTY(BlueprintAssignable, Category = "Combat|Events")
    FOnCombatAction OnCombatAction;

    UPROPERTY(BlueprintAssignable, Category = "Combat|Events")
    FOnDeath OnDeath;

private:
    // Internal helper functions
    void InitializeWeaponSystems();
    AWeapon* CreateWeapon(const FWeaponData& WeaponData);
    void ApplyDamage(AActor* Target, float Damage, const FHitResult& HitResult);
    float CalculateDamage(float BaseDamage, const FHitResult& HitResult);
    void Die(AActor* Killer);
    void FinishReload();

    // AI Combat helpers
    void UpdateTargetTracking(AActor* Target);
    FVector PredictTargetLocation(const FVector& CurrentLocation, const FVector& Velocity);
    void UpdateAim(const FVector& TargetLocation);
    bool ShouldTakeCover(AAICharacter* AICharacter, AActor* Target);
    bool IsValidTarget(AActor* Actor);
    float CalculateTargetScore(AAICharacter* AICharacter, AActor* Target);

    // Effect functions
    void SpawnImpactEffects(const FHitResult& HitResult);
    void SpawnDamageEffects(AActor* Target, float Damage, const FHitResult& HitResult);
    void ShowDamageNumber(AActor* Target, float Damage, const FVector& Location);
    void PlayWeaponEffects();
    void PlayShieldHitEffect();
    void PlayDamageEffect();
    void SpawnDeathEffects();
    void PlayReloadSound();
    void PlayReloadCompleteSound();

    // State management
    void UpdateCombatState(float DeltaTime);
    void UpdateWeaponEffects(float DeltaTime);
    void UpdateCombatStats(float Damage, AActor* Target);
    void NotifyCombatAction(ECombatAction Action);

    // Networking
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
}; 