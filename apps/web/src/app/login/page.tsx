/**
 * 登录页面：承载登录表单并保持游戏菜单风格背景。
 */
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#214d38,#0b1812_55%)] px-4">
      <LoginForm />
    </main>
  );
}
