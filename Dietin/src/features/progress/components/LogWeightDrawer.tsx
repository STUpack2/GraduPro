import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useProgressStore } from "@/stores/progressStore";
import { localDateKey } from "@/features/progress/lib/dates";
import { useTranslation } from "react-i18next";

export interface LogWeightDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValue?: number;
}

export function LogWeightDrawer({ open, onOpenChange, defaultValue }: LogWeightDrawerProps) {
  const addWeight = useProgressStore((s) => s.addWeight);
  const { t } = useTranslation();
  const [value, setValue] = useState<string>(defaultValue ? String(defaultValue) : "");
  const [date, setDate] = useState<string>(localDateKey());
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const kg = Number(value);
    if (!Number.isFinite(kg) || kg <= 0) {
      toast.error(t("progress.weight.invalid", { defaultValue: "Please enter a valid weight" }));
      return;
    }
    setBusy(true);
    try {
      await addWeight(kg, { date });
      toast.success(t("progress.weight.saved", { defaultValue: "Weight saved" }));
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
            <DrawerTitle>{t("progress.weight.log_title", { defaultValue: "Log weight" })}</DrawerTitle>
            <DrawerDescription>
              {t("progress.weight.log_desc", { defaultValue: "Track today's weight to keep your transformation accurate." })}
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 px-0">
            <div className="space-y-1.5">
              <Label htmlFor="weight-kg">{t("progress.weight.kg", { defaultValue: "Weight (kg)" })}</Label>
              <Input
                id="weight-kg"
                type="number"
                inputMode="decimal"
                min={20}
                max={400}
                step={0.1}
                placeholder="78.2"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight-date">{t("progress.weight.date", { defaultValue: "Date" })}</Label>
              <Input
                id="weight-date"
                type="date"
                value={date}
                max={localDateKey()}
                onChange={(e) => setDate(e.target.value)}
              />
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
