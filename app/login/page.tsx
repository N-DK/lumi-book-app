"use client";

import { BookCover } from "@/components/lumi/BookCover";
import { getCurrentUser, getGoogleLoginUrl } from "@/lib/api-client";
import { cardIn, pressMotion, riseIn, staggerContainer } from "@/lib/motion";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  BookOpen,
  Bookmark,
  Library,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const LOGO_SRC = "/logo.png";

const benefits = [
  {
    icon: BookOpen,
    title: "Đồng bộ tiến độ đọc",
    desc: "Lưu lại trang đang đọc trên mọi thiết bị.",
  },
  {
    icon: Bookmark,
    title: "Ghi chú & dấu trang",
    desc: "Đánh dấu và ghi chú những đoạn yêu thích.",
  },
  {
    icon: Library,
    title: "Thư viện cá nhân",
    desc: "Quản lý bộ sưu tập sách của riêng bạn.",
  },
];

function BrandLogo({ className }: { className: string }) {
  return (
    <img
      src={LOGO_SRC}
      alt="LUMI"
      className={`block object-contain ${className}`}
      draggable={false}
    />
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasGoogleError = searchParams.get("error") === "google";

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);

  // Đã đăng nhập rồi thì quay về thư viện
  useEffect(() => {
    let cancelled = false;

    async function checkUser() {
      try {
        const data = await getCurrentUser();
        if (!cancelled && data.user) router.replace("/");
      } catch {
        /* chưa đăng nhập — ở lại trang login */
      }
    }

    void checkUser();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-ink text-paper/90 font-body flex">
      {/* Left: decorative panel */}
      <motion.div
        initial={{ opacity: 0, x: -28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center bg-shelf"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-ink/30" />
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-gold/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="relative z-10 text-center px-12 max-w-md"
        >
          <motion.div
            variants={cardIn}
            whileHover={{ y: -6, rotate: -1.5 }}
            className="w-36 aspect-[2/3] rounded-lg overflow-hidden shadow-[0_24px_64px_-16px_rgba(0,0,0,0.5)] ring-1 ring-paper/10 mx-auto mb-10"
          >
            <BookCover
              title="Thế Giới Của Ma Đói"
              author="Gabor Maté"
              palette="charcoal"
              style="stamp"
            />
          </motion.div>
          <motion.blockquote
            variants={riseIn}
            className="font-display text-2xl font-medium leading-relaxed text-paper/90 text-balance"
          >
            “Đọc sách là cách duy nhất để sống nhiều cuộc đời trong một đời
            người.”
          </motion.blockquote>
          <motion.p
            variants={riseIn}
            className="mt-6 text-sm text-gold/80 font-medium"
          >
            — Gabor Maté · Thế Giới Của Ma Đói
          </motion.p>
        </motion.div>
      </motion.div>

      {/* Right: login form */}
      <motion.div
        initial={{ opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 py-16 relative"
      >
        {/* Back link */}
        {/* <a
          href="/"
          className="absolute top-6 left-6 sm:top-8 sm:left-8 flex items-center gap-2 text-sm text-paper/50 hover:text-gold transition-colors"
        >
          <ArrowLeft className="size-4" />
          Quay lại thư viện
        </a> */}

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="w-full max-w-sm"
        >
          {/* Logo */}
          <motion.div
            variants={riseIn}
            className="flex flex-col items-center gap-2 mb-10"
          >
            <motion.div
              whileHover={{ y: -2, scale: 1.02 }}
              className="rounded-2xl bg-paper px-5 py-3 shadow-[0_0_24px_-4px_rgba(201,168,118,0.4)]"
            >
              <BrandLogo className="h-14 w-auto" />
            </motion.div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-paper/40 mt-1">
              Không gian đọc
            </p>
          </motion.div>

          <motion.h1
            variants={riseIn}
            className="font-display font-semibold text-2xl text-center mb-2"
          >
            Chào mừng trở lại
          </motion.h1>
          <motion.p
            variants={riseIn}
            className="text-sm text-paper/50 text-center mb-8"
          >
            Đăng nhập để tiếp tục hành trình đọc sách của bạn
          </motion.p>

          {hasGoogleError && (
            <motion.div
              variants={riseIn}
              className="mb-6 rounded-xl border border-red-400/30 bg-red-950/30 px-4 py-3 text-sm text-red-200"
            >
              Đăng nhập chưa hoàn tất. Bạn thử lại sau ít phút nhé.
            </motion.div>
          )}

          {/* Google button */}
          <motion.a
            {...pressMotion}
            variants={riseIn}
            href={getGoogleLoginUrl()}
            className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-paper/10 bg-paper/[0.03] hover:bg-paper/5 text-sm font-medium transition mb-6"
          >
            <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
              />
            </svg>
            Tiếp tục với Google
          </motion.a>

          <motion.div variants={staggerContainer} className="mt-10 space-y-5">
            {benefits.map((b) => (
              <motion.div
                key={b.title}
                variants={riseIn}
                className="flex items-start gap-4"
              >
                <div className="mt-0.5 size-8 rounded-lg bg-paper/[0.04] border border-paper/10 grid place-items-center shrink-0">
                  <b.icon className="size-4 text-gold/80" />
                </div>
                <div>
                  <p className="text-sm font-medium text-paper/80">{b.title}</p>
                  <p className="text-xs text-paper/40 mt-0.5">{b.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Divider */}
          {/* <div className="flex items-center gap-4 mb-6">
            <span className="h-px flex-1 bg-paper/10" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-paper/40">
              hoặc email
            </span>
            <span className="h-px flex-1 bg-paper/10" />
          </div> */}

          {/* Form */}
          {/* <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              setFormNotice(
                "Hiện LUMI chỉ hỗ trợ đăng nhập bằng Google. Bạn dùng nút phía trên nhé.",
              );
            }}
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-paper/60 ml-1">
                Email
              </label>
              <div
                className={`relative flex items-center rounded-xl border transition ${
                  focusedField === "email"
                    ? "border-gold/50 ring-1 ring-gold/20"
                    : "border-paper/10"
                } bg-paper/[0.03]`}
              >
                <Mail className="absolute left-3.5 size-4 text-paper/30" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="minhanh@example.com"
                  className="w-full h-11 pl-10 pr-4 bg-transparent text-sm text-paper placeholder:text-paper/25 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-medium text-paper/60">
                  Mật khẩu
                </label>
                <a
                  href="#"
                  className="text-[11px] text-gold/70 hover:text-gold transition-colors"
                >
                  Quên mật khẩu?
                </a>
              </div>
              <div
                className={`relative flex items-center rounded-xl border transition ${
                  focusedField === "password"
                    ? "border-gold/50 ring-1 ring-gold/20"
                    : "border-paper/10"
                } bg-paper/[0.03]`}
              >
                <Lock className="absolute left-3.5 size-4 text-paper/30" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-10 pr-10 bg-transparent text-sm text-paper placeholder:text-paper/25 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 text-paper/30 hover:text-paper/60 transition"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {formNotice && (
              <p className="rounded-xl border border-gold/25 bg-gold/[0.06] px-4 py-3 text-xs leading-relaxed text-gold">
                {formNotice}
              </p>
            )}

            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-gold text-ink font-semibold text-sm hover:bg-gold/90 transition shadow-[0_0_20px_-4px_rgba(201,168,118,0.3)]"
            >
              Đăng nhập
            </button>
          </form> */}

          {/* Sign up link */}
          {/* <p className="mt-8 text-center text-sm text-paper/50">
            Chưa có tài khoản?{" "}
            <a
              href={getGoogleLoginUrl()}
              className="text-gold hover:text-gold/80 font-medium transition-colors"
            >
              Đăng ký miễn phí
            </a>
          </p> */}
        </motion.div>
        <div className="absolute bottom-6 sm:bottom-8 text-[11px] text-paper/30 flex items-center gap-3">
          <a href="#" className="hover:text-paper/60 transition-colors">
            Điều khoản
          </a>
          <span>·</span>
          <a href="#" className="hover:text-paper/60 transition-colors">
            Bảo mật
          </a>
          <span>·</span>
          <a href="#" className="hover:text-paper/60 transition-colors">
            Trợ giúp
          </a>
        </div>
      </motion.div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-ink text-sm text-paper/60">
          Đang mở trang đăng nhập...
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
