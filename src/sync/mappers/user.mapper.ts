import { Prisma } from '@prisma/client';
import { SourceUser } from '../types/sync.types';

export class UserMapper {
  /**
   * Maps a source database user to Prisma UserCreateInput.
   * Uses the source ID directly as user ID.
   */
  static toUserCreateInput(
    source: SourceUser,
    passwordHash: string,
  ): Prisma.UserCreateInput {
    return {
      id: String(source.id),
      firstName: source.firstname || 'Firstname',
      lastName: source.lastname || null,
      email: source.email!,
      password: passwordHash,
      designation: source.designation || 'Employee',
      avatar: source.avatarUrl || null,
      isActive: source.isActive || false,
      isVerified: true,
      // createdAt: source.created_at ? new Date(source.created_at) : new Date(),
      // updatedAt: source.updated_at ? new Date(source.updated_at) : new Date(),
    };
  }

  /**
   * Maps a source database user to Prisma UserUpdateInput.
   */
  static toUserUpdateInput(source: SourceUser): Prisma.UserUpdateInput {
    return {
      firstName: source.firstname || 'Firstname',
      lastName: source.lastname || null,
      email: source.email!,
      designation: source.designation || 'Employee',
      avatar: source.avatarUrl || null,
      isActive: source.isActive || false,
      // updatedAt: source.updated_at ? new Date(source.updated_at) : new Date(),
    };
  }
}
