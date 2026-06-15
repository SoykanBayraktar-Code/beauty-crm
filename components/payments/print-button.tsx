"use client";

import { IconPrinter } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <IconPrinter size={16} aria-hidden />
      Yazdır
    </Button>
  );
}
