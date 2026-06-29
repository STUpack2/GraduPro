import { useMemo, useState } from "react";
import { Images, ArrowLeftRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProgressStore } from "@/stores/progressStore";
import { DashboardCard } from "../components/DashboardCard";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import { PhotoUploader } from "../components/PhotoUploader";
import { BeforeAfterSlider } from "../components/BeforeAfterSlider";
import { PhotoLightbox } from "../components/PhotoLightbox";
import { SegmentedTabs } from "../components/SegmentedTabs";
import { Button } from "@/components/ui/button";
import { isoWeekId } from "../lib/dates";
import { usePhotoUrl } from "../hooks/usePhotoUrl";
import { silhouetteHtml } from "../lib/illustrations";
import { cn } from "@/lib/utils";
import type { PhotoView, ProgressPhoto } from "../types";

const VIEWS: PhotoView[] = ["front", "side", "back"];

function PhotoTile({ photo, view, onClick }: { photo: ProgressPhoto; view: PhotoView; onClick?: (fullPath: string | undefined) => void }) {
  const url = usePhotoUrl(photo[view]?.thumbPath ?? photo[view]?.path);
  if (!url) {
    return (
      <div
        className="aspect-[3/4] rounded-2xl bg-gray-50 dark:bg-bg-card border border-dashed border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-400 p-3"
        dangerouslySetInnerHTML={{ __html: silhouetteHtml(view) }}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => onClick?.(photo[view]?.path)}
      className="aspect-[3/4] rounded-2xl overflow-hidden bg-black/5 dark:bg-white/5 group relative w-full"
    >
      <img src={url} alt={view} className="absolute inset-0 w-full h-full object-cover" />
    </button>
  );
}

function PhotoComparePair({ before, after, view }: { before: ProgressPhoto; after: ProgressPhoto; view: PhotoView }) {
  const beforeUrl = usePhotoUrl(before[view]?.path);
  const afterUrl = usePhotoUrl(after[view]?.path);
  if (!beforeUrl || !afterUrl) return null;
  return <BeforeAfterSlider beforeUrl={beforeUrl} afterUrl={afterUrl} beforeLabel={before.weekId} afterLabel={after.weekId} />;
}

function PhotoUploaderTile({
  view,
  asset,
  onUpload,
  onDelete,
}: {
  view: PhotoView;
  asset?: { path: string; thumbPath?: string };
  onUpload: (file: File) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}) {
  const url = usePhotoUrl(asset?.thumbPath ?? asset?.path);
  return (
    <PhotoUploader
      view={view}
      existingUrl={url}
      onUpload={onUpload}
      onDelete={onDelete}
      placeholder={
        <div
          className="flex items-center justify-center w-full h-full text-primary p-3"
          dangerouslySetInnerHTML={{ __html: silhouetteHtml(view) }}
        />
      }
    />
  );
}

export function PhotosSection() {
  const { t } = useTranslation();
  const photos = useProgressStore((s) => s.photos);
  const uploadPhoto = useProgressStore((s) => s.uploadPhoto);
  const removePhoto = useProgressStore((s) => s.removePhoto);
  const hydrated = useProgressStore((s) => s.hydrated);
  const [activeView, setActiveView] = useState<PhotoView>("front");
  const [activeWeek, setActiveWeek] = useState<string>(() => isoWeekId());
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);

  const sortedWeeks = useMemo(() => {
    const ids = new Set<string>(photos.map((p) => p.weekId));
    ids.add(isoWeekId());
    return [...ids].sort();
  }, [photos]);

  const currentPhoto = useMemo<ProgressPhoto>(
    () => photos.find((p) => p.weekId === activeWeek) ?? {
      weekId: activeWeek,
      capturedAt: new Date().toISOString(),
    },
    [photos, activeWeek],
  );

  const firstPhoto = useMemo(() => photos.find((p) => p[activeView]) ?? null, [photos, activeView]);
  const newestPhoto = useMemo(
    () => [...photos].reverse().find((p) => p[activeView]) ?? null,
    [photos, activeView],
  );
  const canCompare = !!firstPhoto && !!newestPhoto && firstPhoto.weekId !== newestPhoto.weekId;

  const state = !hydrated && photos.length === 0
    ? "loading"
    : photos.length === 0
      ? "empty"
      : "populated";

  return (
    <>
      <DashboardCard
        state={state}
        empty={
          <EmptyState
            icon={Images}
            title={t("progress.photos.empty_title", { defaultValue: "Capture your transformation" })}
            description={t("progress.photos.empty_desc", {
              defaultValue: "Add front, side and back photos once a week. They stay private and never go to AI.",
            })}
            cta={{
              label: t("progress.photos.add_cta", { defaultValue: "Add this week's photos" }),
              onClick: () => {
                setActiveWeek(isoWeekId());
                setActiveView("front");
              },
            }}
            illustration={
              <div className="flex gap-2 text-primary">
                {VIEWS.map((v) => (
                  <span
                    key={v}
                    className="w-12 h-16"
                    dangerouslySetInnerHTML={{ __html: silhouetteHtml(v) }}
                  />
                ))}
              </div>
            }
          />
        }
      >
        <div className="p-5">
          <SectionHeader
            icon={<Images className="h-5 w-5" />}
            title={t("progress.photos.title", { defaultValue: "Progress Photos" })}
            description={t("progress.photos.desc", { defaultValue: "Weekly snapshots. Private. Yours alone." })}
            action={
              canCompare && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-primary -mr-1"
                  onClick={() => setCompareMode((v) => !v)}
                >
                  <ArrowLeftRight className="h-4 w-4 mr-1" />
                  {compareMode
                    ? t("progress.photos.exit_compare", { defaultValue: "Back to upload" })
                    : t("progress.photos.compare", { defaultValue: "Before / After" })}
                </Button>
              )
            }
          />
          <div className="flex gap-2 overflow-x-auto mb-3 -mx-1 px-1 pb-1 snap-x">
            {sortedWeeks.map((wk) => (
              <button
                key={wk}
                onClick={() => {
                  setActiveWeek(wk);
                  setCompareMode(false);
                }}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 snap-start",
                  wk === activeWeek
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-text-muted",
                )}
              >
                {wk}
              </button>
            ))}
          </div>
          {compareMode && canCompare ? (
            <div className="space-y-3">
              <SegmentedTabs<PhotoView>
                value={activeView}
                onChange={setActiveView}
                options={VIEWS.map((v) => ({ value: v, label: v }))}
              />
              {firstPhoto && newestPhoto ? (
                <PhotoComparePair before={firstPhoto} after={newestPhoto} view={activeView} />
              ) : (
                <p className="text-sm text-gray-500">{t("progress.photos.need_two", { defaultValue: "Need at least two weeks of photos." })}</p>
              )}
            </div>
          ) : (
            <>
              <SegmentedTabs<PhotoView>
                value={activeView}
                onChange={setActiveView}
                options={VIEWS.map((v) => ({ value: v, label: v }))}
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                {VIEWS.map((v) => {
                  const asset = currentPhoto[v];
                  return (
                    <PhotoUploaderTile
                      key={v}
                      view={v}
                      asset={asset}
                      onUpload={(file) => uploadPhoto(v, file, { weekId: activeWeek })}
                      onDelete={asset ? () => removePhoto(activeWeek, v) : undefined}
                    />
                  );
                })}
              </div>
              {photos.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                    {t("progress.photos.timeline", { defaultValue: "Timeline" })}
                  </h3>
                  <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 snap-x">
                    {photos.map((p) => (
                      <div key={p.weekId} className="min-w-[120px] shrink-0 snap-start">
                        <PhotoTile
                          photo={p}
                          view={activeView}
                          onClick={(path) => {
                            setActiveWeek(p.weekId);
                            if (path) {
                              // Resolve url synchronously via the cache; if missing,
                              // fall back to opening once cache fills via PhotoUploader path.
                              const cached = useProgressStore.getState().photoUrlCache[path];
                              if (cached) setLightbox(cached);
                            }
                          }}
                        />
                        <p className="text-[11px] text-gray-500 text-center mt-1">{p.weekId}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DashboardCard>
      <PhotoLightbox url={lightbox} alt="progress photo" onClose={() => setLightbox(null)} />
    </>
  );
}
