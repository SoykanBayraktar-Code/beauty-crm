"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconTrash } from "@tabler/icons-react";
import { deleteTreatmentPhoto } from "@/app/(app)/musteriler/actions";

export type PhotoItem = {
  id: string;
  kind: "before" | "after";
  storage_path: string;
  caption: string | null;
  taken_at: string;
  url: string | null;
};

const dateFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function BeforeAfterSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = React.useState(50);
  return (
    <div className="border-border relative aspect-[4/3] w-full select-none overflow-hidden rounded-lg border">
      {/* eslint-disable @next/next/no-img-element */}
      <img
        src={after}
        alt="Sonrası"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <img
        src={before}
        alt="Öncesi"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      {/* eslint-enable @next/next/no-img-element */}
      <span className="absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-xs font-medium text-white">
        Öncesi
      </span>
      <span className="absolute right-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-xs font-medium text-white">
        Sonrası
      </span>
      <div
        className="pointer-events-none absolute inset-y-0"
        style={{ left: `${pos}%` }}
      >
        <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/90 shadow-[0_0_4px_rgba(0,0,0,0.5)]" />
        <div className="absolute top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs text-black shadow">
          ↔
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Öncesi/sonrası karşılaştırma kaydırıcısı"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

function PhotoCard({
  photo,
  customerId,
}: {
  photo: PhotoItem;
  customerId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm("Bu fotoğraf silinsin mi?")) return;
    const fd = new FormData();
    fd.set("id", photo.id);
    fd.set("customer_id", customerId);
    fd.set("storage_path", photo.storage_path);
    startTransition(async () => {
      await deleteTreatmentPhoto(fd);
      router.refresh();
    });
  }

  return (
    <div className="border-border group relative overflow-hidden rounded-lg border">
      {photo.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.url}
          alt={photo.caption ?? photo.kind}
          className="aspect-square w-full object-cover"
        />
      ) : (
        <div className="bg-muted text-muted-foreground flex aspect-square w-full items-center justify-center text-xs">
          Görsel yok
        </div>
      )}
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        aria-label="Sil"
        className="absolute right-1.5 top-1.5 rounded-md bg-black/55 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-50"
      >
        <IconTrash size={15} aria-hidden />
      </button>
      <div className="p-2">
        {photo.caption ? (
          <p className="truncate text-xs">{photo.caption}</p>
        ) : null}
        <p className="text-muted-foreground text-xs">
          {dateFmt.format(new Date(photo.taken_at))}
        </p>
      </div>
    </div>
  );
}

export function PhotoGallery({
  customerId,
  photos,
}: {
  customerId: string;
  photos: PhotoItem[];
}) {
  if (photos.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Henüz fotoğraf yok.</p>
    );
  }

  const before = photos.filter((p) => p.kind === "before");
  const after = photos.filter((p) => p.kind === "after");
  const latestBefore = before[0]?.url ?? null;
  const latestAfter = after[0]?.url ?? null;

  return (
    <div className="space-y-6">
      {latestBefore && latestAfter ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            Karşılaştırma (en güncel öncesi / sonrası) — sürükleyin
          </p>
          <BeforeAfterSlider before={latestBefore} after={latestAfter} />
        </div>
      ) : null}

      {[
        { title: "Öncesi", list: before },
        { title: "Sonrası", list: after },
      ].map((g) =>
        g.list.length > 0 ? (
          <div key={g.title} className="space-y-2">
            <p className="text-sm font-medium">
              {g.title}{" "}
              <span className="text-muted-foreground font-normal">
                ({g.list.length})
              </span>
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {g.list.map((p) => (
                <PhotoCard key={p.id} photo={p} customerId={customerId} />
              ))}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}
