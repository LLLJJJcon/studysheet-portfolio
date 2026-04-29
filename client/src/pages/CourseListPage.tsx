import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CourseList } from '../components/course/CourseList';
import { CreateCourseModal } from '../components/course/CreateCourseModal';
import { useAuthStore } from '../stores/authStore';
import { Loading } from '../components/common/Loading';
import api from '../services/api';
import { Course } from '../types/course';

// Render the course list page with create, open, and delete course actions
export function CourseListPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
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
    if (!confirm('Confirm delete this course? Cannot be recovered after deletion.')) return;
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
              Log Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">My Courses</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            + Create new course
          </button>
        </div>

        <CreateCourseModal
          show={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={(course) => {
            setCourses((prev) => [course, ...prev]);
            navigate(`/courses/${course._id}/editor`);
          }}
        />

        {loading ? (
          <Loading message="Loading..." className="py-12" />
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
