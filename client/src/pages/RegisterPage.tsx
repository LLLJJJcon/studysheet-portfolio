import { Link } from 'react-router-dom';
import { RegisterForm } from '../components/auth/RegisterForm';

interface RegisterPageProps {
  onRegister: (token: string) => void;
}

export function RegisterPage({ onRegister }: RegisterPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-2">StudySheet</h1>
        <p className="text-gray-500 text-center mb-6">创建你的账户</p>
        <RegisterForm onSuccess={onRegister} />
        <p className="text-sm text-center text-gray-500 mt-4">
          已有账户？{' '}
          <Link to="/login" className="text-blue-600 hover:underline">登录</Link>
        </p>
      </div>
    </div>
  );
}
