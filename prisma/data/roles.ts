export const DEFAULT_ROLES = [
  {
    name: 'Super Admin',
    description: 'Full administrative access to the organization.',
    isSystem: true,
  },
  {
    name: 'Owner',
    description: 'Full access to the organization.',
    isSystem: true,
  },
  {
    name: 'Admin',
    description: 'Manages organization resources and members.',
    isSystem: true,
  },
  {
    name: 'Project Manager',
    description: 'Manages projects and project members.',
    isSystem: true,
  },
  {
    name: 'Team Lead',
    description: 'Leads assigned teams and projects.',
    isSystem: true,
  },
  {
    name: 'Team Member',
    description: 'Regular Team member.',
    isSystem: true,
  },
  {
    name: 'Guest',
    description: 'External collaborator with limited access.',
    isSystem: true,
  },
] as const;

export enum DefaultRole {
  SUPER_ADMIN = 'Super Admin',
  OWNER = 'Owner',
  ADMIN = 'Admin',
  PROJECT_MANAGER = 'Project Manager',
  TEAM_LEAD = 'Team Lead',
  TEAM_MEMBER = 'Team Member',
  GUEST = 'Guest',
}

export function resolveRole(designation: string): DefaultRole {
  const value = designation.trim().toLowerCase();

  // Owner
  if (
    value.includes('managing director') ||
    value.includes('chief operating officer') ||
    value.includes('chief technology officer')
  ) {
    return DefaultRole.OWNER;
  }

  // Admin
  if (value.includes('hr') || value.includes('team lead')) {
    return DefaultRole.ADMIN;
  }

  // Project Manager
  if (
    value.includes('business development manager') ||
    value.includes('project manager') ||
    value.includes('project coordinator')
  ) {
    return DefaultRole.PROJECT_MANAGER;
  }

  // Team Lead
  // if (value.includes('team lead')) {
  //   return DefaultRole.TEAM_LEAD;
  // }

  // Everyone else
  return DefaultRole.TEAM_MEMBER;
}
