import type { Metadata } from "next";
import { Desktop } from "@/components/desktop/desktop";

export const metadata: Metadata = { title: "Ingest — mOSaic" };

/** Renders the desktop; the URL drives which window opens. */
export default function IngestPage() {
  return <Desktop />;
}
