import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SetupForm } from "@/components/auth/setup-form";
import { requireUser } from "@/lib/auth/dal";

export default async function SetupPage() {
  await requireUser();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Merkezinizi kurun</CardTitle>
        <CardDescription>
          Başlamak için merkez bilgilerinizi girin. Yönetici olarak
          eklenirsiniz.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SetupForm />
      </CardContent>
    </Card>
  );
}
