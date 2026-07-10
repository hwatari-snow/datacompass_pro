"use client"

import { ShoppingCart } from "lucide-react"

export default function BasketPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <div className="rounded-full p-4" style={{ backgroundColor: "var(--accent)" }}>
        <ShoppingCart className="h-10 w-10" style={{ color: "var(--muted-foreground)" }} />
      </div>
      <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>バスケット分析</h1>
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Coming Soon</p>
    </div>
  )
}
