import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { SettingsPage } from './pages/SettingsPage';
import { CourseListPage } from './pages/CourseListPage';
import { EditorPage } from './pages/EditorPage';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { ErrorBoundary, ToastContainer } from './components/common/ErrorBoundary';
import { ApiKeyModal } from './components/auth/ApiKeyModal';
import { useAuthStore } from './stores/authStore';
import { initTreeCanvasSync } from './stores/treeStore';

// Initialize cross-store sync (tree ↔ canvas highlighting)
initTreeCanvasSync();

function App() {
  const { token, fetchUser, setToken } = useAuthStore();

  useEffect(() => {
    if (token) {
      fetchUser();
    }
  }, [token, fetchUser]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ApiKeyModal />
        <ToastContainer />
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
              <CourseListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/courses/:id/editor"
          element={
            <ProtectedRoute>
              <EditorPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to={token ? '/courses' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
