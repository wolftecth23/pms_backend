import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { SyncResponse } from './types/sync.types';

@ApiTags('sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('users')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Synchronize users from source database' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User synchronization finished',
  })
  async syncUsers(): Promise<SyncResponse> {
    return this.syncService.syncUsers();
  }
}
