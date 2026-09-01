import { SetMetadata } from '@nestjs/common';

export const PROJECT_PERMISSIONS_KEY = 'project_permissions';
export const ANY_PROJECT_PERMISSIONS_KEY = 'any_project_permissions';

export const RequireProjectPermissions = (...permissions: string[]) =>
  SetMetadata(PROJECT_PERMISSIONS_KEY, permissions);

export const RequireAnyProjectPermissions = (...permissions: string[]) =>
  SetMetadata(ANY_PROJECT_PERMISSIONS_KEY, permissions);
