export interface ProjectDto {
  id: string;
  name: string;
  clientName: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface ProjectInput {
  name: string;
  clientName?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}
export interface ProjectMemberDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}
