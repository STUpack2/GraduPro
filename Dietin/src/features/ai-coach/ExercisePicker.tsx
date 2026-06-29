import { useEffect, useState } from "react";
import { listExercises } from "./api";
import type { Exercise } from "./types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ExercisePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  fallbackList?: string[];
}

function humanize(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function ExercisePicker({ value, onChange, disabled, fallbackList }: ExercisePickerProps) {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listExercises()
      .then((list) => !cancelled && setExercises(list))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const options =
    exercises ??
    (fallbackList ?? []).map((id) => ({
      id,
      name: humanize(id),
      category: "Other",
      target_muscle: "—",
      difficulty: "Intermediate" as const,
    }));

  return (
    <Select value={value ?? ""} onValueChange={(v) => onChange(v || null)} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue
          placeholder={
            error
              ? "Coach offline"
              : exercises === null
                ? "Loading…"
                : "Auto-detect"
          }
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="auto">Auto-detect</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.id} value={opt.id}>
            {opt.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
