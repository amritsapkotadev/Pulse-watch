import { CircleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function LocalStorageNote({ compact = false }: { compact?: boolean }) {
  return (
    <Alert>
      <CircleAlert />
      <AlertTitle>Local browser storage only</AlertTitle>
      <AlertDescription>
        Saved collections, requests, and environments stay in this browser&apos;s localStorage.
        Secret values are obfuscated, not encrypted, and data is not synchronized across browsers or
        users.
        {compact ? null : " Do not store sensitive production credentials."}
      </AlertDescription>
    </Alert>
  );
}
