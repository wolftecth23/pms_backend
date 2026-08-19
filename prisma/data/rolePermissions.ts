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
    'task.change_status',
    'task.log_time',

    'comment.view',
    'comment.create',
  ],

  Guest: ['project.view', 'task.view', 'comment.view', 'comment.create'],
} as const;
