import { Course } from '../../types/course';
import { CourseCard } from './CourseCard';

interface CourseListProps {
  courses: Course[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export function CourseList({ courses, onOpen, onDelete }: CourseListProps) {
  if (courses.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-lg">还没有课程</p>
        <p className="text-sm mt-1">创建你的第一个课程开始使用</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {courses.map((course) => (
        <CourseCard
          key={course._id}
          course={course}
          onOpen={onOpen}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
