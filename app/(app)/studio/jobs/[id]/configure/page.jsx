"use client";
// app/(app)/studio/jobs/[id]/configure/page.jsx — entry point for the
// Configuration Workspace (split-screen: wizard left, live engine right).
// The only file in Studio that imports a real .css file (Tailwind, scoped to
// this route only — see workspace.css's own header comment).
import "./workspace.css";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import StudioWorkspace from "./StudioWorkspace.jsx";

export default function ConfigureWorkspacePage() {
  const params = useParams();
  // Suspense boundary: StudioWorkspace reads useSearchParams() (the ?step=
  // deep link from the Job Hub), which Next.js requires to be wrapped so it
  // can't block the rest of the page's initial render.
  return (
    <Suspense fallback={null}>
      <StudioWorkspace jobId={params.id} />
    </Suspense>
  );
}
