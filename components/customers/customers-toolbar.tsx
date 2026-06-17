"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  IconSearch,
  IconPlus,
  IconFilter,
  IconX,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CustomerFormDialog } from "./customer-form-dialog";
import { saveSegment, deleteSegment } from "@/app/(app)/musteriler/actions";
import { parseFilters, filterChips } from "@/lib/customer-filters";

const selectClass =
  "border-input bg-card h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

const FILTER_FIELDS = [
  "gender",
  "source",
  "tags",
  "ageMin",
  "ageMax",
  "createdFrom",
  "createdTo",
  "hasPackage",
] as const;

export type SavedSegment = {
  id: string;
  name: string;
  criteria: Record<string, string>;
};

export function CustomersToolbar({
  segments = [],
}: {
  segments?: SavedSegment[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = React.useState(searchParams.get("q") ?? "");
  const [showPanel, setShowPanel] = React.useState(false);

  const get = (k: string) => searchParams.get(k) ?? "";
  const [draft, setDraft] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(FILTER_FIELDS.map((k) => [k, get(k)])),
  );

  const pushParam = React.useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(window.location.search);
      if (value) params.set(key, value);
      else params.delete(key);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname],
  );

  React.useEffect(() => {
    const t = setTimeout(() => pushParam("q", q), 300);
    return () => clearTimeout(t);
  }, [q, pushParam]);

  function applyFilters() {
    const params = new URLSearchParams(window.location.search);
    for (const k of FILTER_FIELDS) {
      if (draft[k]) params.set(k, draft[k]);
      else params.delete(k);
    }
    router.replace(`${pathname}?${params.toString()}`);
    setShowPanel(false);
  }

  function removeChip(key: string) {
    const params = new URLSearchParams(window.location.search);
    for (const k of key.split(",")) params.delete(k);
    if (key.split(",").includes("q")) setQ("");
    setDraft((d) => {
      const next = { ...d };
      for (const k of key.split(",")) if (k in next) next[k] = "";
      return next;
    });
    router.replace(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    setQ("");
    setDraft(Object.fromEntries(FILTER_FIELDS.map((k) => [k, ""])));
    router.replace(pathname);
  }

  function applySegment(seg: SavedSegment) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(seg.criteria))
      if (v) params.set(k, String(v));
    setQ(String(seg.criteria.q ?? ""));
    setDraft(
      Object.fromEntries(
        FILTER_FIELDS.map((k) => [k, String(seg.criteria[k] ?? "")]),
      ),
    );
    router.replace(`${pathname}?${params.toString()}`);
  }

  function saveCurrentAsSegment() {
    const name = window.prompt("Segment adı:");
    if (!name) return;
    const criteria: Record<string, string> = {};
    new URLSearchParams(window.location.search).forEach((v, k) => {
      if (v) criteria[k] = v;
    });
    const fd = new FormData();
    fd.set("name", name);
    fd.set("criteria", JSON.stringify(criteria));
    start(async () => {
      const res = await saveSegment(undefined, fd);
      if (res?.error) alert(res.error);
      else router.refresh();
    });
  }

  function removeSegment(id: string) {
    if (!confirm("Bu segment silinsin mi?")) return;
    const fd = new FormData();
    fd.set("id", id);
    start(async () => {
      await deleteSegment(fd);
      router.refresh();
    });
  }

  const chips = filterChips(
    parseFilters(Object.fromEntries(searchParams.entries())),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <IconSearch
            size={16}
            aria-hidden
            className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ad veya telefon ara…"
            className="pl-9"
            aria-label="Müşteri ara"
          />
        </div>
        <Button
          type="button"
          variant={showPanel ? "default" : "outline"}
          size="sm"
          onClick={() => setShowPanel((s) => !s)}
        >
          <IconFilter size={16} aria-hidden />
          Filtreler
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={saveCurrentAsSegment}
          disabled={pending || chips.length === 0}
        >
          <IconDeviceFloppy size={16} aria-hidden />
          Segment kaydet
        </Button>
        <CustomerFormDialog className="ml-auto">
          <IconPlus size={16} aria-hidden />
          Yeni müşteri
        </CustomerFormDialog>
      </div>

      {segments.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Segmentler:</span>
          {segments.map((seg) => (
            <span
              key={seg.id}
              className="bg-accent text-accent-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
            >
              <button
                type="button"
                onClick={() => applySegment(seg)}
                className="hover:underline"
              >
                {seg.name}
              </button>
              <button
                type="button"
                aria-label="Segmenti sil"
                onClick={() => removeSegment(seg.id)}
                className="opacity-60 hover:opacity-100"
              >
                <IconX size={12} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {showPanel ? (
        <div className="border-border bg-card grid grid-cols-2 gap-3 rounded-lg border p-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="f_gender">Cinsiyet</Label>
            <select
              id="f_gender"
              className={`${selectClass} w-full`}
              value={draft.gender}
              onChange={(e) => setDraft((d) => ({ ...d, gender: e.target.value }))}
            >
              <option value="">Tümü</option>
              <option value="female">Kadın</option>
              <option value="male">Erkek</option>
              <option value="other">Diğer</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f_source">Kaynak</Label>
            <Input
              id="f_source"
              value={draft.source}
              onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
              placeholder="Instagram…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f_tags">Etiket(ler)</Label>
            <Input
              id="f_tags"
              value={draft.tags}
              onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
              placeholder="vip, lazer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f_pkg">Aktif paket</Label>
            <select
              id="f_pkg"
              className={`${selectClass} w-full`}
              value={draft.hasPackage}
              onChange={(e) =>
                setDraft((d) => ({ ...d, hasPackage: e.target.value }))
              }
            >
              <option value="">Farketmez</option>
              <option value="yes">Var</option>
              <option value="no">Yok</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f_agemin">Yaş ≥</Label>
            <Input
              id="f_agemin"
              type="number"
              min={0}
              value={draft.ageMin}
              onChange={(e) => setDraft((d) => ({ ...d, ageMin: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f_agemax">Yaş ≤</Label>
            <Input
              id="f_agemax"
              type="number"
              min={0}
              value={draft.ageMax}
              onChange={(e) => setDraft((d) => ({ ...d, ageMax: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f_from">Kayıt ≥</Label>
            <Input
              id="f_from"
              type="date"
              value={draft.createdFrom}
              onChange={(e) =>
                setDraft((d) => ({ ...d, createdFrom: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f_to">Kayıt ≤</Label>
            <Input
              id="f_to"
              type="date"
              value={draft.createdTo}
              onChange={(e) =>
                setDraft((d) => ({ ...d, createdTo: e.target.value }))
              }
            />
          </div>
          <div className="col-span-2 flex gap-2 sm:col-span-4">
            <Button type="button" size="sm" onClick={applyFilters}>
              Filtreyi uygula
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              Tümünü temizle
            </Button>
          </div>
        </div>
      ) : null}

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <Badge key={c.key} variant="secondary" className="gap-1">
              {c.label}
              <button
                type="button"
                aria-label="Filtreyi kaldır"
                onClick={() => removeChip(c.key)}
                className="opacity-60 hover:opacity-100"
              >
                <IconX size={12} aria-hidden />
              </button>
            </Badge>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-muted-foreground hover:text-foreground text-xs underline"
          >
            Tümünü temizle
          </button>
        </div>
      ) : null}
    </div>
  );
}
