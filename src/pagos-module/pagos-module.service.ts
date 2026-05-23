import { Injectable } from '@nestjs/common';
import { CreatePagosModuleDto } from './dto/create-pagos-module.dto';
import { UpdatePagosModuleDto } from './dto/update-pagos-module.dto';

@Injectable()
export class PagosModuleService {
  create(createPagosModuleDto: CreatePagosModuleDto) {
    return 'This action adds a new pagosModule';
  }

  findAll() {
    return `This action returns all pagosModule`;
  }

  findOne(id: number) {
    return `This action returns a #${id} pagosModule`;
  }

  update(id: number, updatePagosModuleDto: UpdatePagosModuleDto) {
    return `This action updates a #${id} pagosModule`;
  }

  remove(id: number) {
    return `This action removes a #${id} pagosModule`;
  }
}
