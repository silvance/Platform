import { redirect } from "next/navigation";
import { requireInstructor } from "@/lib/session";

export const dynamic = "force-dynamic";

// The /admin landing redirects to the challenges list — that's the
// only authoring surface so far, and a separate "hub" page with one
// link on it is just one click of friction.
export default async function AdminPage() {
  await requireInstructor();
  redirect("/admin/challenges");
}
