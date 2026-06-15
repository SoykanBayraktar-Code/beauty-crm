export type SchemaFieldType = "text" | "number" | "select" | "textarea";

export type SchemaField = {
  key: string;
  label: string;
  type: SchemaFieldType;
  unit?: string;
  options?: string[];
};

export const FIELD_TYPE_LABELS: Record<SchemaFieldType, string> = {
  text: "Metin",
  number: "Sayı",
  select: "Seçim",
  textarea: "Uzun metin",
};

export type ProcedureTemplate = {
  name: string;
  category: string;
  is_medical: boolean;
  requires_consent: boolean;
  fields: SchemaField[];
};

/** Hazır işlem şablonları — sektör/klinik dokümantasyon standardına göre. */
export const PROCEDURE_TEMPLATES: ProcedureTemplate[] = [
  {
    name: "Lazer Epilasyon",
    category: "Lazer",
    is_medical: true,
    requires_consent: true,
    fields: [
      { key: "cihaz", label: "Cihaz", type: "text" },
      { key: "dalga_boyu", label: "Dalga boyu", type: "number", unit: "nm" },
      { key: "fluence", label: "Fluence", type: "number", unit: "J/cm²" },
      { key: "spot", label: "Spot boyu", type: "number", unit: "mm" },
      { key: "pulse", label: "Pulse süresi", type: "number", unit: "ms" },
      { key: "atis_sayisi", label: "Atış sayısı", type: "number" },
      { key: "bolge", label: "Bölge", type: "text" },
      {
        key: "fitzpatrick",
        label: "Fitzpatrick",
        type: "select",
        options: ["I", "II", "III", "IV", "V", "VI"],
      },
    ],
  },
  {
    name: "Enjeksiyon (Botoks/Dolgu)",
    category: "Enjeksiyon",
    is_medical: true,
    requires_consent: true,
    fields: [
      { key: "urun", label: "Ürün/marka", type: "text" },
      { key: "lot_no", label: "Lot no", type: "text" },
      { key: "skt", label: "Son kullanma", type: "text" },
      { key: "sulandirma", label: "Sulandırma", type: "text" },
      { key: "bolge", label: "Bölge", type: "text" },
      { key: "doz", label: "Doz", type: "number", unit: "U/mL" },
      { key: "teknik", label: "Teknik", type: "text" },
    ],
  },
  {
    name: "Kimyasal Peeling",
    category: "Medikal cilt",
    is_medical: true,
    requires_consent: true,
    fields: [
      { key: "solusyon", label: "Solüsyon", type: "text" },
      { key: "konsantrasyon", label: "Konsantrasyon", type: "number", unit: "%" },
      { key: "katman", label: "Katman sayısı", type: "number" },
      { key: "bekleme", label: "Bekleme süresi", type: "number", unit: "dk" },
      { key: "notlar", label: "Gözlem", type: "textarea" },
    ],
  },
  {
    name: "Kalıcı Makyaj",
    category: "Kalıcı makyaj",
    is_medical: true,
    requires_consent: true,
    fields: [
      {
        key: "bolge",
        label: "Bölge",
        type: "select",
        options: ["Kaş", "Eyeliner", "Dudak"],
      },
      { key: "pigment", label: "Pigment marka", type: "text" },
      { key: "renk_kodu", label: "Renk kodu", type: "text" },
      { key: "lot", label: "Lot", type: "text" },
      { key: "igne", label: "İğne tipi", type: "text" },
      { key: "anestezi", label: "Topikal anestezi", type: "text" },
    ],
  },
];

export function slugifyKey(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/ı/g, "i")
      .replace(/ş/g, "s")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "alan"
  );
}
