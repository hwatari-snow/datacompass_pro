"use client"

import { useRef, useEffect } from "react"
import { Send, Sparkles, Loader2, Table2, Code2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { useAnalystChat } from "@/lib/use-analyst-chat"
import type { ChatMessage } from "@/lib/types"

export default function AnalystPage() {
  const { messages, input, setInput, loading, send, useConditionContext, setUseConditionContext } = useAnalystChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function handleSend() {
    send(input)
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Ask Analyst
        </h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          自然言語でデータを分析 — Cortex AI がSQLを生成・実行して結果を返します
        </p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto rounded-xl border p-4 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full mb-3" style={{ backgroundColor: "var(--muted)" }}>
              <Sparkles className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />
            </div>
            <h3 className="text-lg font-medium" style={{ color: "var(--foreground)" }}>何でも聞いてください</h3>
            <p className="mt-1 max-w-sm text-sm" style={{ color: "var(--muted-foreground)" }}>
              「今月の売上トップ10商品は？」「エリア別売上構成比を教えて」など、自然言語で質問できます。
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {["売上トップ10カテゴリ", "月別売上推移", "会員ランク別購入金額"].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-[var(--accent)]"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg: ChatMessage) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 ${
                msg.role === "user" ? "bg-blue-600 text-white" : ""
              }`}
              style={msg.role === "assistant" ? { backgroundColor: "var(--muted)", color: "var(--foreground)" } : undefined}
            >
              <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-li:my-0.5 prose-ol:my-1 prose-ul:my-1 prose-headings:my-2">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>

              {/* SQL block */}
              {msg.sql && (
                <div className="mt-2 rounded-lg p-3 text-xs font-mono overflow-x-auto" style={{ backgroundColor: "var(--background)" }}>
                  <div className="flex items-center gap-1.5 mb-1.5" style={{ color: "var(--muted-foreground)" }}>
                    <Code2 className="h-3 w-3" />
                    <span>Generated SQL</span>
                  </div>
                  <pre style={{ color: "var(--foreground)" }}>{msg.sql}</pre>
                </div>
              )}

              {/* Results table */}
              {msg.results && msg.results.length > 0 && (
                <div className="mt-2 rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs" style={{ backgroundColor: "var(--background)", color: "var(--muted-foreground)" }}>
                    <Table2 className="h-3 w-3" />
                    <span>{msg.totalRows} 行</span>
                  </div>
                  <div className="overflow-x-auto max-h-60">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ backgroundColor: "var(--background)" }}>
                          {Object.keys(msg.results[0]).map((col) => (
                            <th key={col} className="px-2 py-1.5 text-left font-medium whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msg.results.slice(0, 20).map((row, i) => (
                          <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                            {Object.values(row).map((val, j) => (
                              <td key={j} className="px-2 py-1 whitespace-nowrap">{String(val ?? "")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Error */}
              {msg.error && !msg.results?.length && (
                <p className="mt-1 text-xs text-red-400">{msg.error}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "var(--muted)" }}>
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--brand-primary)" }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="質問を入力... (例: 今月の売上トップ10商品は？)"
          className="flex-1 rounded-xl border px-4 py-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--brand-primary)]"
          style={{
            backgroundColor: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--foreground)",
          }}
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={useConditionContext} onChange={(e) => setUseConditionContext(e.target.checked)} />
          現在の分析条件を反映
        </label>
        <span>条件反映は自然言語コンテキストであり、厳密フィルタではありません</span>
      </div>
    </div>
  )
}
