"use client";

import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  API_KEY_LOCATIONS,
  AUTH_TYPES,
  type ApiKeyLocation,
  type AuthConfig,
  type AuthType,
} from "@/lib/requests/schema";

const authLabels: Record<AuthType, string> = {
  none: "No Auth",
  bearer: "Bearer Token",
  basic: "Basic Auth",
  apiKey: "API Key",
};

function defaultAuthFor(type: AuthType): AuthConfig {
  switch (type) {
    case "bearer":
      return { type: "bearer", token: "" };
    case "basic":
      return { type: "basic", username: "", password: "" };
    case "apiKey":
      return { type: "apiKey", key: "", value: "", in: "header" };
    default:
      return { type: "none" };
  }
}

interface AuthEditorProps {
  value: AuthConfig;
  onChange: (auth: AuthConfig) => void;
  disabled?: boolean;
}

export function AuthEditor({ value, onChange, disabled }: AuthEditorProps) {
  const [showSecrets, setShowSecrets] = useState(false);

  const secretInputType = showSecrets ? "text" : "password";

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
        <Label htmlFor="auth-type">Authentication</Label>
        <select
          id="auth-type"
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          value={value.type}
          onChange={(event) => onChange(defaultAuthFor(event.target.value as AuthType))}
          disabled={disabled}
        >
          {AUTH_TYPES.map((type) => (
            <option key={type} value={type}>
              {authLabels[type]}
            </option>
          ))}
        </select>
      </div>

      {value.type === "none" ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-6 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" />
          This request will not include authorization credentials.
        </div>
      ) : null}

      {value.type === "bearer" ? (
        <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
          <Label htmlFor="auth-token">Token</Label>
          <div className="relative">
            <Input
              id="auth-token"
              type={secretInputType}
              value={value.token}
              onChange={(event) => onChange({ ...value, token: event.target.value })}
              placeholder="eyJhbGciOi..."
              autoComplete="off"
              disabled={disabled}
              className="pr-9"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="absolute top-1 right-1"
              onClick={() => setShowSecrets((current) => !current)}
              aria-label={showSecrets ? "Hide token" : "Show token"}
            >
              {showSecrets ? <EyeOff /> : <Eye />}
            </Button>
          </div>
        </div>
      ) : null}

      {value.type === "basic" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="auth-username">Username</Label>
            <Input
              id="auth-username"
              value={value.username}
              onChange={(event) => onChange({ ...value, username: event.target.value })}
              autoComplete="off"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auth-password">Password</Label>
            <div className="relative">
              <Input
                id="auth-password"
                type={secretInputType}
                value={value.password}
                onChange={(event) => onChange({ ...value, password: event.target.value })}
                autoComplete="off"
                disabled={disabled}
                className="pr-9"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute top-1 right-1"
                onClick={() => setShowSecrets((current) => !current)}
                aria-label={showSecrets ? "Hide password" : "Show password"}
              >
                {showSecrets ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {value.type === "apiKey" ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="auth-api-key">Key</Label>
              <Input
                id="auth-api-key"
                value={value.key}
                onChange={(event) => onChange({ ...value, key: event.target.value })}
                placeholder="X-API-Key"
                autoComplete="off"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-api-value">Value</Label>
              <div className="relative">
                <Input
                  id="auth-api-value"
                  type={secretInputType}
                  value={value.value}
                  onChange={(event) => onChange({ ...value, value: event.target.value })}
                  autoComplete="off"
                  disabled={disabled}
                  className="pr-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1 right-1"
                  onClick={() => setShowSecrets((current) => !current)}
                  aria-label={showSecrets ? "Hide API key" : "Show API key"}
                >
                  {showSecrets ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
            <Label htmlFor="auth-api-location">Add to</Label>
            <select
              id="auth-api-location"
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              value={value.in}
              onChange={(event) =>
                onChange({ ...value, in: event.target.value as ApiKeyLocation })
              }
              disabled={disabled}
            >
              {API_KEY_LOCATIONS.map((location) => (
                <option key={location} value={location}>
                  {location === "header" ? "Header" : "Query parameter"}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}
