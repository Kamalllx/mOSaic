import type { Metadata } from "next";
import { Desktop } from "@/components/desktop/desktop";

export const metadata: Metadata = { title: "Connections — mOSaic" };

/** Renders the desktop; the URL drives which window opens. */
export default function ConnectionsPage() {
  return <Desktop />;
}
