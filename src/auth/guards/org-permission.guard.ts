import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { OrgPermissionService } from '../../common/access/org-permission.service';
import { JwtUser } from '../auth.controller';
import {
  ANY_ORG_PERMISSIONS_KEY,
  ORG_PERMISSIONS_KEY,
} from '../decorators/org-permissions.decorator';

type AuthenticatedRequest = FastifyRequest & {
  user: JwtUser;
  params: Record<string, string>;
  query: Record<string, string>;
  body: any;
  headers: Record<string, any>;
};

@Injectable()
export class OrgPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly orgPermissionService: OrgPermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(ORG_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const anyPermissions =
      this.reflector.getAllAndOverride<string[]>(ANY_ORG_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (!requiredPermissions.length && !anyPermissions.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id ?? (request.user as any)?.userId;

    if (!userId) {
      throw new ForbiddenException({
        message: 'You do not have permission to perform this action.',
        error: 'Forbidden',
        isAuthenticated: false,
      });
    }

    const orgId = this.resolveOrganizationId(request);

    if (!orgId) {
      throw new ForbiddenException({
        message: 'Organization context is required to verify permissions.',
        error: 'Forbidden',
        isAuthenticated: true,
      });
    }

    const member = await this.orgPermissionService.getOrgMember(
      userId,
      orgId,
    );

    if (!member) {
      throw new ForbiddenException({
        message: 'You are not a member of this organization or do not have access.',
        error: 'Forbidden',
        isAuthenticated: true,
      });
    }

    const memberPermissions =
      await this.orgPermissionService.getOrgMemberPermissions(userId, orgId);

    (request as any).orgMember = member;
    (request as any).orgPermissions = memberPermissions;

    const isSuperAdmin = memberPermissions.includes('*');

    if (requiredPermissions.length && !isSuperAdmin) {
      const hasAll = requiredPermissions.every((perm) =>
        memberPermissions.includes(perm),
      );

      if (!hasAll) {
        throw new ForbiddenException({
          message: 'You do not have permission to perform this action on this organization.',
          error: 'Forbidden',
          isAuthenticated: true,
        });
      }
    }

    if (anyPermissions.length && !isSuperAdmin) {
      const hasAny = anyPermissions.some((perm) =>
        memberPermissions.includes(perm),
      );

      if (!hasAny) {
        throw new ForbiddenException({
          message: 'You do not have permission to perform this action on this organization.',
          error: 'Forbidden',
          isAuthenticated: true,
        });
      }
    }

    return true;
  }

  private resolveOrganizationId(
    request: AuthenticatedRequest,
  ): string | null {
    const { params = {}, query = {}, body = {}, headers = {} } = request;

    if (params.orgId) {
      return params.orgId;
    }

    if (params.organizationId) {
      return params.organizationId;
    }

    const headerOrgId =
      headers['x-organization-id'] || headers['X-Organization-Id'];
    if (headerOrgId && typeof headerOrgId === 'string') {
      return headerOrgId;
    }

    if (query && typeof query === 'object') {
      if (query.orgId) return query.orgId as string;
      if (query.organizationId) return query.organizationId as string;
    }

    if (body && typeof body === 'object') {
      if (body.orgId) return body.orgId;
      if (body.organizationId) return body.organizationId;
    }

    return null;
  }
}
