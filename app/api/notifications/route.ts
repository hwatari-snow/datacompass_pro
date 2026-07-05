import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// In-memory notifications for demo (replace with Snowflake table in production)
const DEMO_NOTIFICATIONS = [
  {
    id: "n1",
    type: "analysis_complete",
    title: "ABC分析完了",
    body: "食品カテゴリのABC分析が完了しました。結果を確認してください。",
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: "n2",
    type: "alert",
    title: "クレジット消費アラート",
    body: "今月のクレジット消費が上限の80%に達しました。",
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: "n3",
    type: "system",
    title: "データ更新完了",
    body: "商品マスタの日次更新が正常に完了しました (7,000,000件)。",
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: "n4",
    type: "system",
    title: "メンテナンス予定",
    body: "7/5 02:00-04:00 にシステムメンテナンスを実施します。",
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
]

export async function GET() {
  return NextResponse.json({
    notifications: DEMO_NOTIFICATIONS,
    unread_count: DEMO_NOTIFICATIONS.filter((n) => !n.is_read).length,
  })
}

export async function PATCH(request: Request) {
  const body = await request.json()
  const { id, is_read } = body as { id: string; is_read: boolean }
  const notif = DEMO_NOTIFICATIONS.find((n) => n.id === id)
  if (notif) {
    notif.is_read = is_read
  }
  return NextResponse.json({ success: true })
}
