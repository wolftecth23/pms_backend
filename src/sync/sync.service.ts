import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SyncEntity, SyncStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { resolveRole } from '../../prisma/data/roles';
import { seedOrganization } from '../../prisma/seeders/organization.seed';
import { seedWorkspace } from '../../prisma/seeders/workspace.seed';
import { PrismaService } from '../prisma/prisma.service';
import { UserMapper } from './mappers/user.mapper';
import { SourceDatabaseService } from './source-database.service';
import { SourceUser, SyncResponse } from './types/sync.types';
import { validateSourceUser } from './utils/sync-validator.util';

@Injectable()
export class SyncService implements OnModuleInit {
  private readonly logger = new Logger(SyncService.name);
  private dummyPasswordHash!: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sourceDatabaseService: SourceDatabaseService,
  ) {}

  /**
   * Pre-generates a secure bcrypt password hash to use as a placeholder for synced users.
   * This is done once on startup to avoid expensive bcrypt hashing on every single insert.
   */
  async onModuleInit() {
    this.logger.log(
      'Pre-generating secure dummy password hash for user synchronization...',
    );
    // We generate a hash for a random UUID, locking out direct standard password authentication.
    this.dummyPasswordHash = await bcrypt.hash('dev.shivlab', 10);
    this.logger.log('Secure dummy password hash pre-generated successfully.');
  }

  /**
   * Synchronizes user records from the source database into the destination application database.
   */
  async syncUsers(): Promise<SyncResponse> {
    const startedAt = new Date();
    this.logger.log('Starting user synchronization...');

    // 1. Create SyncHistory record with status IN_PROGRESS
    const syncHistory = await this.prisma.syncHistory.create({
      data: {
        entity: SyncEntity.USER,
        status: SyncStatus.IN_PROGRESS,
        startedAt,
        totalRecords: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
      },
    });

    const syncHistoryId = syncHistory.id;
    let sourceUsers: SourceUser[] = [];

    // Counters
    let totalRecords = 0;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    try {
      // 2. Fetch users from external source database
      sourceUsers = await this.sourceDatabaseService.fetchUsers();
      totalRecords = sourceUsers.length;

      this.logger.log(`Fetched ${totalRecords} users from source database.`);
    } catch (fetchError) {
      const error =
        fetchError instanceof Error ? fetchError : new Error('Unknown error');

      const errorMsg = `Failed to fetch users from source database: ${error.message}`;

      this.logger.error(errorMsg, error.stack);

      // Update sync history to FAILED if retrieval fails entirely
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      await this.prisma.syncHistory.update({
        where: { id: syncHistoryId },
        data: {
          status: SyncStatus.FAILED,
          completedAt,
          durationMs,
          totalRecords: 0,
          message: errorMsg,
        },
      });

      throw fetchError;
    }

    // 3. Cache existing user IDs in memory for efficient insert vs update classification
    const existingUsers = await this.prisma.user.findMany({
      select: { id: true },
    });
    const existingIds = new Set<string>(existingUsers.map((u) => u.id));

    // 4. Iterate and synchronize users
    for (const sourceUser of sourceUsers) {
      const recordId =
        sourceUser.id !== null && sourceUser.id !== undefined
          ? String(sourceUser.id)
          : null;
      const email = sourceUser.email || null;

      try {
        // Validate user record
        const validation = validateSourceUser(sourceUser);
        if (!validation.isValid) {
          skipped++;

          this.logger.warn(
            `Skipping user (ID: ${recordId}, Email: ${email}): ${validation.reason}`,
          );

          // Log sync validation error
          await this.prisma.syncHistoryError.create({
            data: {
              syncHistoryId,
              recordId,
              email,
              reason: validation.reason || 'Validation failed',
              payload: sourceUser,
            },
          });
          continue;
        }

        // Map and Upsert into database
        const userIdStr = String(sourceUser.id);
        const isUpdate = existingIds.has(userIdStr);

        const createInput = UserMapper.toUserCreateInput(
          sourceUser,
          this.dummyPasswordHash,
        );
        const updateInput = UserMapper.toUserUpdateInput(sourceUser);

        await this.prisma.user.upsert({
          where: { id: userIdStr },
          create: createInput,
          update: updateInput,
        });

        if (isUpdate) {
          updated++;
        } else {
          inserted++;
          existingIds.add(userIdStr); // Prevent double count if duplicates exist in payload
        }
      } catch (itemError) {
        // failed++;

        // this.logger.error(
        //   `Failed to sync user record (ID: ${recordId}, Email: ${email}): ${errorReason}`,
        //   itemError.stack,
        // );

        const error =
          itemError instanceof Error
            ? itemError
            : new Error('Unknown database error');

        failed++;

        const errorReason = error.message || 'Database error during upsert';

        this.logger.error(
          `Failed to sync user record (ID: ${recordId}, Email: ${email}): ${error.message}`,
          error.stack,
        );

        try {
          await this.prisma.syncHistoryError.create({
            data: {
              syncHistoryId,
              recordId,
              email,
              reason: errorReason,
              payload: sourceUser,
            },
          });
        } catch (dbErrError) {
          // this.logger.error(
          //   `Failed to write sync history error to DB: ${dbErrError.message}`,
          //   dbErrError.stack,
          // );

          const error =
            dbErrError instanceof Error
              ? dbErrError
              : new Error('Unknown error');

          this.logger.error(
            `Failed to write sync history error to DB: ${error.message}`,
            error.stack,
          );
        }
      }
    }

    // 5. Finalize Sync History Status
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    let finalStatus: SyncStatus = SyncStatus.COMPLETED;
    if (failed === totalRecords && totalRecords > 0) {
      finalStatus = SyncStatus.FAILED;
    } else if (failed > 0 || skipped > 0) {
      finalStatus = SyncStatus.PARTIAL_SUCCESS;
    }

    const message = `Sync completed. Status: ${finalStatus}. Total: ${totalRecords}, Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}.`;
    this.logger.log(message);
    this.logger.log(`Duration: ${durationMs} ms`);

    await this.prisma.syncHistory.update({
      where: { id: syncHistoryId },
      data: {
        status: finalStatus,
        completedAt,
        durationMs,
        totalRecords,
        inserted,
        updated,
        skipped,
        failed,
        message,
      },
    });

    //  SEEDING ORG and ORG MEMBERS

    const orgId = await seedOrganization(this.prisma);

    const worspaceId = await seedWorkspace(this.prisma);

    console.log('worspaceId', worspaceId);

    if (!orgId) {
      throw new Error(
        'Owner user not found. Please sync users before running this seeder.',
      );
    }

    const shivlabUsers = await this.prisma.user.findMany({
      where: {
        email: {
          endsWith: '@shivlab.com',
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        designation: true,
      },
    });

    this.logger.log(`shivlabUsers ${shivlabUsers?.length}`);

    const roles = await this.prisma.role.findMany({
      where: {
        OR: [
          {
            scope: 'SYSTEM',
          },
          {
            organizationId: orgId,
          },
        ],
      },
    });

    const roleMap = new Map(roles.map((role) => [role.name, role]));

    const members = await this.prisma.organizationMember.findMany({
      where: {
        organizationId: orgId,
      },
      select: {
        userId: true,
      },
    });

    const memberSet = new Set(members.map((m) => m.userId));

    const membersToCreate = [];

    for (const user of shivlabUsers) {
      // Already member?
      if (memberSet.has(user.id)) {
        continue;
      }

      const roleName = resolveRole(user.designation);

      const role = roleMap.get(roleName);

      if (!role) {
        this.logger.warn(`Role '${roleName}' not found.`);
        continue;
      }

      await this.prisma.organizationMember.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          roleId: role.id,
        },
      });

      memberSet.add(user.id);
    }

    await this.prisma.organizationMember.createMany({
      data: membersToCreate,
      skipDuplicates: true,
    });

    return {
      success: true,
      syncHistoryId,
      summary: {
        total: totalRecords,
        inserted,
        updated,
        skipped,
        failed,
      },
    };
  }
}

// const shivlabUsers = await this.prisma.user.findMany({
//   where: {
//     email: {
//       endsWith: '@shivlab.com',
//       mode: 'insensitive', // Optional
//     },
//   },
//   select: {
//     id: true,
//     firstName: true,
//     lastName: true,
//     email: true,
//     designation: true,
//   },
//   orderBy: {
//     designation: 'asc',
//   },
// });

// this.logger.log('===== Shivlab Users =====');

// console.table(
//   shivlabUsers.map((user) => ({
//     ID: user.id,
//     Name: `${user.firstName} ${user.lastName ?? ''}`.trim(),
//     Email: user.email,
//     Designation: user.designation,
//   })),
// );

// const designations = await this.prisma.user.findMany({
//   where: {
//     email: {
//       endsWith: '@shivlab.com',
//       mode: 'insensitive',
//     },
//   },
//   distinct: ['designation'],
//   select: {
//     designation: true,
//   },
//   orderBy: {
//     designation: 'asc',
//   },
// });

// this.logger.log('Unique Designations:');
