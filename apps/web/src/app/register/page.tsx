/**
 * 注册页面：承载注册表单并在成功后进入大厅。
 */
import RegisterForm from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <RegisterForm />
    </main>
  );
}
