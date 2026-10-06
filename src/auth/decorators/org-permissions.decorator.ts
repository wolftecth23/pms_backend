import { SetMetadata } from '@nestjs/common';

export const ORG_PERMISSIONS_KEY = 'org_permissions';
export const ANY_ORG_PERMISSIONS_KEY = 'any_org_permissions';

export const RequireOrgPermissions = (...permissions: string[]) =>
  SetMetadata(ORG_PERMISSIONS_KEY, permissions);

export const RequireAnyOrgPermissions = (...permissions: string[]) =>
  SetMetadata(ANY_ORG_PERMISSIONS_KEY, permissions);
