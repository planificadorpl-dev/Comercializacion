import { redirect } from "next/navigation";

export default function AdminAsesoresRedirect() {
  redirect("/admin?tab=personal");
}
