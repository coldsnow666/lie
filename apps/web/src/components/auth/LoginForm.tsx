/**
 * 登录表单组件：提交邮箱和密码，成功后保存会话并进入大厅。
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { LogIn } from "lucide-react";
import { login } from "@/lib/api";

export default function LoginForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!formRef.current) {
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        formRef.current,
        { y: "-18vh", opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.56,
          ease: "power3.out",
        },
      );
    }, formRef);

    return () => context.revert();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login({ email, password });
      router.push("/lobby");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mx-auto w-full max-w-md rounded border border-[#d7bc72]/30 bg-[#10271d]/95 p-6 shadow-2xl shadow-black/30">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#fff6cf]">登录</h1>
        <p className="mt-2 text-sm text-[#c6b889]">进入大厅，创建或加入一桌唬牌。</p>
      </div>

      <label className="mb-4 block text-sm text-[#e8ddb7]">
        邮箱
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          required
          className="mt-2 w-full rounded border border-white/15 bg-black/25 px-3 py-3 text-[#fff6cf] outline-none focus:border-[#d7bc72]"
        />
      </label>

      <label className="mb-5 block text-sm text-[#e8ddb7]">
        密码
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          required
          minLength={8}
          className="mt-2 w-full rounded border border-white/15 bg-black/25 px-3 py-3 text-[#fff6cf] outline-none focus:border-[#d7bc72]"
        />
      </label>

      {error ? <p className="mb-4 rounded border border-red-300/30 bg-red-950/50 px-3 py-2 text-sm text-red-100">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="flex h-12 w-full items-center justify-center gap-2 rounded bg-[#d7bc72] px-4 font-semibold text-[#102018] transition hover:bg-[#f0d98d] disabled:opacity-60"
      >
        <LogIn size={18} />
        {loading ? "登录中" : "登录"}
      </button>

      <p className="mt-5 text-center text-sm text-[#c6b889]">
        还没有账号？{" "}
        <Link className="font-medium text-[#fff6cf] underline-offset-4 hover:underline" href="/register">
          注册
        </Link>
      </p>
    </form>
  );
}
