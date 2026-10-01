import { redirect } from "next/navigation";
import { sheetPath } from "@/sections/sheet/paths";

/** Home is the period sheet: the view people already know from the spreadsheet. */
export default function HomePage() {
  redirect(sheetPath());
}
