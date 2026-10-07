export const PermissionModule = {
  ORGANIZATION: 'ORGANIZATION',
  ORGANIZATION_MEMBER: 'ORGANIZATION_MEMBER',

  USER: 'USER',

  WORKSPACE: 'WORKSPACE',
  WORKSPACE_MEMBER: 'WORKSPACE_MEMBER',

  PROJECT: 'PROJECT',
  PROJECT_MEMBER: 'PROJECT_MEMBER',

  TASK: 'TASK',
  TASK_STATUS: 'TASK_STATUS',

  COMMENT: 'COMMENT',

  ROLE: 'ROLE',

  CHANGE_REQUEST: 'CHANGE_REQUEST',

  TEAM: 'TEAM',
} as const;

export type PermissionModule =
  (typeof PermissionModule)[keyof typeof PermissionModule];

export const PROJECT_ALLOWED_MODULES = [
  PermissionModule.PROJECT,
  PermissionModule.PROJECT_MEMBER,
  PermissionModule.TASK,
  PermissionModule.TASK_STATUS,
  PermissionModule.COMMENT,
  PermissionModule.ROLE,
] as const;

export const DEFAULT_PERMISSIONS = [
  // Organization
  {
    code: 'organization.view',
    name: 'View Organization',
    description: 'View organization details',
    module: PermissionModule.ORGANIZATION,
  },
  {
    code: 'organization.create',
    name: 'Create Organization',
    description: 'Create organizations',
    module: PermissionModule.ORGANIZATION,
  },
  {
    code: 'organization.update',
    name: 'Update Organization',
    description: 'Edit organization details',
    module: PermissionModule.ORGANIZATION,
  },
  {
    code: 'organization.delete',
    name: 'Delete Organization',
    description: 'Delete organizations',
    module: PermissionModule.ORGANIZATION,
  },
  {
    code: 'organization.archive',
    name: 'Archive Organization',
    description: 'Archive organizations',
    module: PermissionModule.ORGANIZATION,
  },
  {
    code: 'organization.restore',
    name: 'Restore Organization',
    description: 'Restore archived organizations',
    module: PermissionModule.ORGANIZATION,
  },
  {
    code: 'organization.settings',
    name: 'Manage Organization Settings',
    description: 'Manage organization settings',
    module: PermissionModule.ORGANIZATION,
  },
  {
    code: 'organization.transfer_ownership',
    name: 'Transfer Ownership',
    description: 'Transfer organization ownership',
    module: PermissionModule.ORGANIZATION,
  },

  // Organization Member
  {
    code: 'organization_member.view',
    name: 'View Organization Members',
    description: 'View organization members',
    module: PermissionModule.ORGANIZATION_MEMBER,
  },
  {
    code: 'organization_member.add',
    name: 'Add Organization Members',
    description: 'Add members to the organization',
    module: PermissionModule.ORGANIZATION_MEMBER,
  },
  {
    code: 'organization_member.update',
    name: 'Update Organization Members',
    description: 'Update organization member details and roles',
    module: PermissionModule.ORGANIZATION_MEMBER,
  },
  {
    code: 'organization_member.remove',
    name: 'Remove Organization Members',
    description: 'Remove users from the organization',
    module: PermissionModule.ORGANIZATION_MEMBER,
  },

  // User
  {
    code: 'user.view',
    name: 'View Users',
    description: 'View users within the organization',
    module: PermissionModule.USER,
  },
  {
    code: 'user.create',
    name: 'Create User',
    description: 'Create new users',
    module: PermissionModule.USER,
  },
  {
    code: 'user.update',
    name: 'Update User',
    description: 'Update user information',
    module: PermissionModule.USER,
  },
  {
    code: 'user.delete',
    name: 'Delete User',
    description: 'Delete users',
    module: PermissionModule.USER,
  },
  {
    code: 'user.activate',
    name: 'Activate User',
    description: 'Activate user accounts',
    module: PermissionModule.USER,
  },
  {
    code: 'user.deactivate',
    name: 'Deactivate User',
    description: 'Deactivate user accounts',
    module: PermissionModule.USER,
  },
  {
    code: 'user.reset_password',
    name: 'Reset User Password',
    description: "Reset another user's password",
    module: PermissionModule.USER,
  },

  // Workspace
  {
    code: 'workspace.view',
    name: 'View Workspace',
    description: 'View workspaces',
    module: PermissionModule.WORKSPACE,
  },
  {
    code: 'workspace.create',
    name: 'Create Workspace',
    description: 'Create workspaces',
    module: PermissionModule.WORKSPACE,
  },
  {
    code: 'workspace.update',
    name: 'Update Workspace',
    description: 'Edit workspaces',
    module: PermissionModule.WORKSPACE,
  },
  {
    code: 'workspace.delete',
    name: 'Delete Workspace',
    description: 'Delete workspaces',
    module: PermissionModule.WORKSPACE,
  },
  {
    code: 'workspace.archive',
    name: 'Archive Workspace',
    description: 'Archive workspaces',
    module: PermissionModule.WORKSPACE,
  },
  {
    code: 'workspace.restore',
    name: 'Restore Workspace',
    description: 'Restore archived workspaces',
    module: PermissionModule.WORKSPACE,
  },
  {
    code: 'workspace.settings',
    name: 'Manage Workspace Settings',
    description: 'Manage workspace settings',
    module: PermissionModule.WORKSPACE,
  },

  // Workspace Member
  {
    code: 'workspace_member.view',
    name: 'View Workspace Members',
    description: 'View workspace members',
    module: PermissionModule.WORKSPACE_MEMBER,
  },
  {
    code: 'workspace_member.add',
    name: 'Add Workspace Member',
    description: 'Add organization members to a workspace',
    module: PermissionModule.WORKSPACE_MEMBER,
  },
  {
    code: 'workspace_member.remove',
    name: 'Remove Workspace Member',
    description: 'Remove members from a workspace',
    module: PermissionModule.WORKSPACE_MEMBER,
  },
  {
    code: 'workspace_member.change_role',
    name: 'Change Workspace Member Role',
    description: 'Change a workspace member role',
    module: PermissionModule.WORKSPACE_MEMBER,
  },

  // Project
  {
    code: 'project.view',
    name: 'View Project',
    description: 'View projects',
    module: PermissionModule.PROJECT,
  },
  {
    code: 'project.view_workspace',
    name: 'View Workspace Projects',
    description: 'View all projects in the current workspace',
    module: PermissionModule.PROJECT,
  },
  {
    code: 'project.view_organization',
    name: 'View Organization Projects',
    description: 'View all projects across the organization',
    module: PermissionModule.PROJECT,
  },
  {
    code: 'project.create',
    name: 'Create Project',
    description: 'Create projects',
    module: PermissionModule.PROJECT,
  },
  {
    code: 'project.update',
    name: 'Update Project',
    description: 'Update project details',
    module: PermissionModule.PROJECT,
  },
  {
    code: 'project.delete',
    name: 'Delete Project',
    description: 'Delete projects',
    module: PermissionModule.PROJECT,
  },
  {
    code: 'project.archive',
    name: 'Archive Project',
    description: 'Archive projects',
    module: PermissionModule.PROJECT,
  },
  {
    code: 'project.restore',
    name: 'Restore Project',
    description: 'Restore archived projects',
    module: PermissionModule.PROJECT,
  },
  {
    code: 'project.change_status',
    name: 'Change Project Status',
    description: 'Change project lifecycle status',
    module: PermissionModule.PROJECT,
  },
  // {
  //   code: 'project.manage_workflow',
  //   name: 'Manage Workflow',
  //   description: 'Manage task workflow statuses',
  //   module: PermissionModule.PROJECT,
  // },

  // Project Member
  {
    code: 'project_member.view',
    name: 'View Project Members',
    description: 'View project members',
    module: PermissionModule.PROJECT_MEMBER,
  },
  {
    code: 'project_member.add',
    name: 'Add Project Member',
    description: 'Add workspace members to a project',
    module: PermissionModule.PROJECT_MEMBER,
  },
  {
    code: 'project_member.remove',
    name: 'Remove Project Member',
    description: 'Remove members from a project',
    module: PermissionModule.PROJECT_MEMBER,
  },
  {
    code: 'project_member.change_permissions',
    name: 'Change Project Member Permissions',
    description: 'Change a project member permissions',
    module: PermissionModule.PROJECT_MEMBER,
  },
  {
    code: 'project_member.change_role',
    name: 'Change Project Member Role',
    description: 'Change a project member role',
    module: PermissionModule.PROJECT_MEMBER,
  },

  // Task
  {
    code: 'task.view',
    name: 'View Task',
    description: 'View tasks',
    module: PermissionModule.TASK,
  },
  {
    code: 'task.view_all',
    name: 'View All Tasks',
    description: 'View all tasks in the current project',
    module: PermissionModule.TASK,
  },
  {
    code: 'task.create',
    name: 'Create Task',
    description: 'Create tasks',
    module: PermissionModule.TASK,
  },
  {
    code: 'task.update',
    name: 'Update Task',
    description: 'Edit task',
    module: PermissionModule.TASK,
  },
  {
    code: 'task.delete',
    name: 'Delete Task',
    description: 'Delete task',
    module: PermissionModule.TASK,
  },
  {
    code: 'task.change_status',
    name: 'Change Task Status',
    description: 'Move task between statuses',
    module: PermissionModule.TASK,
  },
  {
    code: 'task.assign',
    name: 'Assign Task',
    description: 'Assign task to members',
    module: PermissionModule.TASK,
  },
  {
    code: 'task.unassign',
    name: 'Unassign Task',
    description: 'Remove assignee',
    module: PermissionModule.TASK,
  },
  {
    code: 'task.log_time',
    name: 'Log Time',
    description: 'Log work time',
    module: PermissionModule.TASK,
  },

  // Task Status
  {
    code: 'task_status.view',
    name: 'View Task Status',
    description: 'View workflow statuses',
    module: PermissionModule.TASK_STATUS,
  },
  {
    code: 'task_status.create',
    name: 'Create Task Status',
    description: 'Create workflow status',
    module: PermissionModule.TASK_STATUS,
  },
  {
    code: 'task_status.update',
    name: 'Update Task Status',
    description: 'Update workflow status',
    module: PermissionModule.TASK_STATUS,
  },
  {
    code: 'task_status.delete',
    name: 'Delete Task Status',
    description: 'Delete workflow status',
    module: PermissionModule.TASK_STATUS,
  },

  // Comment
  {
    code: 'comment.view',
    name: 'View Comments',
    description: 'View comments',
    module: PermissionModule.COMMENT,
  },
  {
    code: 'comment.create',
    name: 'Create Comment',
    description: 'Add comments',
    module: PermissionModule.COMMENT,
  },
  {
    code: 'comment.update',
    name: 'Update Comment',
    description: 'Edit comments',
    module: PermissionModule.COMMENT,
  },
  {
    code: 'comment.delete',
    name: 'Delete Comment',
    description: 'Delete comments',
    module: PermissionModule.COMMENT,
  },

  // Role
  {
    code: 'role.view',
    name: 'View Roles',
    description: 'View custom roles',
    module: PermissionModule.ROLE,
  },
  {
    code: 'role.create',
    name: 'Create Role',
    description: 'Create custom roles',
    module: PermissionModule.ROLE,
  },
  {
    code: 'role.update',
    name: 'Update Role',
    description: 'Update custom roles',
    module: PermissionModule.ROLE,
  },
  {
    code: 'role.delete',
    name: 'Delete Role',
    description: 'Delete custom roles',
    module: PermissionModule.ROLE,
  },
  {
    code: 'role.manage_permissions',
    name: 'Manage Role Permissions',
    description: 'Assign permissions to roles',
    module: PermissionModule.ROLE,
  },

  // Change Request
  {
    code: 'cr.create',
    name: 'Create Change Request',
    description: 'Create a new Change Request',
    module: PermissionModule.CHANGE_REQUEST,
  },
  {
    code: 'cr.view',
    name: 'View Change Requests',
    description: 'View CRs across all projects in the org',
    module: PermissionModule.CHANGE_REQUEST,
  },
  {
    code: 'cr.update',
    name: 'Update Change Request',
    description: 'Edit a CR in DRAFT or PENDING_MODIFICATION',
    module: PermissionModule.CHANGE_REQUEST,
  },
  {
    code: 'cr.delete',
    name: 'Delete Change Request',
    description: 'Delete / archive a CR',
    module: PermissionModule.CHANGE_REQUEST,
  },
  {
    code: 'cr.submit',
    name: 'Submit Change Request',
    description: 'Submit a CR for review',
    module: PermissionModule.CHANGE_REQUEST,
  },
  {
    code: 'cr.approve_reject',
    name: 'Approve or Reject Change Request',
    description: 'Approve or reject a CR',
    module: PermissionModule.CHANGE_REQUEST,
  },
  {
    code: 'cr.cancel',
    name: 'Cancel Change Request',
    description: 'Cancel a CR',
    module: PermissionModule.CHANGE_REQUEST,
  },
  {
    code: 'cr.manage_approvers',
    name: 'Manage Change Request Approvers',
    description: 'Add or remove approvers from the org member pool',
    module: PermissionModule.CHANGE_REQUEST,
  },

  // Team
  {
    code: 'team.view',
    name: 'View Teams',
    description: 'View organization teams',
    module: PermissionModule.TEAM,
  },
  {
    code: 'team.create',
    name: 'Create Team',
    description: 'Create new teams in the organization',
    module: PermissionModule.TEAM,
  },
  {
    code: 'team.update',
    name: 'Update Team',
    description: 'Edit team details',
    module: PermissionModule.TEAM,
  },
  {
    code: 'team.delete',
    name: 'Delete Team',
    description: 'Delete teams from the organization',
    module: PermissionModule.TEAM,
  },
];
