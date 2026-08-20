-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ProjectVisibility" AS ENUM ('PRIVATE', 'WORKSPACE');

-- CreateEnum
CREATE TYPE "StatusScope" AS ENUM ('SYSTEM', 'ORGANIZATION', 'WORKSPACE', 'PROJECT');

-- CreateEnum
CREATE TYPE "SyncEntity" AS ENUM ('USER', 'DEPARTMENT', 'ROLE', 'SHIFT', 'ATTENDANCE', 'LEAVE');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'PARTIAL_SUCCESS');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "website" TEXT,
    "ownerId" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "country" TEXT,
    "currency" TEXT DEFAULT 'USD',
    "language" TEXT DEFAULT 'en',
    "maxMembers" INTEGER NOT NULL DEFAULT 10,
    "storageLimit" BIGINT NOT NULL DEFAULT 5368709120,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "removedById" TEXT,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_statuses" (
    "id" TEXT NOT NULL,
    "scope" "StatusScope" NOT NULL DEFAULT 'SYSTEM',
    "targetId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "color" TEXT,
    "order" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL,
    "isClosed" BOOLEAN NOT NULL,

    CONSTRAINT "project_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectCode" TEXT NOT NULL,
    "icon" TEXT,
    "statusId" TEXT NOT NULL,
    "priority" "ProjectPriority" NOT NULL DEFAULT 'MEDIUM',
    "visibility" "ProjectVisibility" NOT NULL DEFAULT 'WORKSPACE',
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectRoleId" TEXT,
    "visibleStatusIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "removedById" TEXT,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_activities" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "description" TEXT,
    "previousActivityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "scope" "StatusScope" NOT NULL DEFAULT 'ORGANIZATION',
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT,
    "projectMemberId" TEXT,
    "permissionId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_histories" (
    "id" TEXT NOT NULL,
    "entity" "SyncEntity" NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "totalRecords" INTEGER NOT NULL,
    "inserted" INTEGER NOT NULL,
    "updated" INTEGER NOT NULL,
    "skipped" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "message" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_history_errors" (
    "id" TEXT NOT NULL,
    "syncHistoryId" TEXT NOT NULL,
    "recordId" TEXT,
    "email" TEXT,
    "reason" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_history_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_statuses" (
    "id" TEXT NOT NULL,
    "scope" "StatusScope" NOT NULL DEFAULT 'SYSTEM',
    "targetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT,

    CONSTRAINT "task_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_priorities" (
    "id" TEXT NOT NULL,
    "scope" "StatusScope" NOT NULL DEFAULT 'SYSTEM',
    "targetId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "task_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentTaskId" TEXT,
    "title" TEXT NOT NULL,
    "taskStatusId" TEXT NOT NULL,
    "description" TEXT,
    "comment" TEXT,
    "priorityId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "estimatedHours" DECIMAL(65,30),
    "actualHours" DECIMAL(65,30),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignees" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "projectMemberId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "removedById" TEXT,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_activities" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "fieldName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "avatar" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "removedById" TEXT,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProjectMemberToRole" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProjectMemberToRole_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "project_statuses_scope_targetId_name_key" ON "project_statuses"("scope", "targetId", "name");

-- CreateIndex
CREATE INDEX "projects_workspaceId_idx" ON "projects"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_workspaceId_projectCode_key" ON "projects"("workspaceId", "projectCode");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_projectId_userId_key" ON "project_members"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organizationId_name_key" ON "roles"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "roles_scope_name_key" ON "roles"("scope", "name");

-- CreateIndex
CREATE INDEX "role_permissions_roleId_idx" ON "role_permissions"("roleId");

-- CreateIndex
CREATE INDEX "role_permissions_projectMemberId_idx" ON "role_permissions"("projectMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_projectMemberId_permissionId_key" ON "role_permissions"("projectMemberId", "permissionId");

-- CreateIndex
CREATE INDEX "sync_history_errors_syncHistoryId_idx" ON "sync_history_errors"("syncHistoryId");

-- CreateIndex
CREATE UNIQUE INDEX "task_statuses_scope_targetId_name_key" ON "task_statuses"("scope", "targetId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "task_statuses_scope_targetId_order_key" ON "task_statuses"("scope", "targetId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "task_priorities_scope_targetId_name_key" ON "task_priorities"("scope", "targetId", "name");

-- CreateIndex
CREATE INDEX "tasks_projectId_idx" ON "tasks"("projectId");

-- CreateIndex
CREATE INDEX "tasks_priorityId_idx" ON "tasks"("priorityId");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignees_taskId_projectMemberId_key" ON "task_assignees"("taskId", "projectMemberId");

-- CreateIndex
CREATE INDEX "task_activities_taskId_createdAt_idx" ON "task_activities"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "task_activities_eventType_idx" ON "task_activities"("eventType");

-- CreateIndex
CREATE INDEX "task_activities_userId_idx" ON "task_activities"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_organizationId_name_key" ON "workspaces"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key" ON "workspace_members"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "_ProjectMemberToRole_B_index" ON "_ProjectMemberToRole"("B");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "project_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectRoleId_fkey" FOREIGN KEY ("projectRoleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_activities" ADD CONSTRAINT "project_activities_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_activities" ADD CONSTRAINT "project_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_activities" ADD CONSTRAINT "project_activities_previousActivityId_fkey" FOREIGN KEY ("previousActivityId") REFERENCES "project_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_projectMemberId_fkey" FOREIGN KEY ("projectMemberId") REFERENCES "project_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_history_errors" ADD CONSTRAINT "sync_history_errors_syncHistoryId_fkey" FOREIGN KEY ("syncHistoryId") REFERENCES "sync_histories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_statuses" ADD CONSTRAINT "task_statuses_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_taskStatusId_fkey" FOREIGN KEY ("taskStatusId") REFERENCES "task_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_priorityId_fkey" FOREIGN KEY ("priorityId") REFERENCES "task_priorities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_projectMemberId_fkey" FOREIGN KEY ("projectMemberId") REFERENCES "project_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectMemberToRole" ADD CONSTRAINT "_ProjectMemberToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "project_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectMemberToRole" ADD CONSTRAINT "_ProjectMemberToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
