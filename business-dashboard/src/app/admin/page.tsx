import { redirect } from "next/navigation";

/** /admin is the entry point people type. Land them on the first section. */
export default function AdminIndex() {
  redirect("/admin/overview");
}
