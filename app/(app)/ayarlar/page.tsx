import { IconPlus, IconEdit } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMembership } from "@/lib/auth/dal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConsentTemplateDialog } from "@/components/settings/consent-template-dialog";
import { MemberFormDialog } from "@/components/settings/member-form-dialog";
import {
  MembersList,
  type MemberView,
} from "@/components/settings/members-list";

const ACTION_LABELS: Record<string, string> = {
  "payment.take": "Ödeme alındı",
  "package.sell": "Paket satıldı",
  "consent.grant": "Onam alındı",
  "anamnesis.update": "Anamnez güncellendi",
  "treatment.create": "Klinik kayıt eklendi",
  "photo.upload": "Fotoğraf yüklendi",
  "photo.delete": "Fotoğraf silindi",
  "customer.create": "Müşteri eklendi",
  "customer.update": "Müşteri güncellendi",
  "customer.delete": "Müşteri silindi",
  "member.invite": "Personel eklendi",
  "member.role_change": "Rol değiştirildi",
  "member.deactivate": "Personel pasifleştirildi",
  "clinical_access.grant": "Klinik erişim açıldı",
  "clinical_access.revoke": "Klinik erişim iptal",
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

  // Personel listesi (owner-only; e-postalar auth.users'tan admin ile)
  let members: MemberView[] = [];
  if (isOwner) {
    const [{ data: memberRows }, { data: staffRows }] = await Promise.all([
      supabase
        .from("org_members")
        .select("id, role, user_id")
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
      supabase.from("staff").select("member_id, full_name").is("deleted_at", null),
    ]);
    const nameByMember = new Map<string, string>();
    for (const s of staffRows ?? [])
      if (s.member_id) nameByMember.set(s.member_id, s.full_name);

    const admin = createAdminClient();
    members = await Promise.all(
      (memberRows ?? []).map(async (mr) => {
        const { data: u } = await admin.auth.admin.getUserById(mr.user_id);
        return {
          memberId: mr.id,
          name: nameByMember.get(mr.id) ?? "—",
          email: u?.user?.email ?? "—",
          role: mr.role,
          isSelf: mr.id === membership.member_id,
        };
      }),
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Ayarlar</h1>
        <p className="text-muted-foreground mt-1">
          {membership.organizations?.name}
        </p>
      </div>

      <Tabs defaultValue={isOwner ? "personel" : "onam"}>
        <TabsList>
          {isOwner ? <TabsTrigger value="personel">Personel & Roller</TabsTrigger> : null}
          <TabsTrigger value="onam">Onam Metinleri</TabsTrigger>
          {isOwner ? <TabsTrigger value="denetim">Denetim Kaydı</TabsTrigger> : null}
        </TabsList>

        {isOwner ? (
          <TabsContent value="personel">
            <Card>
              <CardContent className="space-y-3 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium">Personel & Roller</h2>
                    <p className="text-muted-foreground text-xs">
                      Ekip üyeleri, rolleri ve erişimleri
                    </p>
                  </div>
                  <MemberFormDialog>
                    <IconPlus size={16} aria-hidden />
                    Personel ekle
                  </MemberFormDialog>
                </div>
                <MembersList members={members} />
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        <TabsContent value="onam">
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
        </TabsContent>

        {isOwner ? (
          <TabsContent value="denetim">
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
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
