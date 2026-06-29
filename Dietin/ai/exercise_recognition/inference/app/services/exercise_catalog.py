"""Single source of truth for the 22-exercise display catalog.

Exercise IDs MUST match the classifier label_encoder.classes_ exactly so that the
chain `label_encoder.pkl -> classifier output -> backend id -> frontend id` stays 1:1.
Any new class must be added here AND in label_encoder/dataset before it can appear in
the UI.
"""

from __future__ import annotations

from typing import Dict, List, Literal, TypedDict

Difficulty = Literal["Beginner", "Intermediate", "Advanced"]


class CatalogEntry(TypedDict):
    id: str
    name: str
    category: str
    target_muscle: str
    difficulty: Difficulty


EXERCISE_CATALOG: List[CatalogEntry] = [
    {
        "id": "barbell_biceps_curl",
        "name": "Barbell Biceps Curl",
        "category": "Arms",
        "target_muscle": "Biceps",
        "difficulty": "Beginner",
    },
    {
        "id": "bench_press",
        "name": "Bench Press",
        "category": "Chest",
        "target_muscle": "Chest",
        "difficulty": "Intermediate",
    },
    {
        "id": "chest_fly_machine",
        "name": "Chest Fly Machine",
        "category": "Chest",
        "target_muscle": "Chest",
        "difficulty": "Beginner",
    },
    {
        "id": "deadlift",
        "name": "Deadlift",
        "category": "Back",
        "target_muscle": "Posterior chain",
        "difficulty": "Advanced",
    },
    {
        "id": "decline_bench_press",
        "name": "Decline Bench Press",
        "category": "Chest",
        "target_muscle": "Lower chest",
        "difficulty": "Intermediate",
    },
    {
        "id": "hammer_curl",
        "name": "Hammer Curl",
        "category": "Arms",
        "target_muscle": "Biceps / Forearms",
        "difficulty": "Beginner",
    },
    {
        "id": "hip_thrust",
        "name": "Hip Thrust",
        "category": "Glutes",
        "target_muscle": "Glutes",
        "difficulty": "Intermediate",
    },
    {
        "id": "incline_bench_press",
        "name": "Incline Bench Press",
        "category": "Chest",
        "target_muscle": "Upper chest",
        "difficulty": "Intermediate",
    },
    {
        "id": "lat_pulldown",
        "name": "Lat Pulldown",
        "category": "Back",
        "target_muscle": "Lats",
        "difficulty": "Beginner",
    },
    {
        "id": "lateral_raise",
        "name": "Lateral Raise",
        "category": "Shoulders",
        "target_muscle": "Side delts",
        "difficulty": "Beginner",
    },
    {
        "id": "leg_extension",
        "name": "Leg Extension",
        "category": "Legs",
        "target_muscle": "Quads",
        "difficulty": "Beginner",
    },
    {
        "id": "leg_raises",
        "name": "Leg Raises",
        "category": "Core",
        "target_muscle": "Lower abs",
        "difficulty": "Beginner",
    },
    {
        "id": "plank",
        "name": "Plank",
        "category": "Core",
        "target_muscle": "Core",
        "difficulty": "Beginner",
    },
    {
        "id": "pull_up",
        "name": "Pull Up",
        "category": "Back",
        "target_muscle": "Lats / Biceps",
        "difficulty": "Advanced",
    },
    {
        "id": "push_up",
        "name": "Push Up",
        "category": "Chest",
        "target_muscle": "Chest / Triceps",
        "difficulty": "Beginner",
    },
    {
        "id": "romanian_deadlift",
        "name": "Romanian Deadlift",
        "category": "Back",
        "target_muscle": "Hamstrings",
        "difficulty": "Intermediate",
    },
    {
        "id": "russian_twist",
        "name": "Russian Twist",
        "category": "Core",
        "target_muscle": "Obliques",
        "difficulty": "Beginner",
    },
    {
        "id": "shoulder_press",
        "name": "Shoulder Press",
        "category": "Shoulders",
        "target_muscle": "Deltoids",
        "difficulty": "Intermediate",
    },
    {
        "id": "squat",
        "name": "Squat",
        "category": "Legs",
        "target_muscle": "Quads / Glutes",
        "difficulty": "Intermediate",
    },
    {
        "id": "t_bar_row",
        "name": "T-Bar Row",
        "category": "Back",
        "target_muscle": "Mid back",
        "difficulty": "Intermediate",
    },
    {
        "id": "tricep_dips",
        "name": "Tricep Dips",
        "category": "Arms",
        "target_muscle": "Triceps",
        "difficulty": "Intermediate",
    },
    {
        "id": "tricep_pushdown",
        "name": "Tricep Pushdown",
        "category": "Arms",
        "target_muscle": "Triceps",
        "difficulty": "Beginner",
    },
]

CATALOG_BY_ID: Dict[str, CatalogEntry] = {entry["id"]: entry for entry in EXERCISE_CATALOG}


def get_catalog() -> List[CatalogEntry]:
    return [entry.copy() for entry in EXERCISE_CATALOG]


def get_entry(exercise_id: str) -> CatalogEntry | None:
    entry = CATALOG_BY_ID.get(exercise_id)
    return entry.copy() if entry else None
