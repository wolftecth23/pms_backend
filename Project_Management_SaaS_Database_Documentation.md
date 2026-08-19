# Project Management SaaS Database Documentation

## Overview

This schema implements a hierarchical multi-tenant Project Management
SaaS.

``` text
User
 ├── Owns ───────────────► Organization
 │                          │
 │                          ├── OrganizationMember ◄──── User
 │                          │
 │                          └── Workspace
 │                                 │
 │                                 ├── WorkspaceMember ◄── User
 │                                 │
 │                                 └── Project
 │                                        │
 │                                        ├── ProjectMember ◄── User
 │                                        ├── ProjectActivity
 │                                        └── Task
 │                                               ├── Sub Tasks
 │                                               ├── TaskAssignee
 │                                               └── TaskActivity
```

# ER Diagram (Mermaid)

``` mermaid
erDiagram
    USER ||--o{ ORGANIZATION : owns
    USER ||--o{ ORGANIZATION_MEMBER : joins
    ORGANIZATION ||--o{ ORGANIZATION_MEMBER : has

    ORGANIZATION ||--o{ WORKSPACE : contains
    USER ||--o{ WORKSPACE : creates
    WORKSPACE ||--o{ WORKSPACE_MEMBER : has
    USER ||--o{ WORKSPACE_MEMBER : joins

    WORKSPACE ||--o{ PROJECT : contains
    USER ||--o{ PROJECT : creates
    PROJECT ||--o{ PROJECT_MEMBER : has
    USER ||--o{ PROJECT_MEMBER : joins
    PROJECT ||--o{ PROJECT_ACTIVITY : logs

    PROJECT ||--o{ TASK : contains
    TASK ||--o{ TASK : parent_child
    TASK ||--o{ TASK_ASSIGNEE : assigned
    PROJECT_MEMBER ||--o{ TASK_ASSIGNEE : assigned_to
    TASK ||--o{ TASK_ACTIVITY : history
    USER ||--o{ TASK_ACTIVITY : performs
```

# Flow

1.  User signs up.
2.  User creates an Organization.
3.  Other users join through OrganizationMember.
4.  Organization contains one or more Workspaces.
5.  Workspace contains Projects.
6.  Project has Members.
7.  Project contains Tasks.
8.  Tasks may contain Subtasks.
9.  Tasks are assigned using TaskAssignee.
10. Every important action is recorded in ProjectActivity or
    TaskActivity.

# Model Documentation

## User

Represents every authenticated person.

  Field        Purpose
  ------------ -----------------------------
  id           Primary Key
  firstName    User first name
  lastName     Optional surname
  email        Unique login email
  password     Nullable for OAuth login
  avatar       Profile image
  isVerified   Email verification
  isActive     Soft account enable/disable
  createdAt    Creation timestamp
  updatedAt    Auto update timestamp

Relations: - owns Organizations - belongs to Organizations - creates
Workspaces - creates Projects - creates Tasks

------------------------------------------------------------------------

## Organization

Top level tenant.

  Field          Purpose
  -------------- --------------------------------
  id             Primary Key
  name           Organization display name
  slug           URL friendly unique identifier
  description    Optional description
  logoUrl        Branding
  website        Company website
  ownerId        Owner user
  status         ACTIVE/SUSPENDED/ARCHIVED
  timezone       Default timezone
  country        Country
  currency       Billing/reporting currency
  language       Default language
  maxMembers     Subscription limit
  storageLimit   Storage quota (bytes)
  isActive       Quick enable/disable
  createdAt      Created
  updatedAt      Updated
  deletedAt      Soft delete

------------------------------------------------------------------------

## OrganizationMember

Maps Users to Organizations.

Fields: - id : PK - organizationId : FK - userId : FK - role :
OWNER/ADMIN/MANAGER/MEMBER/GUEST - joinedAt : Join timestamp

Composite Unique: - organizationId + userId

------------------------------------------------------------------------

## Workspace

Logical department/team.

Fields: - id : PK - organizationId : Parent Organization - name :
Workspace name - description : Description - createdById : Creator -
createdAt : Creation - updatedAt : Update - deletedAt : Soft delete

------------------------------------------------------------------------

## WorkspaceMember

Workspace level access.

Fields: - id - workspaceId - userId - role

Unique: - workspaceId + userId

------------------------------------------------------------------------

## Project

Main working container.

Important fields:

-   key : Human readable code (ABC)
-   visibility : PRIVATE or WORKSPACE
-   status : Lifecycle
-   priority : Priority
-   startDate/dueDate/completedAt : Planning
-   isArchived : Archive flag
-   isFavorite : Personal favorite
-   deletedAt : Soft delete

Indexes: - workspaceId - status

Unique: - workspaceId + key

------------------------------------------------------------------------

## ProjectMember

Project specific permissions.

Fields: - projectId - userId - role - joinedAt

------------------------------------------------------------------------

## ProjectActivity

Audit history.

Purpose: - Status change - Member added - Name changed - Due date
change - Comments - Restore/Delete

Fields: - oldValue/newValue store JSON snapshots. - previousActivityId
creates linked activity chain.

------------------------------------------------------------------------

## Task

Smallest executable work item.

Important fields:

-   parentTaskId → Enables Subtasks
-   status → Workflow
-   priority
-   estimatedHours
-   actualHours
-   order → Drag & Drop ordering
-   comment → Quick note
-   createdById
-   deletedAt

Indexes: - projectId - status - priority

------------------------------------------------------------------------

## TaskAssignee

Allows multiple assignees.

Stores: - who assigned - when assigned - which ProjectMember is assigned

------------------------------------------------------------------------

## TaskActivity

Complete audit trail.

Captures:

-   Status changes
-   Comments
-   Attachments
-   Checklist
-   Labels
-   Estimates
-   Time logs

Useful fields:

-   entityType → Which entity changed
-   fieldName → Name of updated field
-   oldValue/newValue → Before/After
-   message → Human readable log

------------------------------------------------------------------------

# Design Highlights

-   Multi-tenant architecture
-   Soft delete support
-   Audit logs
-   Hierarchical permissions
-   Role based authorization
-   Recursive subtasks
-   Activity history
-   Optimized indexes
-   Composite unique constraints
-   Workspace separation
-   Organization isolation

# Request Flow

User → Organization → Organization Members → Workspace → Workspace
Members → Project → Project Members → Tasks → Task Assignees →
Activities

This hierarchy keeps every tenant isolated while allowing flexible
collaboration.
