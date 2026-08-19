import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationAccessService } from './access/organization-access.service';
import { ProjectAccessService } from './access/project-access.service';
import { WorkspaceAccessService } from './access/workspace-access.service';
import { ContextService } from './context/context.service';
import { CodeGeneratorService } from './generator/code-generator.service';
import { ProjectStatusServiceValidation } from './validation/project-status.service';
import { TaskAssigneeServiceValidation } from './validation/task-assignee.service';
import { TaskParentServiceValidation } from './validation/task-parent.service';
import { TaskPriorityServiceValidation } from './validation/task-priority.service';
import { TaskStatusServiceValidation } from './validation/task-status.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    ContextService,
    WorkspaceAccessService,
    OrganizationAccessService,
    ProjectAccessService,
    ProjectStatusServiceValidation,
    CodeGeneratorService,
    TaskStatusServiceValidation,
    TaskPriorityServiceValidation,
    TaskParentServiceValidation,
    TaskAssigneeServiceValidation,
  ],
  exports: [
    ContextService,
    WorkspaceAccessService,
    OrganizationAccessService,
    ProjectAccessService,
    ProjectStatusServiceValidation,
    CodeGeneratorService,
    TaskStatusServiceValidation,
    TaskPriorityServiceValidation,
    TaskParentServiceValidation,
    TaskAssigneeServiceValidation,
  ],
})
export class CommonModule {}
