"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership, getUser } from "@/lib/auth/dal";

export type ApptState = { error?: string; ok?: boolean } | undefined;

const clean = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

// Türkiye sabit UTC+3 (DST yok)
const TZ_OFFSET = "+03:00";

export async function createAppointment(
  _prev: ApptState,
  formData: FormData,
): Promise<ApptState> {
  const m = await requireMembership();
  const user = await getUser();

  const customerId = clean(formData.get("customer_id"));
  const staffId = clean(formData.get("staff_id"));
  const serviceId = clean(formData.get("service_id"));
  const date = clean(formData.get("date"));
  const time = clean(formData.get("time"));
  const packageId = clean(formData.get("customer_package_id"));
  const notes = clean(formData.get("notes"));

  if (!customerId || !staffId || !date || !time) {
    return { error: "Müşteri, uzman, tarih ve saat zorunlu." };
  }

  const supabase = await createClient();

  let durationMin = 30;
  if (serviceId) {
    const { data: svc } = await supabase
      .from("services")
      .select("duration_min")
      .eq("id", serviceId)
      .maybeSingle();
    if (svc?.duration_min) durationMin = svc.duration_min;
  }

  const start = new Date(`${date}T${time}:00${TZ_OFFSET}`);
  if (Number.isNaN(start.getTime())) return { error: "Geçersiz tarih/saat." };
  const end = new Date(start.getTime() + durationMin * 60000);

  const { error } = await supabase.from("appointments").insert({
    org_id: m.org_id,
    customer_id: customerId,
    staff_id: staffId,
    service_id: serviceId,
    customer_package_id: packageId,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    notes,
    created_by: user?.id ?? null,
  });

  if (error) {
    if (error.code === "23P01") {
      return { error: "Bu uzmanın o saatte başka randevusu var (çakışma)." };
    }
    return { error: error.message };
  }

  revalidatePath("/takvim");
  return { ok: true };
}

export async function updateAppointmentStatus(formData: FormData) {
  await requireMembership();
  const id = clean(formData.get("id"));
  const status = clean(formData.get("status"));
  const valid = [
    "scheduled",
    "confirmed",
    "arrived",
    "in_progress",
    "completed",
    "no_show",
    "cancelled",
  ];
  if (!id || !status || !valid.includes(status)) return;

  const supabase = await createClient();
  await supabase.from("appointments").update({ status }).eq("id", id);
  revalidatePath("/takvim");
}
