import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { ApiKeyModal } from './components/auth/ApiKeyModal';
import { useAuthStore } from './stores/authStore';

function App() {
  const { token, fetchUser, setToken } = useAuthStore();

  useEffect(() => {
    if (token) {
      fetchUser();
    }
  }, [token, fetchUser]);

  return (
    <BrowserRouter>
      <ApiKeyModal />
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={setToken} />} />
        <Route path="/register" element={<RegisterPage onRegister={setToken} />} />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/courses"
          element={
            <ProtectedRoute>
              <div className="p-8"><h1 className="text-2xl font-bold">Courses</h1><p className="text-gray-500 mt-2">Course list coming soon...</p></div>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to={token ? '/courses' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
