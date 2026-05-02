import { redirect } from "next/navigation";

export default function BattlePage() {
  redirect("/site/index.html?mode=battle");
}
