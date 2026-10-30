"use client";

import { toast } from "@heroui/react";
import {
  UNIT_PHOTO_MAX,
  UNIT_PHOTO_MAX_BYTES,
  UNIT_VIDEO_MAX_BYTES,
  type UnitPhotoView,
  type UnitVideoView,
} from "@injishi/contracts";
import {
  ErrorBlock,
  LoadingBlock,
  type PhotoItem,
  type PhotoUpload,
  PhotoUploader,
  type UploadState,
  VideoField,
  type VideoItem,
  type VideoUpload,
  type VideoUploadState,
} from "@injishi/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadUnitMedia, removeUnitPhoto, removeUnitVideo, reorderUnitPhotos } from "../actions";
import { uploadWithProgress } from "../upload";

export const asPhoto = (p: UnitPhotoView): PhotoItem => ({ id: p.id, url: p.url });
export const asVideo = (v: UnitVideoView | null): VideoItem | null =>
  v ? { url: v.url, posterUrl: v.posterUrl, durationS: v.durationS } : null;

/** Where the unit form's photos and video are, summed up for its Save button. */
export interface MediaProgress {
  /** Something is being sent, or waits to be sent now that the unit exists. */
  busy: boolean;
  /** Photos (and the video) that failed and show Try again. */
  failed: number;
  /** Photos and a video picked and not saved yet. */
  held: number;
  /** Photos saved, and whether a video is. */
  photos: number;
  video: boolean;
}

/**
 * The photos and the video tour of a unit, inside the unit form. Editing a unit, they save as they are
 * added, arranged or removed. Adding one, `unitId` is null until the unit is saved: picked photos and the
 * video wait in the browser, then go up one by one with their progress as soon as the unit exists.
 */
export function UnitMediaFields({
  unitId,
  load,
  isDisabled,
  onProgress,
}: {
  /** The unit they belong to; null before a new unit is saved. */
  unitId: string | null;
  /** Read the photos and video already saved (an existing unit), or start empty (a new one). */
  load: boolean;
  isDisabled?: boolean;
  onProgress: (progress: MediaProgress) => void;
}) {
  const [loaded, setLoaded] = useState(!load);
  const [failedToLoad, setFailedToLoad] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [video, setVideo] = useState<VideoItem | null>(null);
  const [photoState, setPhotoState] = useState<UploadState>({ queued: 0, uploading: 0, failed: 0 });
  const [videoState, setVideoState] = useState<VideoUploadState>("idle");

  const read = useCallback(async () => {
    if (!unitId) return;
    setFailedToLoad(false);
    const result = await loadUnitMedia(unitId);
    if (!result.ok) {
      setFailedToLoad(true);
      return;
    }
    setPhotos(result.value.photos.map(asPhoto));
    setVideo(asVideo(result.value.video));
    setLoaded(true);
  }, [unitId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: read once, for the unit the form opened on
  useEffect(() => {
    if (load) void read();
  }, []);

  useEffect(() => {
    const waiting = unitId !== null;
    onProgress({
      busy:
        photoState.uploading > 0 ||
        videoState === "uploading" ||
        (waiting && (photoState.queued > 0 || videoState === "queued")),
      failed: photoState.failed + (videoState === "failed" ? 1 : 0),
      held: photoState.queued + (videoState === "queued" ? 1 : 0),
      photos: photos.length,
      video: video !== null,
    });
  }, [unitId, photoState, videoState, photos.length, video, onProgress]);

  const uploadPhoto = useMemo<PhotoUpload | null>(
    () =>
      unitId
        ? async (file, progress, signal) => {
            const form = new FormData();
            form.append("file", file, file.name);
            const saved = await uploadWithProgress<UnitPhotoView>(
              `/api/rentals/units/${unitId}/photos`,
              "POST",
              form,
              progress,
              signal,
            );
            return asPhoto(saved);
          }
        : null,
    [unitId],
  );

  const uploadVideo = useMemo<VideoUpload | null>(
    () =>
      unitId
        ? async (file, facts, progress, signal) => {
            const form = new FormData();
            form.append("durationS", String(facts.durationS));
            if (facts.width) form.append("width", String(facts.width));
            if (facts.height) form.append("height", String(facts.height));
            if (facts.poster) form.append("poster", facts.poster, "poster.jpg");
            form.append("file", file, file.name);
            const saved = await uploadWithProgress<UnitVideoView>(
              `/api/rentals/units/${unitId}/video`,
              "PUT",
              form,
              progress,
              signal,
            );
            return asVideo(saved) as VideoItem;
          }
        : null,
    [unitId],
  );

  if (failedToLoad) return <ErrorBlock title="Couldn't load the photos" onRetry={() => void read()} />;
  if (!loaded) return <LoadingBlock shape="cards" label="photos" count={2} />;

  return (
    <>
      <PhotoUploader
        label="Photos"
        photos={photos}
        max={UNIT_PHOTO_MAX}
        maxBytes={UNIT_PHOTO_MAX_BYTES}
        isDisabled={isDisabled}
        upload={uploadPhoto}
        onUploaded={(photo) => setPhotos((list) => [...list, photo])}
        onStateChange={setPhotoState}
        onReorder={
          unitId
            ? async (next) => {
                const before = photos;
                setPhotos(next);
                const result = await reorderUnitPhotos(
                  unitId,
                  next.map((p) => p.id),
                );
                if (!result.ok) {
                  setPhotos(before);
                  toast.danger(result.error);
                }
              }
            : undefined
        }
        onRemove={
          unitId
            ? async (photo) => {
                const result = await removeUnitPhoto(unitId, photo.id);
                if (!result.ok) {
                  toast.danger(result.error);
                  return;
                }
                setPhotos(result.value.photos.map(asPhoto));
              }
            : undefined
        }
      />
      <VideoField
        label="Video tour"
        video={video}
        maxBytes={UNIT_VIDEO_MAX_BYTES}
        isDisabled={isDisabled}
        upload={uploadVideo}
        onUploaded={setVideo}
        onStateChange={setVideoState}
        onRemove={
          unitId
            ? async () => {
                const result = await removeUnitVideo(unitId);
                if (!result.ok) {
                  toast.danger(result.error);
                  return;
                }
                setVideo(null);
              }
            : undefined
        }
      />
    </>
  );
}
