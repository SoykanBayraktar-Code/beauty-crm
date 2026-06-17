// Müşteri gelişmiş filtre motoru — URL paramları ↔ filtre nesnesi (sunucu + istemci ortak).

export type CustomerFilters = {
  q: string;
  gender: string;
  source: string;
  tags: string[];
  ageMin: string;
  ageMax: string;
  createdFrom: string;
  createdTo: string;
  hasPackage: "" | "yes" | "no";
};

export type RawParams = Record<string, string | undefined>;

export function parseFilters(sp: RawParams): CustomerFilters {
  const hp = sp.hasPackage;
  return {
    // Enjeksiyon-güvenli: PostgREST anlamlı karakterleri ele
    q: (sp.q ?? "").replace(/[^\p{L}\p{N}\s]/gu, " ").trim(),
    gender: sp.gender ?? "",
    source: (sp.source ?? "").trim(),
    tags: (sp.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    ageMin: (sp.ageMin ?? "").trim(),
    ageMax: (sp.ageMax ?? "").trim(),
    createdFrom: (sp.createdFrom ?? "").trim(),
    createdTo: (sp.createdTo ?? "").trim(),
    hasPackage: hp === "yes" || hp === "no" ? hp : "",
  };
}

export function hasAnyFilter(f: CustomerFilters): boolean {
  return Boolean(
    f.q ||
      f.gender ||
      f.source ||
      f.tags.length ||
      f.ageMin ||
      f.ageMax ||
      f.createdFrom ||
      f.createdTo ||
      f.hasPackage,
  );
}

const GENDER_LABELS: Record<string, string> = {
  female: "Kadın",
  male: "Erkek",
  other: "Diğer",
};

/** Aktif filtreleri "çip" olarak göstermek için (key = kaldırılacak param(lar)). */
export function filterChips(f: CustomerFilters): { key: string; label: string }[] {
  const chips: { key: string; label: string }[] = [];
  if (f.q) chips.push({ key: "q", label: `Ara: "${f.q}"` });
  if (f.gender)
    chips.push({ key: "gender", label: GENDER_LABELS[f.gender] ?? f.gender });
  if (f.source) chips.push({ key: "source", label: `Kaynak: ${f.source}` });
  if (f.tags.length)
    chips.push({ key: "tags", label: `Etiket: ${f.tags.join(", ")}` });
  if (f.ageMin || f.ageMax)
    chips.push({
      key: "ageMin,ageMax",
      label: `Yaş: ${f.ageMin || "0"}–${f.ageMax || "∞"}`,
    });
  if (f.createdFrom || f.createdTo)
    chips.push({
      key: "createdFrom,createdTo",
      label: `Kayıt: ${f.createdFrom || "…"} → ${f.createdTo || "…"}`,
    });
  if (f.hasPackage)
    chips.push({
      key: "hasPackage",
      label: f.hasPackage === "yes" ? "Aktif paketi var" : "Aktif paketi yok",
    });
  return chips;
}

/** Yaş aralığını birth_date sınırlarına çevirir (gte/lte ISO tarih). */
export function ageToBirthRange(
  ageMin: string,
  ageMax: string,
  now: Date,
): { gte?: string; lte?: string } {
  const out: { gte?: string; lte?: string } = {};
  const min = Number(ageMin);
  const max = Number(ageMax);
  if (ageMin && Number.isFinite(min)) {
    // en az `min` yaşında → bugünden `min` yıl öncesine kadar doğanlar
    out.lte = new Date(now.getFullYear() - min, now.getMonth(), now.getDate())
      .toISOString()
      .slice(0, 10);
  }
  if (ageMax && Number.isFinite(max)) {
    // en fazla `max` yaşında → bugünden (max+1) yıl öncesinden sonra doğanlar
    out.gte = new Date(
      now.getFullYear() - max - 1,
      now.getMonth(),
      now.getDate() + 1,
    )
      .toISOString()
      .slice(0, 10);
  }
  return out;
}
