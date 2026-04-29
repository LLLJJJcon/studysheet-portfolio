import api from './api';
import { PageConfig } from '../types/course';

// Course API client for CRUD operations and file management
export const courseApi = {
  list() {
    return api.get('/courses');
  },
  create(name: string, pageConfig: Omit<PageConfig, 'wordLimit'>) {
    return api.post('/courses', { name, pageConfig });
  },
  getById(id: string) {
    return api.get(`/courses/${id}`);
  },
  update(id: string, data: { name?: string }) {
    return api.put(`/courses/${id}`, data);
  },
  delete(id: string) {
    return api.delete(`/courses/${id}`);
  },
  removeFile(courseId: string, fileId: string) {
    return api.delete(`/courses/${courseId}/files/${fileId}`);
  },
};
