import { IconPlus } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { CalendarNav } from "@/components/appointments/calendar-nav";
import { NewAppointmentDialog } from "@/components/appointments/new-appointment-dialog";
import {
  AppointmentBlock,
  type ApptStatus,
} from "@/components/appointments/appointment-block";

const TZ = "Europe/Istanbul";
const DAY_START_MIN = 9 * 60;
const DAY_END_MIN = 21 * 60;
const HOUR_PX = 56;
const TOTAL_PX = ((DAY_END_MIN - DAY_START_MIN) / 60) * HOUR_PX;

const timeFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const labelFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
});

function minutesIst(iso: string): number {
  const parts = timeFmt.formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}
function relName(rel: unknown): string {
  if (!rel) return "—";
  if (Array.isArray(rel)) return rel[0]?.name ?? rel[0]?.full_name ?? "—";
  const o = rel as { name?: string; full_name?: string };
  return o.name ?? o.full_name ?? "—";
}

export default async function TakvimPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(
    new Date(),
  );
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;

  const startISO = new Date(`${date}T00:00:00+03:00`).toISOString();
  const endISO = new Date(
    new Date(`${date}T00:00:00+03:00`).getTime() + 86400000,
  ).toISOString();

  const supabase = await createClient();
  const [{ data: staff }, { data: services }, { data: customers }, { data: appts }] =
    await Promise.all([
      supabase
        .from("staff")
        .select("id, full_name")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("full_name"),
      supabase
        .from("services")
        .select("id, name")
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("customers")
        .select("id, full_name")
        .is("deleted_at", null)
        .order("full_name")
        .limit(500),
      supabase
        .from("appointments")
        .select(
          "id, staff_id, start_at, end_at, status, customers(full_name), services(name)",
        )
        .is("deleted_at", null)
        .gte("start_at", startISO)
        .lt("start_at", endISO),
    ]);

  const staffList = staff ?? [];
  const hours = Array.from(
    { length: (DAY_END_MIN - DAY_START_MIN) / 60 + 1 },
    (_, i) => 9 + i,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Takvim</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {appts?.length ?? 0} randevu
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CalendarNav date={date} label={labelFmt.format(new Date(`${date}T12:00:00+03:00`))} />
          <NewAppointmentDialog
            customers={customers ?? []}
            services={services ?? []}
            staff={staffList}
            defaultDate={date}
          >
            <IconPlus size={16} aria-hidden />
            Yeni randevu
          </NewAppointmentDialog>
        </div>
      </div>

      {staffList.length === 0 ? (
        <Card className="text-muted-foreground p-12 text-center text-sm">
          Önce Ayarlar&apos;dan personel ekleyin.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <div
            className="grid min-w-[640px]"
            style={{
              gridTemplateColumns: `56px repeat(${staffList.length}, minmax(140px, 1fr))`,
            }}
          >
            <div className="border-border border-b" />
            {staffList.map((s) => (
              <div
                key={s.id}
                className="border-border truncate border-b border-l px-2 py-2 text-center text-sm font-medium"
              >
                {s.full_name}
              </div>
            ))}

            <div className="relative" style={{ height: TOTAL_PX }}>
              {hours.map((h) => (
                <div
                  key={h}
                  className="text-muted-foreground absolute right-1 -translate-y-1/2 text-[11px]"
                  style={{ top: ((h * 60 - DAY_START_MIN) / 60) * HOUR_PX }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {staffList.map((s) => {
              const dayAppts = (appts ?? []).filter((a) => a.staff_id === s.id);
              return (
                <div
                  key={s.id}
                  className="border-border relative border-l"
                  style={{ height: TOTAL_PX }}
                >
                  {hours.slice(0, -1).map((h) => (
                    <div
                      key={h}
                      className="border-border/60 absolute right-0 left-0 border-t"
                      style={{ top: ((h * 60 - DAY_START_MIN) / 60) * HOUR_PX }}
                    />
                  ))}
                  {dayAppts.map((a) => {
                    const startM = minutesIst(a.start_at);
                    const endM = minutesIst(a.end_at);
                    const top = ((startM - DAY_START_MIN) / 60) * HOUR_PX;
                    const height = ((endM - startM) / 60) * HOUR_PX;
                    return (
                      <AppointmentBlock
                        key={a.id}
                        id={a.id}
                        topPx={Math.max(0, top)}
                        heightPx={height}
                        timeLabel={timeFmt.format(new Date(a.start_at))}
                        customerName={relName(a.customers)}
                        serviceName={
                          a.services ? relName(a.services) : null
                        }
                        status={a.status as ApptStatus}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
