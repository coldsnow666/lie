/**
 * 登录表单组件：提交邮箱和密码，成功后保存会话并返回主页。
 */
"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ArrowLeft, Lock, LogIn, Mail } from "lucide-react";
import { useAuthTransition } from "@/components/auth/AuthTransitionContext";
import { login } from "@/service/modules/user";
import PixelButton from "@/components/ui/PixelButton";
import PixelInput from "@/components/ui/PixelInput";
import { showPixelMessage } from "@/components/ui/PixelMessage";
import PixelPanel from "@/components/ui/PixelPanel";

export default function LoginForm() {
  const { navigateHome, transitioning } = useAuthTransition();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function showError(text: string) {
    showPixelMessage(text);
  }

  function validateForm() {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      return "请输入邮箱。";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return "请输入正确的邮箱格式。";
    }

    if (!password) {
      return "请输入密码。";
    }

    if (password.length < 8) {
      return "密码至少需要 8 位。";
    }

    return "";
  }

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
    const validationError = validateForm();

    if (validationError) {
      showError(validationError);
      return;
    }

    setLoading(true);

    try {
      await login({ email: email.trim(), password });
      navigateHome();
    } catch (err) {
      showError(err instanceof Error ? err.message : "登录失败");
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="relative mx-auto w-full max-w-[31rem]">
      <div className="absolute left-0 top-0 z-20 -translate-x-1/2 -translate-y-1/2 max-sm:left-3 max-sm:translate-x-0">
        <PixelButton
          type="button"
          variant="ghost"
          size="sm"
          aria-label="返回首页"
          className="h-12 w-12 min-w-12 px-0"
          onClick={navigateHome}
          disabled={loading || transitioning}
        >
          <ArrowLeft size={18} />
        </PixelButton>
      </div>

      <PixelPanel
        tone="highlight"
        className="relative px-6 py-7 shadow-[0_16px_28px_rgba(0,0,0,0.28)] sm:px-8 sm:py-8"
        padding="md"
      >
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 text-[#f6ebc2]">
            <span className="h-px w-5 bg-[#b79c53]" />
            <span className="text-[1.8rem] tracking-[0.22em]">登录</span>
            <span className="h-px w-5 bg-[#b79c53]" />
          </div>
        </div>

        <div className="mb-4">
          <PixelInput
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            aria-label="邮箱"
            icon={<Mail size={18} />}
            placeholder="请输入邮箱"
            disabled={loading || transitioning}
          />
        </div>

        <div className="mb-3">
          <PixelInput
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            aria-label="密码"
            icon={<Lock size={18} />}
            placeholder="请输入密码"
            disabled={loading || transitioning}
          />
        </div>

        <PixelButton type="submit" disabled={loading || transitioning} variant="primary" size="lg" fullWidth className="h-14 text-lg">
          <LogIn size={18} />
          {loading ? "登录中" : "登录"}
        </PixelButton>

        <div className="mt-7">
          <div className="flex items-center gap-3 text-sm text-[#a99560]">
            <span className="h-px flex-1 bg-[#5c6455]" />
            <span>还没有账号？</span>
            <span className="h-px flex-1 bg-[#5c6455]" />
          </div>
          <PixelButton asChild variant="ghost" size="lg" fullWidth className="mt-5 h-14 text-lg">
            <Link href="/register">注册新账号</Link>
          </PixelButton>
        </div>
      </PixelPanel>
    </form>
  );
}
