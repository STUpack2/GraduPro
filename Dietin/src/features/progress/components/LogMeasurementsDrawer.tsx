import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useProgressStore } from "@/stores/progressStore";
import { localDateKey } from "@/features/progress/lib/dates";
import { useTranslation } from "react-i18next";
import type { BodyMeasurement } from "@/features/progress/types";

export interface LogMeasurementsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: Partial<BodyMeasurement>;
}

const FIELDS: { key: keyof Omit<BodyMeasurement, "date">; label: string }[] = [
  { key: "waistCm",  label: "Waist (cm)" },
  { key: "chestCm",  label: "Chest (cm)" },
  { key: "armsCm",   label: "Arms (cm)" },
  { key: "hipsCm",   label: "Hips (cm)" },
  { key: "thighsCm", label: "Thighs (cm)" },
  { key: "neckCm",   label: "Neck (cm)" },
];

export function LogMeasurementsDrawer({ open, onOpenChange, defaults }: LogMeasurementsDrawerProps) {
  const { t } = useTranslation();
  const addMeasurement = useProgressStore((s) => s.addMeasurement);
  const [date, setDate] = useState(localDateKey());
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const f of FIELDS) out[f.key] = defaults?.[f.key]?.toString() ?? "";
    return out;
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const partial: Partial<BodyMeasurement> = { date };
    let any = false;
    for (const f of FIELDS) {
      const raw = values[f.key];
      if (raw === "" || raw === undefined) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) continue;
      (partial as Record<string, unknown>)[f.key] = n;
      any = true;
    }
    if (!any) {
      toast.error(t("progress.measurements.invalid", { defaultValue: "Add at least one measurement" }));
      return;
    }
    setBusy(true);
    try {
      await addMeasurement(partial);
      toast.success(t("progress.measurements.saved", { defaultValue: "Measurements saved" }));
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md p-4">
          <DrawerHeader className="px-0">
            <DrawerTitle>{t("progress.measurements.log_title", { defaultValue: "Log body measurements" })}</DrawerTitle>
            <DrawerDescription>
              {t("progress.measurements.log_desc", { defaultValue: "Tracking inches tells the story the scale can't." })}
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label htmlFor="meas-date">{t("progress.common.date", { defaultValue: "Date" })}</Label>
              <Input id="meas-date" type="date" value={date} max={localDateKey()} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {FIELDS.map((f) => (
                <div key={f.key as string} className="space-y-1.5">
                  <Label htmlFor={f.key as string}>{f.label}</Label>
                  <Input
                    id={f.key as string}
                    type="number"
                    inputMode="decimal"
                    step={0.1}
                    min={0}
                    placeholder="—"
                    value={values[f.key as string]}
                    onChange={(e) => setValues((s) => ({ ...s, [f.key as string]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>
          <DrawerFooter className="px-0">
            <Button disabled={busy} onClick={submit}>
              {busy
                ? t("progress.common.saving", { defaultValue: "Saving…" })
                : t("progress.common.save", { defaultValue: "Save" })}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">{t("progress.common.cancel", { defaultValue: "Cancel" })}</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
