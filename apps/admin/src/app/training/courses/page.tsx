import { staffAllows } from "@injishi/contracts";

import { SectionFailure } from "@/components/failure/section-failure";
import { listTrainingCourses } from "@/lib/api/training";
import { readStaffAccess } from "@/lib/staff";

import { TrainingSubnav } from "../training-subnav";
import { CourseDirectory } from "./course-directory";

export const metadata = { title: "Training courses" };

/**
 * Courses (ADR-049 AC-30): what a certificate says was taught.
 *
 * DRAFTS INCLUDED. The admin list is every course, published or not, because
 * a course is created unpublished and has to be findable to be published.
 * Several may be published at once.
 *
 * Readable on `training.view`; creating, editing and publishing are
 * `training.course.manage`, platform admin only (AC-24), so those controls are
 * drawn only for a holder of it, from the permissions the server resolved.
 */
export default async function Page() {
  const [courses, staff] = await Promise.all([
    listTrainingCourses({ pageSize: 100 }),
    readStaffAccess(),
  ]);

  const canManage = staffAllows(staff.access.permissions, "training.course.manage");

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <TrainingSubnav />
      {courses.ok ? (
        <CourseDirectory
          courses={courses.data.items}
          total={courses.data.meta.total}
          canManage={canManage}
        />
      ) : (
        <div className="mt-8">
          <SectionFailure eyebrow="Training" reason={courses.reason} permission="training.view" />
        </div>
      )}
    </div>
  );
}
