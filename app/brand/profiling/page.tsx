"use client"

import { Target } from "lucide-react"

export default function ProfilingPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <div className="rounded-full p-4" style={{ backgroundColor: "var(--accent)" }}>
        <Target className="h-10 w-10" style={{ color: "var(--muted-foreground)" }} />
      </div>
      <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>プロファイリング</h1>
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Coming Soon</p>
    </div>
  )
}
