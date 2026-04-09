import { LoginForm } from '../components/auth/LoginForm';

interface LoginPageProps {
  onLogin: (token: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-2">StudySheet</h1>
        <p className="text-gray-500 text-center mb-6">Sign in to your account</p>
        <LoginForm onSuccess={onLogin} />
      </div>
    </div>
  );
}
