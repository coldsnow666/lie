/**
 * 登录页面：承载登录表单并保持游戏菜单风格背景。
 */
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <LoginForm />
    </main>
  );
}
