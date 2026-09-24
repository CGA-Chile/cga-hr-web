import { redirect } from "next/navigation";
import { dayPath } from "@/sections/day/paths";
import { todayInChile } from "@/utils/chileDate";

export default function HomePage() {
  redirect(dayPath(todayInChile()));
}
