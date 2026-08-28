import { redirect } from "next/navigation";

/** The dashboard used to live entirely on this route. Keeps old bookmarks working. */
export default function LegacyDashboard() {
  redirect("/admin/overview");
}
