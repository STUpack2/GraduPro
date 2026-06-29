# Dietin Project - Entity Relationship Diagram (ERD)

This diagram visualizes the data models, Firestore collections, and local Zustand state structures in the **Dietin** app.

```mermaid
erDiagram
    %% Core Entities
    USER_PROFILE ||--o{ DAILY_CALORIES : "has"
    USER_PROFILE ||--o{ MOOD_DATA : "records"
    USER_PROFILE ||--o{ EXERCISE : "favorites"
    USER_PROFILE ||--o| SUBSCRIPTION : "has"
    
    DAILY_CALORIES ||--o{ CALORIE_ENTRY : "contains"
    
    %% Entity Definitions
    USER_PROFILE {
        string id PK
        string email
        string username
        string name
        int age
        string gender
        float weight
        float height
        float targetWeight
        float bmi
        string bmiCategory
        float bodyFatPercentage
        string activityLevel
        string experienceLevel
        int workoutDays
        string[] injuries
        string[] allergies
        string budget
        boolean onboardingCompleted
        int calorieGoal
        int proteinGoal
        int carbsGoal
        int fatGoal
        int metabolism
        boolean isPro
        datetime proExpiryDate
        string diet
        string goal
        string[] goals
        string[] obstacles
        string aiPersonalization
        datetime createdAt
        datetime lastUpdated
    }

    DAILY_CALORIES {
        string date PK "e.g., 2026-06-23"
        int totalCalories
        int totalProtein
        int totalCarbs
        int totalFat
    }

    CALORIE_ENTRY {
        string id PK
        string foodName
        string description
        string mealTag "Breakfast, Lunch, Dinner, Snack"
        int calories
        int protein
        int carbs
        int fat
        datetime timestamp
        int healthScore
        boolean isUSDA
        string usdaId
        float portionSize
        string portionUnit
        int cholesterol
        int sugar
        int sodium
        string[] ingredients
    }

    MOOD_DATA {
        string mood "very-happy, happy, neutral, sad, very-sad"
        string date PK
        int timestamp
    }

    EXERCISE {
        string id PK
        string name
        string level
        string category
        string equipment
        string[] primaryMuscles
        string[] secondaryMuscles
        string[] instructions
        string[] images
    }

    SUBSCRIPTION {
        string subscriptionId PK
        string uid FK "User ID"
        string plan
        datetime proExpiresAt
    }

    %% AI Suggestions (Stored transiently)
    MEAL_SUGGESTION {
        string name
        string type
        int calories
        int protein
        int carbs
        int fat
        string difficulty
        string timeToMake
        string budget
        string cuisine
        string quickRecipe
    }

    DRINK_SUGGESTION {
        string name
        string type
        int calories
        int protein
        int carbs
        int fat
        string difficulty
        string timeToMake
        string budget
        string quickRecipe
    }
```

## Data Storage Overview
- **Firestore Collections**:
  - `/users/{userId}`: Stores the main `USER_PROFILE` data. Includes access control limits so users can only update their non-premium fields.
  - `/subscriptions/{subscriptionId}`: Stores user subscription details (`SUBSCRIPTION` entity). Managed completely via backend webhooks (Paymob/PayPal) or Admin SDK.
- **Local State (Zustand)**:
  - `userStore`: Stores `USER_PROFILE`, `DAILY_CALORIES`, `CALORIE_ENTRY` arrays, `MOOD_DATA` history, and local analytics counters.
  - `workoutStore`: Stores the user's favorite `EXERCISE` list.
  - `mealStore`: Stores AI-generated `MEAL_SUGGESTION` items transiently.
  - `hydrationStore`: Stores AI-generated `DRINK_SUGGESTION` items transiently.
