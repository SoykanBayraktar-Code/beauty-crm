import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { IconSparkles } from "@tabler/icons-react";

const swatches = [
  { name: "background", className: "bg-background" },
  { name: "card", className: "bg-card" },
  { name: "primary", className: "bg-primary" },
  { name: "accent", className: "bg-accent" },
  { name: "secondary", className: "bg-secondary" },
  { name: "muted", className: "bg-muted" },
  { name: "success", className: "bg-[var(--success)]" },
  { name: "warning", className: "bg-[var(--warning)]" },
  { name: "destructive", className: "bg-destructive" },
];

export default function StylePreviewPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
            <IconSparkles size={20} aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-medium tracking-tight">Lumea</h1>
            <p className="text-muted-foreground text-sm">
              Tasarım sistemi · lux minimal
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <section className="mb-10">
        <h2 className="text-muted-foreground mb-3 text-sm font-medium">
          Renk paleti
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {swatches.map((s) => (
            <div key={s.name} className="text-center">
              <div
                className={`${s.className} border-border mb-2 h-16 w-full rounded-lg border`}
              />
              <span className="text-muted-foreground text-xs">{s.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-muted-foreground mb-3 text-sm font-medium">
          Butonlar
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Yeni randevu</Button>
          <Button variant="secondary">İkincil</Button>
          <Button variant="outline">Dış çizgi</Button>
          <Button variant="ghost">Hayalet</Button>
          <Button variant="destructive">İptal et</Button>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-muted-foreground mb-3 text-sm font-medium">
          Durum etiketleri
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Planlandı</Badge>
          <Badge variant="secondary">Geldi</Badge>
          <Badge variant="outline">Onaylandı</Badge>
          <Badge variant="destructive">Gelmedi</Badge>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bugünkü gelir</CardTitle>
            <CardDescription>Geçen haftaya göre +%12</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-medium tabular-nums">₺18.450</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hızlı müşteri ekle</CardTitle>
            <CardDescription>Form ve girdi stilleri</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Ad soyad</Label>
              <Input id="name" placeholder="Ayşe Kaya" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" placeholder="+90 5__ ___ __ __" />
            </div>
            <Button className="w-full">Kaydet</Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
