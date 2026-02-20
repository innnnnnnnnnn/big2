"use client";

import { useAppSession } from "../hooks/useAppSession";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { session, status } = useAppSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (status === "authenticated") {
      router.push("/lobby");
    }
  }, [status, router]);

  return (
    <main className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-yellow-500 font-bold animate-pulse text-2xl">
        Loading Shenmao Big Two...
      </div>
    </main>
  );
}
