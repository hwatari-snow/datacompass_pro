"use client"

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react"
import { X, Sparkles, Send, Trash2, ChevronDown, Database, MessageSquare } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { useAnalystChat } from "@/lib/use-analyst-chat"
import type { ChatMessage } from "@/lib/types"

interface AnalystDrawerContextValue {
  open: boolean
  setOpen: (v: boolean) => void
  toggle: () => void
  openWithPrompt: (prompt: string, screenContext?: string) => void
  pendingPrompt: { prompt: string; screenContext?: string } | null
  clearPendingPrompt: () => void
}

const AnalystDrawerContext = createContext<AnalystDrawerContextValue>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
  openWithPrompt: () => {},
  pendingPrompt: null,
  clearPendingPrompt: () => {},
})

export function useAnalystDrawer() {
  return useContext(AnalystDrawerContext)
}

export function AnalystDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState<{ prompt: string; screenContext?: string } | null>(null)
  const toggle = useCallback(() => setOpen((v) => !v), [])
  const openWithPrompt = useCallback((prompt: string, screenContext?: string) => {
    setPendingPrompt({ prompt, screenContext })
    setOpen(true)
  }, [])
  return (
    <AnalystDrawerContext.Provider value={{ open, setOpen, toggle, openWithPrompt, pendingPrompt, clearPendingPrompt: () => setPendingPrompt(null) }}>
      {children}
    </AnalystDrawerContext.Provider>
  )
}
export function AnalystDrawer() {
  const { open, setOpen, pendingPrompt, clearPendingPrompt } = useAnalystDrawer()
  const { messages, input, setInput, loading, send, clear, useConditionContext, setUseConditionContext } = useAnalystChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    if (!pendingPrompt) return
    setInput(pendingPrompt.prompt)
    clearPendingPrompt?.()
  }, [pendingPrompt, setInput, clearPendingPrompt])

  const SUGGESTED = [
    { icon: "📊", text: "売上上位10商品を教えて" },
    { icon: "🗺️", text: "エリア別の売上ランキングは？" },
    { icon: "👩", text: "30代女性がよく買う商品は？" },
    { icon: "📈", text: "月別の売上推移を見せて" },
    { icon: "🔄", text: "リピート率が高い商品TOP10" },
    { icon: "🏪", text: "店舗別の客単価を比較して" },
  ]

  if (!open) return null

  return (
    <>
      {/* Drawer panel */}
      <div
        className="fixed right-0 top-0 z-50 flex h-screen w-[560px] max-w-[90vw] flex-col shadow-2xl animate-in slide-in-from-right duration-200"
        style={{ backgroundColor: "var(--background)", borderLeft: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex h-14 shrink-0 items-center justify-between px-5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Ask Analyst</span>
              <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "var(--brand-primary)" }}>
                AI powered
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clear}
                className="rounded-md p-1.5 transition-colors hover:bg-[var(--accent)]"
                style={{ color: "var(--muted-foreground)" }}
                title="会話をクリア"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 transition-colors hover:bg-[var(--accent)]"
              style={{ color: "var(--muted-foreground)" }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                <MessageSquare className="h-8 w-8" style={{ color: "var(--brand-primary)" }} />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                ID-POSデータに質問
              </h3>
              <p className="text-center text-sm mb-8 max-w-xs" style={{ color: "var(--muted-foreground)" }}>
                自然言語でデータを分析。SQLの知識は不要です。
              </p>
              <div className="grid w-full grid-cols-2 gap-2">
                {SUGGESTED.map((s) => (
                  <button
                    key={s.text}
                    onClick={() => send(s.text)}
                    className="flex items-start gap-2 rounded-xl border p-3 text-left text-sm transition-all hover:shadow-md hover:border-[var(--brand-primary)]"
                    style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    <span className="text-base leading-none mt-0.5">{s.icon}</span>
                    <span className="leading-tight">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {messages.map((msg: ChatMessage) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
                      <Sparkles className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm ${msg.role === "user" ? "max-w-[75%]" : "max-w-[88%]"}`}
                    style={
                      msg.role === "user"
                        ? { backgroundColor: "var(--brand-primary)", color: "white" }
                        : { backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }
                    }
                  >
                    {msg.error && (
                      <div className="flex items-center gap-1.5 text-red-400 text-xs mb-2 rounded-md p-2" style={{ backgroundColor: "rgba(239,68,68,0.08)" }}>
                        <span>⚠️</span> {msg.error}
                      </div>
                    )}
                    {msg.content && (
                      <div className="leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-li:my-0.5 prose-ol:my-1 prose-ul:my-1 prose-headings:my-2">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}

                    {msg.sql && (
                      <details className="mt-3 group">
                        <summary className="cursor-pointer flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                          <Database className="h-3 w-3" />
                          生成されたSQL
                          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                        </summary>
                        <pre
                          className="mt-2 overflow-x-auto rounded-lg p-3 text-xs font-mono leading-relaxed"
                          style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}
                        >
                          {msg.sql}
                        </pre>
                      </details>
                    )}

                    {msg.results && msg.results.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                            {msg.results.length}件の結果
                          </span>
                        </div>
                        <div
                          className="overflow-x-auto max-h-[280px] overflow-y-auto rounded-lg border"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <table className="w-full text-xs">
                            <thead className="sticky top-0">
                              <tr style={{ backgroundColor: "var(--muted)" }}>
                                {Object.keys(msg.results[0]).map((k) => (
                                  <th
                                    key={k}
                                    className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                                    style={{ color: "var(--muted-foreground)" }}
                                  >
                                    {k}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {msg.results.slice(0, 30).map((row, i) => (
                                <tr
                                  key={i}
                                  className="border-t transition-colors hover:bg-[var(--accent)]"
                                  style={{ borderColor: "var(--border)" }}
                                >
                                  {Object.values(row).map((v, j) => (
                                    <td key={j} className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                                      {formatCellValue(v)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {msg.results.length > 30 && (
                          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                            他 {msg.results.length - 30} 件...
                          </p>
                        )}
                      </div>
                    )}

                    {msg.sql && msg.results && msg.results.length === 0 && !msg.error && (
                      <p className="text-xs mt-2 italic" style={{ color: "var(--muted-foreground)" }}>
                        クエリは正常に実行されましたが、結果は0件でした。
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
                      <div className="flex gap-1">
                        <div className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                      <span className="text-xs">分析クエリを生成・実行中...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input, { context: pendingPrompt?.screenContext }) }
                }}
                placeholder="ID-POSデータについて質問..."
                rows={1}
                className="w-full resize-none rounded-xl border px-4 py-3 pr-12 text-sm outline-none transition-colors focus:border-[var(--brand-primary)]"
                style={{
                  backgroundColor: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                  minHeight: "44px",
                  maxHeight: "120px",
                }}
              />
            </div>
            <button
              onClick={() => send(input, { context: pendingPrompt?.screenContext })}
              disabled={loading || !input.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all disabled:opacity-30"
              style={{ backgroundColor: "var(--brand-primary)", color: "white" }}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
              <input type="checkbox" checked={useConditionContext} onChange={(e) => setUseConditionContext(e.target.checked)} />
              現在の分析条件を反映
            </label>
            <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
              条件反映は自然言語コンテキストであり、厳密フィルタではありません
            </span>
          </div>
          <p className="mt-2 text-center text-[10px]" style={{ color: "var(--muted-foreground)" }}>
            Powered by Snowflake Cortex AI · mistral-large2
          </p>
        </div>
      </div>
    </>
  )
}

function formatCellValue(v: unknown): string {
  if (v == null) return "—"
  if (typeof v === "number") {
    if (Number.isInteger(v) && Math.abs(v) > 9999) return v.toLocaleString()
    if (!Number.isInteger(v)) return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  return String(v)
}
