import { Course } from '../../types/course';

interface CourseCardProps {
  course: Course;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  created: 'Pending',
  uploading: 'Uploading...',
  generating: 'Generating...',
  editing: 'Editing',
};

const STATUS_COLORS: Record<string, string> = {
  created: 'bg-gray-100 text-gray-700',
  uploading: 'bg-yellow-100 text-yellow-700',
  generating: 'bg-blue-100 text-blue-700',
  editing: 'bg-green-100 text-green-700',
};

export function CourseCard({ course, onOpen, onDelete }: CourseCardProps) {
  return (
    <div
      className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => onOpen(course._id)}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 truncate flex-1">{course.name}</h3>
        <span className={`text-xs px-2 py-1 rounded-full ml-2 ${STATUS_COLORS[course.status]}`}>
          {STATUS_LABELS[course.status]}
        </span>
      </div>

      <div className="text-sm text-gray-500 space-y-1">
        <p>{course.files.length} file(s)</p>
        <p>
          {course.pageConfig.size} · {course.pageConfig.pages} Page
        </p>
        <p className="text-xs text-gray-400">
          Updated on {new Date(course.updatedAt).toLocaleDateString()}
        </p>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(course._id);
          }}
          className="text-xs text-red-500 hover:text-red-700"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
