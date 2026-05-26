import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SucursalService } from 'src/sucursal/sucursal.service';
import { Repository } from 'typeorm';
import { EmpleadoSucursal } from './entities/empleado-sucursal.entity';
import { Empleado } from './entities/empleado.entity';

@Injectable()
export class EmpleadoSucursalesService {
  constructor(
    @InjectRepository(EmpleadoSucursal)
    private readonly empleadoSucursalRepo: Repository<EmpleadoSucursal>,
    private readonly sucursalService: SucursalService,
  ) {}

  //servicio para asignar una sucursal al empleado
  async asignar(
    empleadoId: string,
    sucursalId: string,
    esPrincipal: boolean = false,
  ): Promise<EmpleadoSucursal> {
    const empleado = await this.empleadoSucursalRepo.manager.findOne(Empleado, {
      where: { id: empleadoId },
    });
    if (!empleado) {
      throw new NotFoundException(`Empleado ${empleadoId} no encontrado`);
    }

    // Verificar que la sucursal existe
    const sucursal = await this.sucursalService.findOne(sucursalId);
    // Verificar que no esté ya asignado
    const yaExiste = await this.empleadoSucursalRepo.findOne({
      where: {
        empleado: { id: empleado.id },
        sucursal: { id: sucursalId },
      },
    });
    if (yaExiste) {
      throw new ConflictException(
        `El empleado ya está asignado a la sucursal ${sucursal.nombre}`,
      );
    }
    // Si es principal, quitamos el flag de la anterior principal
    if (esPrincipal) {
      await this.empleadoSucursalRepo.update(
        { empleado: { id: empleado.id }, esSucursalPrincipal: true },
        { esSucursalPrincipal: false },
      );
    }

    const asignacion = this.empleadoSucursalRepo.create({
      empleado,
      sucursal,
      esSucursalPrincipal: esPrincipal,
      activo: true,
    });

    return this.empleadoSucursalRepo.save(asignacion);
  }
  // Obtener todas las sucursales de un empleado
  async findByEmpleado(empleadoId: string): Promise<EmpleadoSucursal[]> {
    return this.empleadoSucursalRepo.find({
      where: { empleado: { id: empleadoId }, activo: true },
      relations: ['sucursal'],
    });
  }

  // Desactivar asignación (no borrar)
  async desasignar(empleadoId: string, sucursalId: string): Promise<void> {
    const asignacion = await this.empleadoSucursalRepo.findOne({
      where: {
        empleado: { id: empleadoId },
        sucursal: { id: sucursalId },
      },
    });
    if (!asignacion) {
      throw new NotFoundException(
        `El empleado no está asignado a esa sucursal`,
      );
    }
    asignacion.activo = false;
    await this.empleadoSucursalRepo.save(asignacion);
  }
  // Cambiar sucursal principal
  async setPrincipal(
    empleadoId: string,
    sucursalId: string,
  ): Promise<EmpleadoSucursal> {
    // Quitar principal anterior
    await this.empleadoSucursalRepo.update(
      { empleado: { id: empleadoId }, esSucursalPrincipal: true },
      { esSucursalPrincipal: false },
    );

    // Setear nueva principal
    const asignacion = await this.empleadoSucursalRepo.findOne({
      where: {
        empleado: { id: empleadoId },
        sucursal: { id: sucursalId },
      },
      relations: ['sucursal'],
    });
    if (!asignacion) {
      throw new NotFoundException(
        `El empleado no está asignado a esa sucursal`,
      );
    }

    asignacion.esSucursalPrincipal = true;
    return this.empleadoSucursalRepo.save(asignacion);
  }
}
