-- Idempotent role and permission seed data.
-- This file is safe to run repeatedly and does not remove custom grants.

BEGIN;

INSERT INTO public.roles (id, code, name, description)
VALUES
  (
    md5('seed:role:TEAM_MEMBER')::uuid,
    'TEAM_MEMBER',
    'Team Member',
    'Standard team member'
  ),
  (
    md5('seed:role:MANAGER_ADMIN')::uuid,
    'MANAGER_ADMIN',
    'Manager/Admin',
    'Manager and administrator'
  )
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    deleted_at = NULL,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.permissions (id, code, description)
SELECT md5('seed:permission:' || p.code)::uuid, p.code, p.description
FROM (
  VALUES
    ('profile:read_own', 'Read the authenticated user profile'),
    ('profile:update_own', 'Update the authenticated user profile'),
    ('user:read_team', 'Read team users'),
    ('user:manage', 'Manage users and invitations'),
    ('project:read', 'Read projects'),
    ('project:manage', 'Create, update, and archive projects'),
    ('task:read_own', 'Read assigned tasks'),
    ('task:create_own', 'Create tasks assigned to the authenticated user'),
    ('task:update_own', 'Update assigned tasks'),
    ('task:manage_team', 'Manage team tasks'),
    ('time:manage_own', 'Create and update own time entries'),
    ('time:read_team', 'Read team time entries'),
    ('report:read_own', 'Read own reports'),
    ('report:create', 'Create reports'),
    ('report:update_own', 'Update own report drafts'),
    ('report:submit_own', 'Submit own reports'),
    ('report:read_team', 'Read team reports'),
    ('report:review', 'Review submitted reports'),
    ('dashboard:read_own', 'Read own dashboard'),
    ('dashboard:read_team', 'Read team dashboard'),
    ('notification:read_own', 'Read own notifications'),
    ('notification:update_own', 'Update own notifications')
) AS p(code, description)
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description;

WITH member_permissions(code) AS (
  VALUES
    ('profile:read_own'),
    ('profile:update_own'),
    ('project:read'),
    ('task:read_own'),
    ('task:create_own'),
    ('task:update_own'),
    ('time:manage_own'),
    ('report:read_own'),
    ('report:create'),
    ('report:update_own'),
    ('report:submit_own'),
    ('dashboard:read_own'),
    ('notification:read_own'),
    ('notification:update_own')
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN member_permissions m ON TRUE
JOIN public.permissions p ON p.code = m.code
WHERE r.code = 'TEAM_MEMBER'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager/admin receives all currently seeded permissions.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'MANAGER_ADMIN'
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
