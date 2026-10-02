/** Route table + matcher. `roles: null` = public, `'any'` = any signed-in user. */
import * as pub from './handlers-public.mjs';
import * as common from './handlers-common.mjs';
import * as student from './handlers-student.mjs';
import * as facilitator from './handlers-facilitator.mjs';
import * as admin from './handlers-admin.mjs';

export const routes = [
  // public
  { method: 'POST', path: 'auth/signup', roles: null, handler: pub.signup },
  { method: 'POST', path: 'auth/login', roles: null, handler: pub.login },
  { method: 'GET', path: 'public/summary', roles: null, handler: pub.publicSummary },
  { method: 'GET', path: 'public/courses', roles: null, handler: pub.publicCourses },
  { method: 'POST', path: 'public/contact', roles: null, handler: pub.contactSubmit },

  // any signed-in user
  { method: 'GET', path: 'me', roles: 'any', handler: common.getMe },
  { method: 'PUT', path: 'me', roles: 'any', handler: common.updateMe },
  { method: 'PUT', path: 'me/password', roles: 'any', handler: common.changePassword },
  { method: 'POST', path: 'me/photo', roles: 'any', handler: common.uploadPhoto },
  { method: 'GET', path: 'files/:key', roles: 'any', handler: common.getFile },

  // student
  { method: 'GET', path: 'student/overview', roles: ['student'], handler: student.studentOverview },
  { method: 'POST', path: 'student/enroll', roles: ['student'], handler: student.enroll },
  { method: 'POST', path: 'student/drop', roles: ['student'], handler: student.dropClass },
  { method: 'POST', path: 'student/submit', roles: ['student'], handler: student.submitAssessment },

  // facilitator
  { method: 'GET', path: 'facilitator/overview', roles: ['facilitator'], handler: facilitator.facilitatorOverview },
  { method: 'POST', path: 'facilitator/materials', roles: ['facilitator'], handler: facilitator.uploadMaterial },
  { method: 'DELETE', path: 'facilitator/materials/:id', roles: ['facilitator'], handler: facilitator.deleteMaterial },
  { method: 'POST', path: 'facilitator/assessments', roles: ['facilitator'], handler: facilitator.createAssessment },
  { method: 'DELETE', path: 'facilitator/assessments/:id', roles: ['facilitator'], handler: facilitator.deleteAssessment },
  { method: 'GET', path: 'facilitator/submissions', roles: ['facilitator'], handler: facilitator.listSubmissions },
  { method: 'POST', path: 'facilitator/grade', roles: ['facilitator', 'admin'], handler: facilitator.gradeSubmission },
  { method: 'GET', path: 'facilitator/students', roles: ['facilitator'], handler: facilitator.listMyStudents },
  { method: 'GET', path: 'facilitator/students/:id', roles: ['facilitator'], handler: facilitator.studentDetail },

  // admin
  { method: 'GET', path: 'admin/overview', roles: ['admin'], handler: admin.adminOverview },
  { method: 'GET', path: 'admin/students', roles: ['admin'], handler: admin.listStudents },
  { method: 'POST', path: 'admin/students', roles: ['admin'], handler: admin.createStudent },
  { method: 'PUT', path: 'admin/students/:id', roles: ['admin'], handler: admin.updateStudent },
  { method: 'DELETE', path: 'admin/students/:id', roles: ['admin'], handler: admin.deleteStudent },
  { method: 'POST', path: 'admin/students/:id/reset-password', roles: ['admin'], handler: admin.resetStudentPassword },
  { method: 'GET', path: 'admin/facilitators', roles: ['admin'], handler: admin.listFacilitators },
  { method: 'POST', path: 'admin/facilitators', roles: ['admin'], handler: admin.createFacilitator },
  { method: 'PUT', path: 'admin/facilitators/:id', roles: ['admin'], handler: admin.updateFacilitator },
  { method: 'DELETE', path: 'admin/facilitators/:id', roles: ['admin'], handler: admin.deleteFacilitator },
  { method: 'POST', path: 'admin/facilitators/:id/reset-password', roles: ['admin'], handler: admin.resetFacilitatorPassword },
  { method: 'GET', path: 'admin/classes', roles: ['admin'], handler: admin.listClasses },
  { method: 'POST', path: 'admin/classes', roles: ['admin'], handler: admin.createClass },
  { method: 'PUT', path: 'admin/classes/:id', roles: ['admin'], handler: admin.updateClass },
  { method: 'DELETE', path: 'admin/classes/:id', roles: ['admin'], handler: admin.deleteClass },
  { method: 'POST', path: 'admin/enroll', roles: ['admin'], handler: admin.adminEnroll },
  { method: 'DELETE', path: 'admin/unenroll/:classId/:studentId', roles: ['admin'], handler: admin.adminUnenroll },
  { method: 'GET', path: 'admin/messages', roles: ['admin'], handler: admin.listMessages },
  { method: 'PUT', path: 'admin/messages/:id', roles: ['admin'], handler: admin.updateMessage },
  { method: 'DELETE', path: 'admin/messages/:id', roles: ['admin'], handler: admin.deleteMessage },
];

export function matchRoute(method, path) {
  const parts = path.split('/').filter(Boolean);
  for (const route of routes) {
    if (route.method !== method) continue;
    const routeParts = route.path.split('/').filter(Boolean);
    if (routeParts.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < routeParts.length; i += 1) {
      if (routeParts[i].startsWith(':')) {
        params[routeParts[i].slice(1)] = decodeURIComponent(parts[i]);
      } else if (routeParts[i] !== parts[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
}
