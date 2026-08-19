import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayloadUser {
  id: string;
  email: string;
}

export interface JwtPermission {
  code: string;
}

export interface JwtWorkspace {
  id: string;
  name: string;
  description?: string | null;
}

export interface JwtRole {
  id: string;
  name: string;
}

export interface JwtOrganization {
  organizationId: string;
  organizationName: string;

  role: JwtRole;

  workspaces: JwtWorkspace[];

  permissions: string[];
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(
    email: string,
    pass: string,
  ): Promise<JwtPayloadUser | null> {
    const user = await this.prisma.user.findFirst({ where: { email } });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(pass, user.password);

    if (!isPasswordValid) {
      return null;
    }

    const { password: _password, ...result } = user;
    return result;
  }

  login(user: JwtPayloadUser) {
    const payload = {
      id: user.id,
      email: user.email,
    };

    // return {
    //   token: this.jwtService.sign(payload),
    // };

    return {
      message: 'You have signed in successfully.',
      data: {
        token: this.jwtService.sign(payload),
      },
    };
  }

  // async getUserDetails(userId: string) {
  //   const user = await this.prisma.user.findUnique({
  //     where: { id: userId },
  //     include: {
  //       organizationMember: {
  //         include: {
  //           organization: true,
  //           role: {
  //             include: {
  //               permissions: {
  //                 include: {
  //                   permission: true,
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //       workspaceMember: {
  //         include: {
  //           workspace: true,
  //           role: {
  //             include: {
  //               permissions: {
  //                 include: {
  //                   permission: true,
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //     },
  //   });

  //   if (!user) {
  //     return null;
  //   }

  //   const { password, ...result } = user;
  //   return result;
  // }

  async getUserWithPermissions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        organizationMember: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                workspace: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                  },
                },
              },
            },
            role: {
              include: {
                permissions: {
                  where: {
                    isActive: true,
                    deletedAt: null,
                  },
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,

      organizations: user.organizationMember.map((member) => ({
        organizationId: member.organization.id,
        organizationName: member.organization.name,

        role: {
          id: member.role.id,
          name: member.role.name,
        },

        workspaces: member.organization.workspace.map((workspace) => ({
          id: workspace.id,
          name: workspace.name,
          description: workspace.description,
        })),

        permissions: member?.role?.permissions?.map(
          (rp) => rp?.permission?.code,
        ),

        // permissions: member.role.permissions.map((rp) => ({
        //   id: rp.permission.id,
        //   code: rp.permission.code,
        //   name: rp.permission.name,
        //   module: rp.permission.module,
        // })),
      })),
    };
  }
}

// import { User } from '@prisma/client';

// type LoginUser = Omit<User, 'password'>;

// async login(user: LoginUser) {
//   const payload = {
//     sub: user.id,
//     email: user.email,
//   };

//   return {
//     access_token: await this.jwtService.signAsync(payload),
//   };
// }

// const permissionSet = new Set<string>();

// for (const member of user.organizationMember) {
//   for (const rolePermission of member.role.permissions) {
//     permissionSet.add(rolePermission.permission.code);
//   }
// }

// permissions: [...permissionSet],
