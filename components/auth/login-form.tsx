"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";

import { BrandWithTagline } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: window.location.origin },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;
      if (!response.ok || !payload?.ok) {
        setError(payload?.error?.message ?? "Could not sign in. Try again.");
        return;
      }
      window.location.assign(nextPath);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc]">
      <header className="flex items-center justify-between border-b border-border bg-white px-6 py-4 lg:px-10">
        <BrandWithTagline />
        <Link
          href="/status"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Public status
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-5">
          <div className="space-y-1.5 text-center">
            <div className="mx-auto flex size-10 items-center justify-center rounded-lg border border-border bg-white text-foreground">
              <LockKeyhole className="size-4" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Administrator sign in
            </h1>
            <p className="text-sm text-muted-foreground">
              Access the private monitoring and API workspace.
            </p>
          </div>
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Sign in</CardTitle>
              <CardDescription>Use the administrator credentials configured for this instance.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
                {error ? (
                  <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </CardContent>
          </Card>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Sessions expire after eight hours. Public status is available without signing in.
          </p>
        </div>
      </main>
    </div>
  );
}
