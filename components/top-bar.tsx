"use client"

import { Bell, Search, Sparkles } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAnalystDrawer } from "@/components/analyst-drawer"
import { useEffect, useState } from "react"

interface UserInfo {
  user_name: string
  current_role: string
  account: string
}

export function TopBar() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [notificationCount] = useState(3)
  const { toggle: toggleAnalyst } = useAnalystDrawer()

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data))
      .catch(() => setUser({ user_name: "User", current_role: "PUBLIC", account: "LOCAL" }))
  }, [])

  const displayName = user?.user_name ?? "Loading..."
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center justify-between border-b px-6"
      style={{
        backgroundColor: "var(--topbar-bg)",
        borderColor: "var(--topbar-border)",
        color: "var(--topbar-fg)",
      }}
    >
      {/* Left: Welcome message */}
      <div className="flex items-center gap-3">
        <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Welcome back,{" "}
          <span className="font-medium" style={{ color: "var(--foreground)" }}>
            {displayName}
          </span>
        </span>
        <span
          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium"
          style={{ borderColor: "var(--brand-primary)", color: "var(--brand-primary)" }}
        >
          LIVE on Snowflake
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Ask Analyst button */}
        <button
          onClick={toggleAnalyst}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--accent)]"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <span style={{ color: "var(--brand-primary)" }}>
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span>Ask Analyst</span>
          <kbd
            className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-mono"
            style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}
          >
            ⌘K
          </kbd>
        </button>

        {/* Search */}
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--accent)]"
          style={{ color: "var(--muted-foreground)" }}
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Notification bell */}
        <button
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--accent)]"
          style={{ color: "var(--muted-foreground)" }}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* User avatar */}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-xs font-bold text-white"
          aria-label="User menu"
          title={user ? `${user.user_name} (${user.current_role})` : ""}
        >
          {initials}
        </button>
      </div>
    </header>
  )
}
