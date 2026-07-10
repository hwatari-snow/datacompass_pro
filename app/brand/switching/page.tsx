"use client"

import { ArrowLeftRight } from "lucide-react"

export default function SwitchingPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <div className="rounded-full p-4" style={{ backgroundColor: "var(--accent)" }}>
        <ArrowLeftRight className="h-10 w-10" style={{ color: "var(--muted-foreground)" }} />
      </div>
      <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>スイッチング</h1>
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Coming Soon</p>
    </div>
  )
}
