import { redirect } from "next/navigation";

export default function SoloPage() {
  redirect("/site/index.html?mode=solo");
}
