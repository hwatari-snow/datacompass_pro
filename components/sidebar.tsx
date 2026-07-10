"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Settings2,
  SlidersHorizontal,
  TrendingUp,
  Users,
  ArrowLeftRight,
  Sparkles,
  LayoutDashboard,
  Bell,
  PanelLeftClose,
  PanelLeft,
  Target,
  Calculator,
  ShoppingCart,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSidebar, useCondPanel } from "@/components/app-shell"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  title: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "ANALYSIS",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/analysis/conditions", label: "分析条件設定", icon: SlidersHorizontal },
      { href: "/analysis/abc", label: "ABC分析", icon: BarChart3 },
      { href: "/analysis/results", label: "属性分析", icon: Users },
      { href: "/analysis/trend", label: "トレンド分析", icon: TrendingUp },
      { href: "/analysis/basket", label: "バスケット分析", icon: ShoppingCart },
    ],
  },
  {
    title: "BRAND",
    items: [
      { href: "/brand/profiling", label: "プロファイリング", icon: Target },
      { href: "/brand/switching", label: "スイッチング", icon: ArrowLeftRight },
    ],
  },
  {
    title: "AI / ML",
    items: [
      { href: "/ai/analyst", label: "Ask Analyst", icon: Sparkles },
    ],
  },
  {
    title: "ADMIN",
    items: [
      { href: "/admin", label: "設定", icon: Settings2 },
      { href: "/admin/cost-estimation", label: "コスト試算", icon: Calculator },
      { href: "/admin/notifications", label: "通知管理", icon: Bell },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { collapsed, setCollapsed } = useSidebar()
  const { setCondPanelOpen } = useCondPanel()

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen flex flex-col border-r transition-all duration-200",
        collapsed ? "w-16" : "w-56",
      )}
      style={{
        backgroundColor: "var(--sidebar-bg)",
        borderColor: "var(--sidebar-border)",
      }}
    >
      {/* Logo area */}
      <div className="flex h-14 items-center gap-2 px-4 border-b" style={{ borderColor: "var(--sidebar-border)" }}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400">
          <BarChart3 className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>DataCompass</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed && (
              <span
                className="px-3 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--sidebar-section-fg)" }}
              >
                {section.title}
              </span>
            )}
            <ul className="mt-1.5 space-y-0.5">
              {section.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href)
                const isConditions = item.href === "/analysis/conditions"
                return (
                  <li key={item.href}>
                    {isConditions ? (
                      <button
                        onClick={() => setCondPanelOpen(true)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          "hover:bg-[var(--sidebar-hover-bg)]",
                          collapsed && "justify-center px-0",
                        )}
                        style={{ color: "var(--sidebar-fg)" }}
                        title={collapsed ? item.label : undefined}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </button>
                    ) : (
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? ""
                          : "hover:bg-[var(--sidebar-hover-bg)]",
                        collapsed && "justify-center px-0",
                      )}
                      style={
                        active
                          ? { backgroundColor: "var(--sidebar-active-bg)", color: "var(--sidebar-active-fg)" }
                          : { color: "var(--sidebar-fg)" }
                      }
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon className={cn("h-4 w-4 shrink-0", active && "text-[var(--sidebar-active-fg)]")} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t p-2" style={{ borderColor: "var(--sidebar-border)" }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-md p-2 transition-colors hover:bg-[var(--sidebar-hover-bg)]"
          style={{ color: "var(--sidebar-fg)" }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  )
}
