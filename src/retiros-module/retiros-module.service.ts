import { Injectable } from '@nestjs/common';
import { CreateRetirosModuleDto } from './dto/create-retiros-module.dto';
import { UpdateRetirosModuleDto } from './dto/update-retiros-module.dto';

@Injectable()
export class RetirosModuleService {
  create(createRetirosModuleDto: CreateRetirosModuleDto) {
    return 'This action adds a new retirosModule';
  }

  findAll() {
    return `This action returns all retirosModule`;
  }

  findOne(id: number) {
    return `This action returns a #${id} retirosModule`;
  }

  update(id: number, updateRetirosModuleDto: UpdateRetirosModuleDto) {
    return `This action updates a #${id} retirosModule`;
  }

  remove(id: number) {
    return `This action removes a #${id} retirosModule`;
  }
}
