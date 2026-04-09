import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CourseList } from '../components/course/CourseList';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import { Course } from '../types/course';

export function CourseListPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  const fetchCourses = async () => {
    try {
      const { data } = await api.get('/courses');
      setCourses(data.courses);
    } catch {
      console.error('Failed to fetch courses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this course?')) return;
    try {
      await api.delete(`/courses/${id}`);
      setCourses((prev) => prev.filter((c) => c._id !== id));
    } catch {
      console.error('Failed to delete course');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">StudySheet</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/settings')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Settings
            </button>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">My Courses</h2>
          <button
            onClick={() => navigate('/courses/new')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            + New Course
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <CourseList
            courses={courses}
            onOpen={(id) => navigate(`/courses/${id}/editor`)}
            onDelete={handleDelete}
          />
        )}
      </main>
    </div>
  );
}
