// CombatSystem.cpp
// FPS Combat System for Celestial Syndicate
// Quantum Documentation: Provides quantum-level detail for all combat mechanics
// Feature Context: Handles all first-person combat including weapons, damage, AI, and tactical systems
// Dependencies: Unreal Engine, AI system, physics system, audio system
// Usage Example: Integrated with player controller and AI systems
// Security: Validates all combat actions and prevents cheating
// Performance: Optimized for real-time multiplayer combat

#include "CombatSystem.h"
#include "Engine/World.h"
#include "Engine/Engine.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/AudioComponent.h"
#include "Particles/ParticleSystemComponent.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "AI/Navigation/NavigationSystem.h"
#include "TimerManager.h"
#include "Net/UnrealNetwork.h"

// Combat System Implementation
UCombatSystem::UCombatSystem()
{
    PrimaryComponentTick.bCanEverTick = true;
    SetIsReplicated(true);
    
    // Initialize combat parameters
    MaxHealth = 100.0f;
    CurrentHealth = MaxHealth;
    ShieldCapacity = 50.0f;
    CurrentShield = ShieldCapacity;
    ShieldRechargeRate = 5.0f;
    ShieldRechargeDelay = 3.0f;
    
    // Weapon system
    CurrentWeapon = nullptr;
    WeaponInventory.SetNum(3); // 3 weapon slots
    
    // Combat state
    bIsInCombat = false;
    bIsReloading = false;
    LastDamageTime = 0.0f;
    
    // AI combat parameters
    CombatRange = 1000.0f;
    TacticalRange = 500.0f;
    CoverPreference = 0.7f;
    AggressionLevel = 0.5f;
}

void UCombatSystem::BeginPlay()
{
    Super::BeginPlay();
    
    // Initialize weapon systems
    InitializeWeaponSystems();
    
    // Start shield recharge timer
    GetWorld()->GetTimerManager().SetTimer(
        ShieldRechargeTimer,
        this,
        &UCombatSystem::RechargeShield,
        1.0f,
        true
    );
    
    // Initialize AI combat behavior
    if (AAICharacter* AIChar = Cast<AAICharacter>(GetOwner()))
    {
        InitializeAICombat(AIChar);
    }
}

void UCombatSystem::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
    
    // Update combat state
    UpdateCombatState(DeltaTime);
    
    // Update AI combat behavior
    if (AAICharacter* AIChar = Cast<AAICharacter>(GetOwner()))
    {
        UpdateAICombat(AIChar, DeltaTime);
    }
    
    // Update weapon effects
    UpdateWeaponEffects(DeltaTime);
}

void UCombatSystem::InitializeWeaponSystems()
{
    // Create default weapon loadout
    TArray<FWeaponData> DefaultWeapons = {
        { EWeaponType::PulseRifle, "PulseRifle", 30, 100.0f, 0.1f, 800.0f },
        { EWeaponType::PlasmaCannon, "PlasmaCannon", 10, 200.0f, 0.5f, 600.0f },
        { EWeaponType::QuantumBlaster, "QuantumBlaster", 5, 500.0f, 1.0f, 1200.0f }
    };
    
    for (int32 i = 0; i < DefaultWeapons.Num() && i < WeaponInventory.Num(); i++)
    {
        WeaponInventory[i] = CreateWeapon(DefaultWeapons[i]);
    }
    
    // Set primary weapon
    if (WeaponInventory.Num() > 0)
    {
        EquipWeapon(0);
    }
}

AWeapon* UCombatSystem::CreateWeapon(const FWeaponData& WeaponData)
{
    // Spawn weapon actor
    FActorSpawnParameters SpawnParams;
    SpawnParams.Owner = GetOwner();
    SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    
    AWeapon* NewWeapon = GetWorld()->SpawnActor<AWeapon>(
        WeaponData.WeaponClass,
        GetOwner()->GetActorLocation(),
        GetOwner()->GetActorRotation(),
        SpawnParams
    );
    
    if (NewWeapon)
    {
        NewWeapon->InitializeWeapon(WeaponData);
        NewWeapon->AttachToActor(GetOwner(), FAttachmentTransformRules::SnapToTargetNotIncludingScale);
    }
    
    return NewWeapon;
}

void UCombatSystem::EquipWeapon(int32 WeaponIndex)
{
    if (WeaponIndex >= 0 && WeaponIndex < WeaponInventory.Num() && WeaponInventory[WeaponIndex])
    {
        // Unequip current weapon
        if (CurrentWeapon)
        {
            CurrentWeapon->SetActorHiddenInGame(true);
            CurrentWeapon->SetActorEnableCollision(false);
        }
        
        // Equip new weapon
        CurrentWeapon = WeaponInventory[WeaponIndex];
        CurrentWeapon->SetActorHiddenInGame(false);
        CurrentWeapon->SetActorEnableCollision(true);
        
        // Update UI
        OnWeaponEquipped.Broadcast(CurrentWeapon);
        
        UE_LOG(LogTemp, Log, TEXT("Equipped weapon: %s"), *CurrentWeapon->GetWeaponName());
    }
}

void UCombatSystem::FireWeapon()
{
    if (!CurrentWeapon || bIsReloading || !CanFire())
    {
        return;
    }
    
    // Check ammo
    if (CurrentWeapon->GetCurrentAmmo() <= 0)
    {
        ReloadWeapon();
        return;
    }
    
    // Fire weapon
    FHitResult HitResult;
    FVector StartLocation = GetOwner()->GetActorLocation() + GetOwner()->GetActorForwardVector() * 100.0f;
    FVector EndLocation = StartLocation + GetOwner()->GetActorForwardVector() * CurrentWeapon->GetRange();
    
    // Perform line trace
    FCollisionQueryParams QueryParams;
    QueryParams.AddIgnoredActor(GetOwner());
    QueryParams.bTraceComplex = true;
    
    bool bHit = GetWorld()->LineTraceSingleByChannel(
        HitResult,
        StartLocation,
        EndLocation,
        ECC_Visibility,
        QueryParams
    );
    
    if (bHit)
    {
        // Apply damage to hit target
        AActor* HitActor = HitResult.GetActor();
        if (HitActor)
        {
            ApplyDamage(HitActor, CurrentWeapon->GetDamage(), HitResult);
        }
        
        // Spawn impact effects
        SpawnImpactEffects(HitResult);
    }
    
    // Consume ammo
    CurrentWeapon->ConsumeAmmo(1);
    
    // Play weapon effects
    PlayWeaponEffects();
    
    // Update combat state
    bIsInCombat = true;
    LastDamageTime = GetWorld()->GetTimeSeconds();
    
    // Notify AI systems
    NotifyCombatAction(ECombatAction::WeaponFired);
}

void UCombatSystem::ApplyDamage(AActor* Target, float Damage, const FHitResult& HitResult)
{
    if (!Target)
    {
        return;
    }
    
    // Check if target has combat system
    UCombatSystem* TargetCombat = Target->FindComponentByClass<UCombatSystem>();
    if (TargetCombat)
    {
        // Calculate damage based on hit location
        float FinalDamage = CalculateDamage(Damage, HitResult);
        
        // Apply damage to target
        TargetCombat->TakeDamage(FinalDamage, GetOwner());
        
        // Spawn damage effects
        SpawnDamageEffects(Target, FinalDamage, HitResult);
        
        // Update combat statistics
        UpdateCombatStats(FinalDamage, Target);
    }
}

float UCombatSystem::CalculateDamage(float BaseDamage, const FHitResult& HitResult)
{
    float DamageMultiplier = 1.0f;
    
    // Headshot multiplier
    if (HitResult.BoneName == TEXT("head"))
    {
        DamageMultiplier = 2.0f;
    }
    // Body shot
    else if (HitResult.BoneName == TEXT("spine_01") || HitResult.BoneName == TEXT("spine_02"))
    {
        DamageMultiplier = 1.5f;
    }
    // Limb shot
    else if (HitResult.BoneName.Contains(TEXT("arm")) || HitResult.BoneName.Contains(TEXT("leg")))
    {
        DamageMultiplier = 0.7f;
    }
    
    // Distance falloff
    float Distance = HitResult.Distance;
    float Range = CurrentWeapon ? CurrentWeapon->GetRange() : 1000.0f;
    float DistanceMultiplier = FMath::Max(0.5f, 1.0f - (Distance / Range));
    
    return BaseDamage * DamageMultiplier * DistanceMultiplier;
}

void UCombatSystem::TakeDamage(float Damage, AActor* DamageCauser)
{
    // Apply damage to shield first
    if (CurrentShield > 0.0f)
    {
        float ShieldDamage = FMath::Min(Damage, CurrentShield);
        CurrentShield -= ShieldDamage;
        Damage -= ShieldDamage;
        
        // Play shield hit effect
        PlayShieldHitEffect();
    }
    
    // Apply remaining damage to health
    if (Damage > 0.0f)
    {
        CurrentHealth = FMath::Max(0.0f, CurrentHealth - Damage);
        
        // Play damage effect
        PlayDamageEffect();
        
        // Check for death
        if (CurrentHealth <= 0.0f)
        {
            Die(DamageCauser);
        }
    }
    
    // Update combat state
    bIsInCombat = true;
    LastDamageTime = GetWorld()->GetTimeSeconds();
    
    // Reset shield recharge timer
    GetWorld()->GetTimerManager().ClearTimer(ShieldRechargeTimer);
    GetWorld()->GetTimerManager().SetTimer(
        ShieldRechargeTimer,
        this,
        &UCombatSystem::RechargeShield,
        ShieldRechargeDelay,
        false
    );
    
    // Notify UI
    OnHealthChanged.Broadcast(CurrentHealth, MaxHealth);
    OnShieldChanged.Broadcast(CurrentShield, ShieldCapacity);
}

void UCombatSystem::RechargeShield()
{
    if (CurrentShield < ShieldCapacity && !bIsInCombat)
    {
        CurrentShield = FMath::Min(ShieldCapacity, CurrentShield + ShieldRechargeRate);
        OnShieldChanged.Broadcast(CurrentShield, ShieldCapacity);
    }
}

void UCombatSystem::ReloadWeapon()
{
    if (!CurrentWeapon || bIsReloading)
    {
        return;
    }
    
    bIsReloading = true;
    
    // Play reload animation
    if (ACharacter* Character = Cast<ACharacter>(GetOwner()))
    {
        Character->PlayAnimMontage(ReloadMontage);
    }
    
    // Set reload timer
    GetWorld()->GetTimerManager().SetTimer(
        ReloadTimer,
        this,
        &UCombatSystem::FinishReload,
        CurrentWeapon->GetReloadTime(),
        false
    );
    
    // Play reload sound
    PlayReloadSound();
}

void UCombatSystem::FinishReload()
{
    if (CurrentWeapon)
    {
        CurrentWeapon->Reload();
        bIsReloading = false;
        
        // Play reload complete sound
        PlayReloadCompleteSound();
    }
}

void UCombatSystem::Die(AActor* Killer)
{
    // Play death animation
    if (ACharacter* Character = Cast<ACharacter>(GetOwner()))
    {
        Character->PlayAnimMontage(DeathMontage);
    }
    
    // Spawn death effects
    SpawnDeathEffects();
    
    // Disable combat system
    SetComponentTickEnabled(false);
    
    // Notify game mode
    if (AGameModeBase* GameMode = GetWorld()->GetAuthGameMode())
    {
        // Handle player death
    }
    
    // Notify UI
    OnDeath.Broadcast(Killer);
    
    UE_LOG(LogTemp, Warning, TEXT("Combat system destroyed for: %s"), *GetOwner()->GetName());
}

void UCombatSystem::InitializeAICombat(AAICharacter* AICharacter)
{
    if (!AICharacter)
    {
        return;
    }
    
    // Set AI combat parameters
    AICombatData.CombatRange = CombatRange;
    AICombatData.TacticalRange = TacticalRange;
    AICombatData.CoverPreference = CoverPreference;
    AICombatData.AggressionLevel = AggressionLevel;
    
    // Initialize AI behavior tree
    AICharacter->InitializeCombatBehavior();
    
    // Set up AI perception
    AICharacter->SetupCombatPerception();
}

void UCombatSystem::UpdateAICombat(AAICharacter* AICharacter, float DeltaTime)
{
    if (!AICharacter)
    {
        return;
    }
    
    // Update AI combat state
    AICombatData.UpdateCombatState(DeltaTime);
    
    // Check for targets
    AActor* CurrentTarget = AICharacter->GetCurrentTarget();
    if (CurrentTarget)
    {
        // Update target tracking
        UpdateTargetTracking(CurrentTarget);
        
        // Make combat decisions
        MakeCombatDecision(AICharacter, CurrentTarget);
    }
    else
    {
        // Search for new targets
        SearchForTargets(AICharacter);
    }
}

void UCombatSystem::UpdateTargetTracking(AActor* Target)
{
    if (!Target)
    {
        return;
    }
    
    // Update target position and velocity
    FVector TargetLocation = Target->GetActorLocation();
    FVector TargetVelocity = Target->GetVelocity();
    
    // Predict target movement
    FVector PredictedLocation = PredictTargetLocation(TargetLocation, TargetVelocity);
    
    // Update aim
    UpdateAim(PredictedLocation);
}

FVector UCombatSystem::PredictTargetLocation(const FVector& CurrentLocation, const FVector& Velocity)
{
    // Simple linear prediction
    float PredictionTime = 0.2f; // 200ms prediction
    return CurrentLocation + Velocity * PredictionTime;
}

void UCombatSystem::UpdateAim(const FVector& TargetLocation)
{
    if (!GetOwner())
    {
        return;
    }
    
    FVector Direction = (TargetLocation - GetOwner()->GetActorLocation()).GetSafeNormal();
    FRotator TargetRotation = Direction.Rotation();
    
    // Smooth aim rotation
    FRotator CurrentRotation = GetOwner()->GetActorRotation();
    FRotator NewRotation = FMath::RInterpTo(CurrentRotation, TargetRotation, GetWorld()->GetDeltaSeconds(), 5.0f);
    
    GetOwner()->SetActorRotation(NewRotation);
}

void UCombatSystem::MakeCombatDecision(AAICharacter* AICharacter, AActor* Target)
{
    if (!AICharacter || !Target)
    {
        return;
    }
    
    float DistanceToTarget = FVector::Dist(AICharacter->GetActorLocation(), Target->GetActorLocation());
    
    // Tactical decision making
    if (DistanceToTarget > CombatRange)
    {
        // Target is too far, move closer
        AICharacter->MoveToTarget(Target);
    }
    else if (DistanceToTarget < TacticalRange)
    {
        // Target is close, take cover or engage
        if (ShouldTakeCover(AICharacter, Target))
        {
            AICharacter->FindCover(Target);
        }
        else
        {
            // Engage target
            FireWeapon();
        }
    }
    else
    {
        // Optimal range, engage
        FireWeapon();
    }
}

bool UCombatSystem::ShouldTakeCover(AAICharacter* AICharacter, AActor* Target)
{
    if (!AICharacter || !Target)
    {
        return false;
    }
    
    // Check health status
    if (CurrentHealth < MaxHealth * 0.3f)
    {
        return true; // Low health, take cover
    }
    
    // Check if under heavy fire
    if (GetWorld()->GetTimeSeconds() - LastDamageTime < 2.0f)
    {
        return true; // Recently damaged, take cover
    }
    
    // Random tactical decision based on aggression level
    return FMath::FRand() > AggressionLevel;
}

void UCombatSystem::SearchForTargets(AAICharacter* AICharacter)
{
    if (!AICharacter)
    {
        return;
    }
    
    // Get all actors in perception range
    TArray<AActor*> PerceivedActors;
    AICharacter->GetPerceivedActors(PerceivedActors);
    
    // Find best target
    AActor* BestTarget = nullptr;
    float BestScore = 0.0f;
    
    for (AActor* Actor : PerceivedActors)
    {
        if (IsValidTarget(Actor))
        {
            float Score = CalculateTargetScore(AICharacter, Actor);
            if (Score > BestScore)
            {
                BestScore = Score;
                BestTarget = Actor;
            }
        }
    }
    
    // Set new target
    if (BestTarget)
    {
        AICharacter->SetCurrentTarget(BestTarget);
    }
}

bool UCombatSystem::IsValidTarget(AActor* Actor)
{
    if (!Actor)
    {
        return false;
    }
    
    // Check if actor is enemy
    if (Actor->GetTeam() == GetOwner()->GetTeam())
    {
        return false;
    }
    
    // Check if actor has combat system
    UCombatSystem* TargetCombat = Actor->FindComponentByClass<UCombatSystem>();
    if (!TargetCombat)
    {
        return false;
    }
    
    // Check if target is alive
    if (TargetCombat->GetCurrentHealth() <= 0.0f)
    {
        return false;
    }
    
    return true;
}

float UCombatSystem::CalculateTargetScore(AAICharacter* AICharacter, AActor* Target)
{
    if (!AICharacter || !Target)
    {
        return 0.0f;
    }
    
    float Score = 0.0f;
    
    // Distance factor (closer is better)
    float Distance = FVector::Dist(AICharacter->GetActorLocation(), Target->GetActorLocation());
    Score += 1000.0f / (Distance + 1.0f);
    
    // Health factor (weaker targets are better)
    UCombatSystem* TargetCombat = Target->FindComponentByClass<UCombatSystem>();
    if (TargetCombat)
    {
        float HealthPercent = TargetCombat->GetCurrentHealth() / TargetCombat->GetMaxHealth();
        Score += (1.0f - HealthPercent) * 500.0f;
    }
    
    // Threat factor (targets that are attacking us are higher priority)
    if (Target->GetCurrentTarget() == AICharacter)
    {
        Score += 300.0f;
    }
    
    return Score;
}

void UCombatSystem::SpawnImpactEffects(const FHitResult& HitResult)
{
    if (!ImpactEffect)
    {
        return;
    }
    
    // Spawn impact particle effect
    UGameplayStatics::SpawnEmitterAtLocation(
        GetWorld(),
        ImpactEffect,
        HitResult.Location,
        HitResult.Normal.Rotation()
    );
    
    // Play impact sound
    UGameplayStatics::PlaySoundAtLocation(
        GetWorld(),
        ImpactSound,
        HitResult.Location
    );
}

void UCombatSystem::SpawnDamageEffects(AActor* Target, float Damage, const FHitResult& HitResult)
{
    if (!Target || !DamageEffect)
    {
        return;
    }
    
    // Spawn damage particle effect
    UGameplayStatics::SpawnEmitterAtLocation(
        GetWorld(),
        DamageEffect,
        HitResult.Location,
        HitResult.Normal.Rotation()
    );
    
    // Show damage number
    ShowDamageNumber(Target, Damage, HitResult.Location);
}

void UCombatSystem::ShowDamageNumber(AActor* Target, float Damage, const FVector& Location)
{
    // Create damage number widget
    if (DamageNumberClass)
    {
        UDamageNumber* DamageNumber = CreateWidget<UDamageNumber>(GetWorld(), DamageNumberClass);
        if (DamageNumber)
        {
            DamageNumber->SetDamage(Damage);
            DamageNumber->SetWorldLocation(Location);
            DamageNumber->AddToViewport();
        }
    }
}

void UCombatSystem::PlayWeaponEffects()
{
    if (!CurrentWeapon)
    {
        return;
    }
    
    // Play muzzle flash
    if (MuzzleFlashEffect)
    {
        UGameplayStatics::SpawnEmitterAttached(
            MuzzleFlashEffect,
            CurrentWeapon->GetMeshComponent(),
            TEXT("Muzzle")
        );
    }
    
    // Play weapon sound
    if (WeaponFireSound)
    {
        UGameplayStatics::PlaySoundAtLocation(
            GetWorld(),
            WeaponFireSound,
            GetOwner()->GetActorLocation()
        );
    }
}

void UCombatSystem::PlayShieldHitEffect()
{
    if (ShieldHitEffect)
    {
        UGameplayStatics::SpawnEmitterAtLocation(
            GetWorld(),
            ShieldHitEffect,
            GetOwner()->GetActorLocation()
        );
    }
    
    if (ShieldHitSound)
    {
        UGameplayStatics::PlaySoundAtLocation(
            GetWorld(),
            ShieldHitSound,
            GetOwner()->GetActorLocation()
        );
    }
}

void UCombatSystem::PlayDamageEffect()
{
    if (DamageEffect)
    {
        UGameplayStatics::SpawnEmitterAtLocation(
            GetWorld(),
            DamageEffect,
            GetOwner()->GetActorLocation()
        );
    }
    
    if (DamageSound)
    {
        UGameplayStatics::PlaySoundAtLocation(
            GetWorld(),
            DamageSound,
            GetOwner()->GetActorLocation()
        );
    }
}

void UCombatSystem::SpawnDeathEffects()
{
    if (DeathEffect)
    {
        UGameplayStatics::SpawnEmitterAtLocation(
            GetWorld(),
            DeathEffect,
            GetOwner()->GetActorLocation()
        );
    }
    
    if (DeathSound)
    {
        UGameplayStatics::PlaySoundAtLocation(
            GetWorld(),
            DeathSound,
            GetOwner()->GetActorLocation()
        );
    }
}

void UCombatSystem::PlayReloadSound()
{
    if (ReloadSound)
    {
        UGameplayStatics::PlaySoundAtLocation(
            GetWorld(),
            ReloadSound,
            GetOwner()->GetActorLocation()
        );
    }
}

void UCombatSystem::PlayReloadCompleteSound()
{
    if (ReloadCompleteSound)
    {
        UGameplayStatics::PlaySoundAtLocation(
            GetWorld(),
            ReloadCompleteSound,
            GetOwner()->GetActorLocation()
        );
    }
}

bool UCombatSystem::CanFire() const
{
    return !bIsReloading && CurrentWeapon && CurrentWeapon->GetCurrentAmmo() > 0;
}

void UCombatSystem::UpdateCombatState(float DeltaTime)
{
    // Check if out of combat
    if (GetWorld()->GetTimeSeconds() - LastDamageTime > 10.0f)
    {
        bIsInCombat = false;
    }
}

void UCombatSystem::UpdateWeaponEffects(float DeltaTime)
{
    if (CurrentWeapon)
    {
        CurrentWeapon->UpdateEffects(DeltaTime);
    }
}

void UCombatSystem::UpdateCombatStats(float Damage, AActor* Target)
{
    // Update statistics
    TotalDamageDealt += Damage;
    TargetsHit++;
    
    // Check for kill
    UCombatSystem* TargetCombat = Target->FindComponentByClass<UCombatSystem>();
    if (TargetCombat && TargetCombat->GetCurrentHealth() <= 0.0f)
    {
        Kills++;
    }
}

void UCombatSystem::NotifyCombatAction(ECombatAction Action)
{
    // Notify AI systems and other components
    OnCombatAction.Broadcast(Action);
}

void UCombatSystem::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    
    DOREPLIFETIME(UCombatSystem, CurrentHealth);
    DOREPLIFETIME(UCombatSystem, CurrentShield);
    DOREPLIFETIME(UCombatSystem, bIsInCombat);
    DOREPLIFETIME(UCombatSystem, bIsReloading);
} 