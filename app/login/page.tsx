"use client"

import { getGoogleLoginUrl } from "@/lib/api-client"
import { Moon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function LoginContent() {
  const searchParams = useSearchParams()
  const hasGoogleError = searchParams.get("error") === "google"

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,oklch(0.45_0.08_280_/_0.45),transparent_34%),radial-gradient(circle_at_bottom_left,oklch(0.58_0.12_60_/_0.28),transparent_32%)]" />
      <section className="relative w-full max-w-md rounded-lg border border-border bg-card/80 p-6 shadow-2xl backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
            <Moon className="size-5" />
          </span>
          <div>
            <h1 className="font-heading text-3xl tracking-tight">LUMI</h1>
            <p className="text-sm text-muted-foreground">
              Đăng nhập để dùng thư viện cá nhân.
            </p>
          </div>
        </div>

        {hasGoogleError && (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Google login không hoàn tất. Kiểm tra OAuth client và callback URL.
          </div>
        )}

        <a
          href={getGoogleLoginUrl()}
          className="flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Đăng nhập bằng Google
        </a>
      </section>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
          Đang mở trang đăng nhập...
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
