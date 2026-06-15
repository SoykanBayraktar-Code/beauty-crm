"use client";

import * as React from "react";
import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const action = mode === "login" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">E-posta</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="ornek@merkez.com"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Şifre</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder="••••••••"
          minLength={6}
          required
        />
      </div>

      {state?.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending
          ? "Lütfen bekleyin…"
          : mode === "login"
            ? "Giriş yap"
            : "Hesap oluştur"}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        {mode === "login" ? "Hesabın yok mu? " : "Zaten hesabın var mı? "}
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          {mode === "login" ? "Kayıt ol" : "Giriş yap"}
        </button>
      </p>
    </form>
  );
}
