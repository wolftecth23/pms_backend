export const DEFAULT_ROLE_PERMISSIONS = {
  'Super Admin': ['*'],

  Owner: [
    'organization.view',
    'organization.update',
    'organization.settings',
    'organization.transfer_ownership',

    'organization_member.view',
    'organization_member.invite',
    'organization_member.remove',
    'organization_member.change_role',

    'workspace.view',
    'workspace.create',
    'workspace.update',
    'workspace.delete',
    'workspace.archive',
    'workspace.restore',
    'workspace.settings',

    'workspace_member.view',
    'workspace_member.add',
    'workspace_member.remove',
    'workspace_member.change_role',

    'project.view',
    'project.create',
    'project.update',
    'project.delete',
    'project.archive',
    'project.restore',
    'project.change_status',
    'project.manage_workflow',

    'project.view_workspace',
    'project.view_organization',

    'project_member.view',
    'project_member.add',
    'project_member.remove',
    'project_member.change_permissions',
    'project_member.change_role',

    'task.view',
    'task.view_all',
    'task.create',
    'task.update',
    'task.delete',
    'task.assign',
    'task.unassign',
    'task.change_status',
    'task.log_time',

    'task_status.view',
    'task_status.create',
    'task_status.update',
    'task_status.delete',

    'comment.view',
    'comment.create',
    'comment.update',
    'comment.delete',

    'role.view',
    'role.create',
    'role.update',
    'role.delete',
    'role.manage_permissions',

    'cr.create',
    'cr.view',
    'cr.update',
    'cr.delete',
    'cr.submit',
    'cr.approve_reject',
    'cr.cancel',
    'cr.manage_approvers',
  ],

  Admin: [
    'organization.view',
    'organization.update',
    'organization.settings',

    'organization_member.view',
    'organization_member.invite',
    'organization_member.remove',
    'organization_member.change_role',

    'user.view',
    'user.create',
    'user.update',
    'user.deactivate',

    'workspace.view',
    'workspace.create',
    'workspace.update',
    'workspace.delete',
    'workspace.settings',

    'workspace_member.view',
    'workspace_member.add',
    'workspace_member.remove',
    'workspace_member.change_role',

    'project.view',
    'project.create',
    'project.update',
    'project.delete',
    'project.archive',
    'project.restore',
    'project.change_status',
    'project.manage_workflow',
    'project.view_workspace',
    'project.view_organization',

    'project_member.view',
    'project_member.add',
    'project_member.remove',
    'project_member.change_permissions',
    'project_member.change_role',

    'task.view',
    'task.view_all',
    'task.create',
    'task.update',
    'task.delete',
    'task.assign',
    'task.unassign',
    'task.change_status',
    'task.log_time',

    'task_status.view',
    'task_status.create',
    'task_status.update',
    'task_status.delete',

    'comment.view',
    'comment.create',
    'comment.update',
    'comment.delete',

    'role.view',
    'role.create',
    'role.update',
    'role.manage_permissions',

    'cr.create',
    'cr.view',
    'cr.update',
    'cr.delete',
    'cr.submit',
    'cr.approve_reject',
    'cr.cancel',
    'cr.manage_approvers',
  ],

  'Project Manager': [
    'project.view',
    'project.create',
    'project.update',
    'project.change_status',
    'project.manage_workflow',
    'project.view_workspace',
    'project.view_organization',

    'project_member.view',
    'project_member.add',
    'project_member.remove',

    'task.view',
    'task.view_all',
    'task.create',
    'task.update',
    'task.delete',
    'task.assign',
    'task.unassign',
    'task.change_status',
    'task.log_time',

    'task_status.view',
    'task_status.create',
    'task_status.update',

    'comment.view',
    'comment.create',
    'comment.update',
    'comment.delete',

    'cr.create',
    'cr.view',
    'cr.update',
    'cr.submit',
    'cr.cancel',
    'cr.manage_approvers',
    'cr.approve_reject',
  ],

  'Team Lead': [
    'project.view',

    'project_member.view',

    'task.view',
    'task.view_all',
    'task.create',
    'task.update',
    'task.assign',
    'task.unassign',
    'task.change_status',
    'task.log_time',

    'task_status.view',

    'comment.view',
    'comment.create',
    'comment.update',
    'comment.delete',
  ],

  'Team Member': [
    'project.view',

    'task.view',
    'task.update',
    'task.change_status',
    'task.log_time',

    'comment.view',
    'comment.create',
  ],

  Guest: ['project.view', 'task.view', 'comment.view', 'comment.create'],
} as const;

// ─── PROJECT-SCOPED ROLE PERMISSIONS ─────────────────────────────────────────
//
// These permissions are assigned to PROJECT-scoped roles only.
// Organization-level permissions (organization.*, workspace.*, user.*) are
// intentionally excluded — project roles must never grant org-level access.

export const DEFAULT_PROJECT_ROLE_PERMISSIONS: Record<string, string[]> = {
  'Project Owner': [
    // Project
    'project.view',
    'project.update',
    'project.delete',
    'project.archive',
    'project.restore',
    'project.change_status',

    // Project Members
    'project_member.view',
    'project_member.add',
    'project_member.remove',
    'project_member.change_role',
    'project_member.change_permissions',

    // Tasks
    'task.view',
    'task.view_all',
    'task.create',
    'task.update',
    'task.delete',
    'task.change_status',
    'task.assign',
    'task.unassign',
    'task.log_time',

    // Task Status
    'task_status.view',
    'task_status.create',
    'task_status.update',
    'task_status.delete',

    // Comments
    'comment.view',
    'comment.create',
    'comment.update',
    'comment.delete',

    // Role
    'role.view',
    'role.create',
    'role.update',
    'role.delete',
    'role.manage_permissions',
  ],

  'Project Manager': [
    // Project
    'project.view',
    'project.update',
    'project.change_status',

    // Project Members
    'project_member.view',
    'project_member.add',
    'project_member.remove',
    'project_member.change_role',

    // Tasks
    'task.view',
    'task.view_all',
    'task.create',
    'task.update',
    'task.delete',
    'task.change_status',
    'task.assign',
    'task.unassign',
    'task.log_time',

    // Task Status
    'task_status.view',
    'task_status.create',
    'task_status.update',
    'task_status.delete',

    // Comments
    'comment.view',
    'comment.create',
    'comment.update',
    'comment.delete',

    // Role
    'role.view',
  ],

  // Note: Project-scoped 'Team Lead' — distinct from the org-level 'Team Lead'
  'Team Lead': [
    // Project
    'project.view',

    // Project Members
    'project_member.view',

    // Tasks
    'task.view',
    'task.view_all',
    'task.create',
    'task.update',
    'task.change_status',
    'task.assign',
    'task.unassign',
    'task.log_time',

    // Task Status
    'task_status.view',

    // Comments
    'comment.view',
    'comment.create',
    'comment.update',
    'comment.delete',
  ],

  // Note: Project-scoped 'Team Member' — distinct from org-level 'Team Member'
  'Team Member': [
    // Project
    'project.view',

    // Project Members
    'project_member.view',

    // Tasks
    'task.view',
    'task.view_all',
    'task.update',
    'task.change_status',
    'task.log_time',

    // Comments
    'comment.view',
    'comment.create',
    'comment.update',
    'comment.delete',
  ],

  // Note: Project-scoped 'Guest' — distinct from org-level 'Guest'
  Guest: [
    // Project
    'project.view',

    // Tasks
    'task.view',

    // Comments
    'comment.view',
    'comment.create',
    'comment.update',
    'comment.delete',
  ],
};
