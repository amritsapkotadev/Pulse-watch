import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Status Page",
  description: "Open the public, real-time view of service health.",
};

export default function StatusPagesPage() {
  redirect("/status");
}
