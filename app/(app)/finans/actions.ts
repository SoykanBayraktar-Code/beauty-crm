"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership, getUser } from "@/lib/auth/dal";
import { logAudit } from "@/lib/audit";

export type FinanceState = { error?: string; ok?: boolean } | undefined;

const clean = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};
const num = (v: FormDataEntryValue | null, def = 0) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : def;
};

const EXPENSE_CATS = ["rent", "supplies", "salary", "utilities", "other"];

export async function openCashSession(
  _prev: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  const m = await requireMembership();
  const user = await getUser();
  const opening = Math.max(0, num(formData.get("opening_float")));

  const supabase = await createClient();
  const { error } = await supabase.from("cash_sessions").insert({
    org_id: m.org_id,
    opened_by: user?.id ?? null,
    opening_float: opening,
  });
  if (error) {
    return {
      error: /one_open|duplicate|unique/i.test(error.message)
        ? "Zaten açık bir kasa var. Önce onu kapatın."
        : error.message,
    };
  }
  await logAudit("cash.open", "cash_session", null, { opening_float: opening });
  revalidatePath("/finans");
  return { ok: true };
}

export async function closeCashSession(
  _prev: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  const m = await requireMembership();
  const user = await getUser();
  const sessionId = clean(formData.get("session_id"));
  if (!sessionId) return { error: "Kasa oturumu gerekli." };
  const counted = Math.max(0, num(formData.get("counted_amount")));

  const supabase = await createClient();

  // M12: kapanış mutabakatını kalıcılaştır — beklenen = açılış float + oturum
  // boyunca nakit satış. Sapma (counted - expected) denetlenebilir kalır.
  const { data: session } = await supabase
    .from("cash_sessions")
    .select("opening_float, opened_at")
    .eq("id", sessionId)
    .is("closed_at", null)
    .maybeSingle();
  if (!session) return { error: "Açık kasa bulunamadı." };

  const { data: cashPays } = await supabase
    .from("payments")
    .select("amount")
    .eq("org_id", m.org_id)
    .eq("method", "cash")
    .gte("paid_at", session.opened_at)
    .is("deleted_at", null);
  const cashSales = (cashPays ?? []).reduce(
    (s, p) => s + Number(p.amount ?? 0),
    0,
  );
  const expected =
    Math.round((Number(session.opening_float) + cashSales) * 100) / 100;

  const { error } = await supabase
    .from("cash_sessions")
    .update({
      counted_amount: counted,
      expected_amount: expected,
      closed_by: user?.id ?? null,
      closed_at: new Date().toISOString(),
      note: clean(formData.get("note")),
    })
    .eq("id", sessionId)
    .is("closed_at", null);
  if (error) return { error: error.message };

  await logAudit("cash.close", "cash_session", sessionId, {
    counted,
    expected,
    variance: Math.round((counted - expected) * 100) / 100,
  });
  revalidatePath("/finans");
  return { ok: true };
}

export async function addExpense(
  _prev: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  const m = await requireMembership();
  const user = await getUser();
  const amount = num(formData.get("amount"));
  if (amount <= 0) return { error: "Tutar 0'dan büyük olmalı." };
  const category = String(formData.get("category") ?? "other");

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    org_id: m.org_id,
    category: EXPENSE_CATS.includes(category) ? category : "other",
    amount,
    spent_on: clean(formData.get("spent_on")) ?? undefined,
    note: clean(formData.get("note")),
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  await logAudit("expense.add", "expense", null, { amount, category });
  revalidatePath("/finans");
  return { ok: true };
}

export async function deleteExpense(formData: FormData) {
  await requireMembership();
  const id = clean(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[deleteExpense] silme hatası:", error.message);
    return;
  }
  await logAudit("expense.delete", "expense", id, {});
  revalidatePath("/finans");
}
