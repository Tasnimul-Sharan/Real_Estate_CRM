"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
export default function CRMLayout({ children }: { children: React.ReactNode }) {
  const r = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem("crm_token")) r.replace("/");
    else setReady(true);
  }, [r]);
  if (!ready) return <main className="content" aria-busy="true">Loading...</main>;
  return (
    <div className="shell">
      <Sidebar />
      <main className="content">{children}</main>
    </div>
  );
}
