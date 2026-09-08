import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./baseQueryWithReauth";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "Profile",
    "Users",
    "Roles",
    "Notifications",
    "UnreadNotifications",
    "Projects",
    "Tasks",
    "TimeEntries",
    "Reports",
    "ReportCompliance",
    "Dashboard",
    "DashboardActivity",
  ],
  endpoints: () => ({}),
});
