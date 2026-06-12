/**
 * @Description: 注册表单组件：提交昵称、邮箱、密码和确认密码。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ArrowLeft, Lock, Mail, User, UserPlus } from "lucide-react";
import { useAuthTransition } from "@/features/auth/AuthTransitionContext";
import { register } from "@/service/modules/user";
import PixelButton from "@/components/ui/PixelButton";
import PixelInput from "@/components/ui/PixelInput";
import { showPixelMessage } from "@/components/ui/PixelMessage";
import PixelPanel from "@/components/ui/PixelPanel";

export default function RegisterForm() {
  const router = useRouter();
  const { navigateHome, transitioning } = useAuthTransition();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function showError(text: string) {
    showPixelMessage(text);
  }

  function validateForm() {
    const trimmedNickname = nickname.trim();
    const trimmedEmail = email.trim();

    if (!trimmedNickname) {
      return "请输入昵称。";
    }

    if (trimmedNickname.length < 2) {
      return "昵称至少需要 2 个字符。";
    }

    if (trimmedNickname.length > 16) {
      return "昵称最多 16 个字符。";
    }

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

    if (!confirmPassword) {
      return "请输入确认密码。";
    }

    if (confirmPassword.length < 8) {
      return "确认密码至少需要 8 位。";
    }

    if (password !== confirmPassword) {
      return "两次输入的密码不一致";
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
      await register({ nickname: nickname.trim(), email: email.trim(), password });
      router.push("/");
    } catch (err) {
      showError(err instanceof Error ? err.message : "注册失败");
    } finally {
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
            <span className="text-[1.8rem] tracking-[0.22em]">创建账号</span>
            <span className="h-px w-5 bg-[#b79c53]" />
          </div>
        </div>

        <div className="mb-4">
          <PixelInput
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            aria-label="昵称"
            icon={<User size={18} />}
            placeholder="请输入昵称"
            disabled={loading || transitioning}
          />
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

        <div className="mb-4">
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

        <div className="mb-6">
          <PixelInput
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            type="password"
            aria-label="确认密码"
            icon={<Lock size={18} />}
            placeholder="请再次输入密码"
            disabled={loading || transitioning}
          />
        </div>

        <PixelButton type="submit" disabled={loading || transitioning} variant="primary" size="lg" fullWidth className="h-14 text-lg">
          <UserPlus size={18} />
          {loading ? "注册中" : "注册并返回主页"}
        </PixelButton>

        <div className="mt-7">
          <div className="flex items-center gap-3 text-sm text-[#a99560]">
            <span className="h-px flex-1 bg-[#5c6455]" />
            <span>已经有账号？</span>
            <span className="h-px flex-1 bg-[#5c6455]" />
          </div>
          <PixelButton asChild variant="ghost" size="lg" fullWidth className="mt-5 h-14 text-lg">
            <Link href="/login">返回登录</Link>
          </PixelButton>
        </div>
      </PixelPanel>
    </form>
  );
}
