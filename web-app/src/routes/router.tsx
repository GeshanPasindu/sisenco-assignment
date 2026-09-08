import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import { PERMISSIONS } from "../constants/permissions";
import { ROUTES } from "../constants/routes";
import {
  AcceptInvitationPage,
  ChangePasswordPage,
  LoginPage,
} from "../features/auth";
import { NotificationsPage } from "../features/notifications/pages/NotificationsPage";
import { ProfilePage } from "../features/profile/pages/ProfilePage";
import { UsersPage } from "../features/user-management/pages/UsersPage";
import { ProjectsPage } from "../features/projects/pages/ProjectsPage";
import { TasksPage } from "../features/tasks/pages/TasksPage";
import { ReportsPage } from "../features/reports/pages/ReportsPage";
import { AppLayout } from "../layouts/AppLayout";
import { AuthLayout } from "../layouts/AuthLayout";
import { PermissionRoute } from "./PermissionRoute";
import { ProtectedRoute } from "./ProtectedRoute";
import { PublicOnlyRoute } from "./PublicOnlyRoute";

export function createAppRouter({
  invitationToken,
}: {
  invitationToken: string | null;
}) {
  return createBrowserRouter([
    {
      element: <PublicOnlyRoute />,
      children: [
        {
          element: <AuthLayout />,
          children: [
            { path: ROUTES.login, element: <LoginPage /> },
            {
              path: "/accept-invitation",
              element: <AcceptInvitationPage token={invitationToken} />,
            },
          ],
        },
      ],
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <AppLayout />,
          children: [
            {
              path: ROUTES.home,
              element: (
                <PermissionRoute
                  anyOf={[
                    PERMISSIONS.dashboardReadOwn,
                    PERMISSIONS.dashboardReadTeam,
                  ]}
                >
                  <App />
                </PermissionRoute>
              ),
            },
            {
              path: ROUTES.dashboard,
              element: (
                <PermissionRoute
                  anyOf={[
                    PERMISSIONS.dashboardReadOwn,
                    PERMISSIONS.dashboardReadTeam,
                  ]}
                >
                  <App />
                </PermissionRoute>
              ),
            },
            {
              path: ROUTES.reports,
              element: (
                <PermissionRoute
                  anyOf={[
                    PERMISSIONS.reportReadOwn,
                    PERMISSIONS.reportReadTeam,
                  ]}
                >
                  <ReportsPage />
                </PermissionRoute>
              ),
            },
            {
              path: ROUTES.tasks,
              element: (
                <PermissionRoute
                  anyOf={[PERMISSIONS.taskReadOwn, PERMISSIONS.taskManageTeam]}
                >
                  <TasksPage />
                </PermissionRoute>
              ),
            },
            {
              path: ROUTES.projects,
              element: (
                <PermissionRoute allOf={[PERMISSIONS.projectRead]}>
                  <ProjectsPage />
                </PermissionRoute>
              ),
            },
            {
              path: ROUTES.users,
              element: (
                <PermissionRoute
                  requiredRoles={["MANAGER_ADMIN"]}
                  allOf={[PERMISSIONS.userReadTeam]}
                >
                  <UsersPage />
                </PermissionRoute>
              ),
            },
            {
              path: ROUTES.notifications,
              element: (
                <PermissionRoute allOf={[PERMISSIONS.notificationReadOwn]}>
                  <NotificationsPage />
                </PermissionRoute>
              ),
            },
            {
              path: ROUTES.profile,
              element: (
                <PermissionRoute allOf={[PERMISSIONS.profileReadOwn]}>
                  <ProfilePage />
                </PermissionRoute>
              ),
            },
            { path: ROUTES.changePassword, element: <ChangePasswordPage /> },
          ],
        },
      ],
    },
    { path: "*", element: <LoginPage /> },
  ]);
}
