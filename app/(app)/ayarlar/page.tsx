import { IconPlus, IconEdit } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/auth/dal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConsentTemplateDialog } from "@/components/settings/consent-template-dialog";

const ACTION_LABELS: Record<string, string> = {
  "payment.take": "Ödeme alındı",
  "package.sell": "Paket satıldı",
  "consent.grant": "Onam alındı",
};

const dtFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AyarlarPage() {
  const membership = await requireMembership();
  const isOwner = membership.role === "owner";
  const supabase = await createClient();

  const [{ data: templates }, { data: audit }] = await Promise.all([
    supabase
      .from("consent_templates")
      .select("id, name, body, version")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("audit_log")
      .select("id, action, entity, meta, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const tpls = templates ?? [];
  const log = audit ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Ayarlar</h1>
        <p className="text-muted-foreground mt-1">
          {membership.organizations?.name}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium">Onam Metinleri (KVKK)</h2>
              <p className="text-muted-foreground text-xs">
                Müşterilerden alınacak açık rıza metinleri
              </p>
            </div>
            {isOwner ? (
              <ConsentTemplateDialog size="sm">
                <IconPlus size={16} aria-hidden />
                Yeni metin
              </ConsentTemplateDialog>
            ) : null}
          </div>

          {tpls.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Henüz onam metni yok.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {tpls.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      v{t.version} · {t.body.slice(0, 60)}…
                    </p>
                  </div>
                  {isOwner ? (
                    <ConsentTemplateDialog
                      template={t}
                      variant="ghost"
                      size="icon"
                    >
                      <IconEdit size={16} aria-hidden />
                      <span className="sr-only">Düzenle</span>
                    </ConsentTemplateDialog>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {isOwner ? (
        <Card>
          <CardContent className="space-y-3 py-5">
            <div>
              <h2 className="text-sm font-medium">Denetim Kaydı (audit log)</h2>
              <p className="text-muted-foreground text-xs">
                Hassas işlemlerin izi — KVKK uyumu
              </p>
            </div>
            {log.length === 0 ? (
              <p className="text-muted-foreground text-sm">Kayıt yok.</p>
            ) : (
              <ul className="divide-border divide-y">
                {log.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <Badge variant="secondary">
                      {ACTION_LABELS[e.action] ?? e.action}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {dtFmt.format(new Date(e.created_at))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
