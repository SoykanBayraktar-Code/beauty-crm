import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ModulePlaceholder({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Badge variant="secondary">{phase}</Badge>
          <p className="text-muted-foreground max-w-sm text-sm">
            Bu modül {phase} kapsamında geliştirilecek. İskelet ve navigasyon
            hazır.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
