/**
 * 注册页面：承载注册表单并在成功后进入大厅。
 */
import RegisterForm from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#214d38,#0b1812_55%)] px-4 py-8">
      <RegisterForm />
    </main>
  );
}
