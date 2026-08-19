import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'pg';
import { SourceUser } from './types/sync.types';

@Injectable()
export class SourceDatabaseService {
  private readonly logger = new Logger(SourceDatabaseService.name);

  /**
   * Creates a new PG Client connection using the source database URL.
   */
  private createClient(): Client {
    const connectionString = process.env.SOURCE_DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'SOURCE_DATABASE_URL environment variable is not defined',
      );
    }
    return new Client({ connectionString });
  }

  private logUnknownError(error: unknown, message: string): void {
    if (error instanceof Error) {
      this.logger.error(message, error.stack);
    } else {
      this.logger.error(message, JSON.stringify(error));
    }
  }

  /**
   * Connects to the source database, fetches all user records, and closes the connection.
   */
  async fetchUsers(): Promise<SourceUser[]> {
    const client = this.createClient();
    this.logger.log('Connecting to source database...');

    try {
      await client.connect();
      this.logger.log('Connected to source database.');

      // SQL Query to fetch user data
      const query = `
        SELECT 
          u.id, 
          u.email,
          u."firstName" AS firstname, 
          u."lastName" AS lastname,
          d.name AS designation, 
          u."isActive" AS "isActive",
          u."avatarUrl" AS "avatarUrl",
          u."createdAt" AS created_at, 
          u."updatedAt" AS updated_at
        FROM users u
        LEFT JOIN "Designation" d ON u."designationId" = d.id
      `;

      this.logger.log('Executing SQL query on source database...');
      const result = await client.query<SourceUser>(query);
      this.logger.log(`Fetched ${result.rowCount} users.`);

      return result.rows;
    } catch (error) {
      // this.logger.error(
      //   `Error querying source database: ${error.message}`,
      //   error.stack,
      // );
      // throw error;

      this.logUnknownError(error, 'Error querying source database.');
      throw error;
    } finally {
      try {
        await client.end();
        this.logger.log('Disconnected from source database.');
      } catch (endError) {
        // this.logger.error(
        //   `Failed to close source database connection: ${endError.message}`,
        //   endError.stack,
        // );

        this.logUnknownError(
          endError,
          'Failed to close source database connection.',
        );
      }
    }
  }
}
