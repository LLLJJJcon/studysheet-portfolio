import { Link } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';

interface LoginPageProps {
  onLogin: (token: string) => void;
}

// Render the login page with authentication form and registration link
export function LoginPage({ onLogin }: LoginPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-2">StudySheet</h1>
        <p className="text-gray-500 text-center mb-6">Log in to your account</p>
        <LoginForm onSuccess={onLogin} />
        <p className="text-sm text-center text-gray-500 mt-4">
          No account yet?{' '}
          <Link to="/register" className="text-blue-600 hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
