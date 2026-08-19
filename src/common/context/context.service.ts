import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthRequest } from '../../auth/auth.controller';
import { JwtOrganization } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectContext } from '../../project/project.service';

@Injectable()
export class ContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveContext(
    request: AuthRequest,
    workspaceId?: string,
    organizationId?: string,
  ): Promise<ProjectContext> {
    const userId = request.user.id ?? request.user.userId;

    if (!userId) {
      throw new UnauthorizedException('User not found.');
    }

    let resolvedWorkspaceId =
      workspaceId ?? (request.headers['x-workspace-id'] as string | undefined);

    let resolvedOrganizationId =
      organizationId ??
      (request.headers['x-organization-id'] as string | undefined);

    const organizations = request.user.organizations;

    let organization = organizations.find(
      (o) => o.organizationId === resolvedOrganizationId,
    );

    if (!resolvedWorkspaceId) {
      if (resolvedOrganizationId) {
        organization = organizations.find(
          (o) => o.organizationId === resolvedOrganizationId,
        );

        if (!organization) {
          throw new ForbiddenException(
            'You are not a member of the selected organization.',
          );
        }
        if (organization.workspaces.length === 0) {
          throw new BadRequestException(
            'The selected organization has no workspaces.',
          );
        }

        if (organization.workspaces.length > 1) {
          throw new BadRequestException(
            'workspaceId is required because this organization has multiple workspaces.',
          );
        }

        resolvedWorkspaceId = organization.workspaces[0].id;
      } else {
        if (organizations.length !== 1) {
          throw new BadRequestException(
            'Organization is required because you belong to multiple organizations.',
          );
        }

        organization = organizations[0];

        if (organization.workspaces.length === 0) {
          throw new BadRequestException('Your organization has no workspaces.');
        }

        if (organization.workspaces.length > 1) {
          throw new BadRequestException(
            'workspaceId is required because your organization has multiple workspaces.',
          );
        }

        resolvedOrganizationId = organization.organizationId;
        resolvedWorkspaceId = organization.workspaces[0].id;
      }
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: resolvedWorkspaceId,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    if (
      resolvedOrganizationId &&
      workspace.organizationId !== resolvedOrganizationId
    ) {
      throw new ForbiddenException(
        'The workspace does not belong to the selected organization.',
      );
    }

    resolvedOrganizationId ??= workspace.organizationId!;

    if (!resolvedOrganizationId) {
      throw new BadRequestException(
        'Workspace is not linked to any organization.',
      );
    }

    console.log('organization', organization);

    return {
      userId,
      workspaceId: resolvedWorkspaceId,
      organizationId: resolvedOrganizationId,
      permissions: organization?.permissions || [],
      hasPermission(permission: string) {
        return (organization?.permissions || [])?.includes(permission);
      },
    };
  }

  resolveOrganizationContext(
    request: AuthRequest,
    organizationId?: string,
  ): {
    userId: string;
    organizationId: string;
    permissions: string[];
    hasPermission: (permission: string) => boolean;
  } {
    const userId = request.user.id ?? request.user.userId;

    if (!userId) {
      throw new UnauthorizedException('User not found.');
    }

    let resolvedOrganizationId =
      organizationId ??
      (request.headers['x-organization-id'] as string | undefined);

    const organizations = request.user.organizations;

    let organization: JwtOrganization | undefined = undefined;

    if (resolvedOrganizationId) {
      organization = organizations.find(
        (org) => org.organizationId === resolvedOrganizationId,
      );

      if (!organization) {
        throw new ForbiddenException(
          'You are not a member of the selected organization.',
        );
      }
    } else {
      if (organizations.length !== 1) {
        throw new BadRequestException(
          'Organization is required because you belong to multiple organizations.',
        );
      }

      organization = organizations[0];
      resolvedOrganizationId = organization.organizationId;
    }

    return {
      userId,
      organizationId: resolvedOrganizationId,
      permissions: organization.permissions ?? [],

      hasPermission(permission: string): boolean {
        return (organization.permissions ?? []).includes(permission);
      },
    };
  }
}
