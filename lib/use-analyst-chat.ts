"use client"

import { useEffect, useState } from "react"
import { useConditions } from "@/components/conditions-context"
import { buildConditionContext } from "@/lib/analyst-context"
import { clearChatHistory, loadChatHistory, saveChatHistory } from "@/lib/chat-storage"
import type { ChatMessage } from "@/lib/types"

interface SendOptions {
  context?: string
  useConditions?: boolean
}

interface AnalystResponse {
  explanation?: string
  sql?: string
  results?: Record<string, unknown>[]
  totalRows?: number
  error?: string
  threadId?: string
  messageId?: string
}

export function useAnalystChat() {
  const { conditions } = useConditions()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [useConditionContext, setUseConditionContext] = useState(true)

  useEffect(() => {
    const saved = loadChatHistory()
    setMessages(saved.messages)
    setThreadId(saved.threadId)
  }, [])

  useEffect(() => {
    saveChatHistory(messages, threadId)
  }, [messages, threadId])

  async function send(text: string, options?: SendOptions) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {
      const response = await fetch("/api/analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          threadId,
          conditionsContext:
            (options?.useConditions ?? useConditionContext) ? buildConditionContext(conditions) : undefined,
          screenContext: options?.context,
        }),
      })
      const data = (await response.json()) as AnalystResponse

      if (data.threadId) setThreadId(data.threadId)

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.explanation || data.error || "回答を生成できませんでした",
          sql: data.sql,
          results: data.results,
          totalRows: data.totalRows,
          error: data.error,
          timestamp: Date.now(),
        },
      ])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "接続エラーが発生しました。",
          error: error instanceof Error ? error.message : "Network error",
          timestamp: Date.now(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function clear() {
    setMessages([])
    setThreadId(null)
    clearChatHistory()
  }

  return {
    messages,
    input,
    setInput,
    loading,
    send,
    clear,
    useConditionContext,
    setUseConditionContext,
  }
}
