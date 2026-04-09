import { create } from 'zustand';
import { Course } from '../types/course';
import { courseApi } from '../services/courseApi';

interface CourseState {
  courses: Course[];
  currentCourse: Course | null;
  loading: boolean;
  fetchCourses: () => Promise<void>;
  fetchCourse: (id: string) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;
  setCurrentCourse: (course: Course | null) => void;
}

export const useCourseStore = create<CourseState>((set) => ({
  courses: [],
  currentCourse: null,
  loading: false,

  fetchCourses: async () => {
    set({ loading: true });
    try {
      const { data } = await courseApi.list();
      set({ courses: data.courses, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchCourse: async (id: string) => {
    set({ loading: true });
    try {
      const { data } = await courseApi.getById(id);
      set({ currentCourse: data.course, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  deleteCourse: async (id: string) => {
    try {
      await courseApi.delete(id);
      set((state) => ({
        courses: state.courses.filter((c) => c._id !== id),
      }));
    } catch {
      console.error('Failed to delete course');
    }
  },

  setCurrentCourse: (course) => set({ currentCourse: course }),
}));
