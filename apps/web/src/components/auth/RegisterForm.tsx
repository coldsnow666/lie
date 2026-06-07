/**
 * 注册表单组件：提交昵称、邮箱、密码和确认密码。
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { UserPlus } from "lucide-react";
import { register } from "@/lib/api";

export default function RegisterForm() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);

    try {
      await register({ nickname, email, password });
      router.push("/lobby");
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-md rounded border border-[#d7bc72]/30 bg-[#10271d]/95 p-6 shadow-2xl shadow-black/30">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#fff6cf]">注册</h1>
        <p className="mt-2 text-sm text-[#c6b889]">创建账号后会自动登录并进入大厅。</p>
      </div>

      <label className="mb-4 block text-sm text-[#e8ddb7]">
        昵称
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          required
          minLength={2}
          maxLength={16}
          className="mt-2 w-full rounded border border-white/15 bg-black/25 px-3 py-3 text-[#fff6cf] outline-none focus:border-[#d7bc72]"
        />
      </label>

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

      <label className="mb-4 block text-sm text-[#e8ddb7]">
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

      <label className="mb-5 block text-sm text-[#e8ddb7]">
        确认密码
        <input
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
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
        <UserPlus size={18} />
        {loading ? "注册中" : "注册并进入大厅"}
      </button>

      <p className="mt-5 text-center text-sm text-[#c6b889]">
        已有账号？{" "}
        <Link className="font-medium text-[#fff6cf] underline-offset-4 hover:underline" href="/login">
          登录
        </Link>
      </p>
    </form>
  );
}
