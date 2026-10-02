import { PartialType } from '@nestjs/swagger';
import { CreateOrgTeamDto } from './create-org-team.dto';

export class UpdateOrgTeamDto extends PartialType(CreateOrgTeamDto) {}
