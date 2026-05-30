import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

export const SucursalActiva = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const sucursalId = request.user?.sucursalId;

    if (!sucursalId) {
      throw new BadRequestException(
        'Debes seleccionar una sucursal antes de continuar',
      );
    }

    return sucursalId;
  },
);

export const SucursalesActivas = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string[] => {
    const request = ctx.switchToHttp().getRequest();
    const sucursalId = request.user?.sucursalId;

    if (!sucursalId) {
      throw new BadRequestException(
        'Debes seleccionar una sucursal antes de continuar',
      );
    }

    return [sucursalId];
  },
);
