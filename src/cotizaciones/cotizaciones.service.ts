import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Comprobante,
  EstadoComprobante,
  TipoComprobante,
} from 'src/comprobantes/entities/comprobante.entity';
import { ComprobantesService } from 'src/comprobantes/comprobantes.service';
import { CreateComprobanteDto } from 'src/comprobantes/dto/create-comprobante.dto';
import {
  CambiarEstadoCotizacionDto,
  ConvertirCotizacionDto,
  CreateCotizacionDto,
} from './dto/cotizacion.dto';

@Injectable()
export class CotizacionesService {
  constructor(private readonly comprobantesService: ComprobantesService) {}

  async create(
    sucursalId: string,
    empleadoId: string,
    dto: CreateCotizacionDto,
  ): Promise<Comprobante> {
    // 1. Cotizacion siempre usa el tipo COTIZACION, aunque el frontend mande otro valor.
    return this.comprobantesService.create(sucursalId, empleadoId, {
      ...dto,
      tipo: TipoComprobante.COTIZACION,
      estado: EstadoComprobante.BORRADOR,
    });
  }

  async findAll(sucursalId: string): Promise<Comprobante[]> {
    return this.comprobantesService.findAll(sucursalId, TipoComprobante.COTIZACION);
  }

  async findOne(id: string, sucursalId: string): Promise<Comprobante> {
    const cotizacion = await this.comprobantesService.findOne(id, sucursalId);
    this.validarTipoCotizacion(cotizacion);
    return cotizacion;
  }

  async enviar(
    id: string,
    sucursalId: string,
    dto: CambiarEstadoCotizacionDto,
  ): Promise<Comprobante> {
    // 1. Enviar deja la cotizacion visible como propuesta formal al cliente.
    const cotizacion = await this.findOne(id, sucursalId);
    this.validarNoVencida(cotizacion);
    this.validarEstado(cotizacion, [EstadoComprobante.BORRADOR]);
    return this.comprobantesService.cambiarEstado(id, sucursalId, {
      estado: EstadoComprobante.ENVIADO,
      observaciones: dto.observaciones,
    });
  }

  async aceptar(
    id: string,
    sucursalId: string,
    dto: CambiarEstadoCotizacionDto,
  ): Promise<Comprobante> {
    // 1. Aceptar no mueve stock ni caja; solo marca que el cliente dio el ok.
    const cotizacion = await this.findOne(id, sucursalId);
    this.validarNoVencida(cotizacion);
    this.validarEstado(cotizacion, [
      EstadoComprobante.BORRADOR,
      EstadoComprobante.ENVIADO,
    ]);
    return this.comprobantesService.cambiarEstado(id, sucursalId, {
      estado: EstadoComprobante.ACEPTADO,
      observaciones: dto.observaciones,
    });
  }

  async rechazar(
    id: string,
    sucursalId: string,
    dto: CambiarEstadoCotizacionDto,
  ): Promise<Comprobante> {
    // 1. Rechazada queda cerrada y no se puede convertir a venta.
    const cotizacion = await this.findOne(id, sucursalId);
    this.validarEstado(cotizacion, [
      EstadoComprobante.BORRADOR,
      EstadoComprobante.ENVIADO,
    ]);
    return this.comprobantesService.cambiarEstado(id, sucursalId, {
      estado: EstadoComprobante.RECHAZADO,
      observaciones: dto.observaciones,
    });
  }

  async convertirEnVenta(
    id: string,
    sucursalId: string,
    empleadoId: string,
    dto: ConvertirCotizacionDto,
  ): Promise<Comprobante> {
    const cotizacion = await this.findOne(id, sucursalId);
    this.validarNoVencida(cotizacion);
    this.validarEstado(cotizacion, [EstadoComprobante.ACEPTADO]);

    // 1. Reusamos los items congelados de la cotizacion para crear una venta nueva.
    const ventaDto: CreateComprobanteDto = {
      tipo: TipoComprobante.VENTA,
      estado: EstadoComprobante.PENDIENTE_COBRO,
      cliente_id: cotizacion.cliente_id,
      empleado_vendedor_id: cotizacion.empleado_vendedor_id ?? empleadoId,
      comprobante_origen_id: cotizacion.id,
      lista_precio_id: cotizacion.lista_precio_id,
      descuento_global_porcentaje: Number(
        cotizacion.descuento_global_porcentaje ?? 0,
      ),
      descuento_global_monto: Number(cotizacion.descuento_global_monto ?? 0),
      recargo_total: Number(cotizacion.recargo_total ?? 0),
      observaciones:
        dto.observaciones ?? `Venta generada desde cotizacion ${cotizacion.numero}`,
      items: cotizacion.items.map((item) => ({
        producto_id: item.producto_id,
        variante_id: item.variante_id,
        descripcion: item.descripcion,
        cantidad: Number(item.cantidad),
        precio_unitario: Number(item.precio_unitario),
        descuento_porcentaje: Number(item.descuento_porcentaje ?? 0),
        descuento_monto: Number(item.descuento_monto ?? 0),
        recargo_monto: Number(item.recargo_monto ?? 0),
      })),
    };

    const venta = await this.comprobantesService.create(sucursalId, empleadoId, ventaDto);

    // 2. Dejamos asentado que la cotizacion ya fue aceptada y convertida.
    await this.comprobantesService.cambiarEstado(id, sucursalId, {
      estado: EstadoComprobante.ACEPTADO,
      observaciones: dto.observaciones ?? cotizacion.observaciones,
    });

    return venta;
  }

  async vencerExpiradas(
    sucursalId: string,
  ): Promise<{ actualizadas: number; cotizaciones: Comprobante[] }> {
    // 1. Este endpoint permite marcar vencidas las cotizaciones expiradas de la sucursal.
    const cotizaciones = await this.findAll(sucursalId);
    const ahora = new Date();
    const vencidas = cotizaciones.filter(
      (cotizacion) =>
        [EstadoComprobante.BORRADOR, EstadoComprobante.ENVIADO].includes(
          cotizacion.estado,
        ) &&
        cotizacion.fecha_vencimiento &&
        cotizacion.fecha_vencimiento.getTime() < ahora.getTime(),
    );

    const actualizadas: Comprobante[] = [];
    for (const cotizacion of vencidas) {
      actualizadas.push(
        await this.comprobantesService.cambiarEstado(cotizacion.id, sucursalId, {
          estado: EstadoComprobante.VENCIDO,
          observaciones: cotizacion.observaciones,
        }),
      );
    }

    return { actualizadas: actualizadas.length, cotizaciones: actualizadas };
  }

  private validarTipoCotizacion(comprobante: Comprobante): void {
    if (comprobante.tipo !== TipoComprobante.COTIZACION) {
      throw new BadRequestException('El comprobante no es una cotizacion');
    }
  }

  private validarEstado(
    cotizacion: Comprobante,
    estadosValidos: EstadoComprobante[],
  ): void {
    if (!estadosValidos.includes(cotizacion.estado)) {
      throw new BadRequestException(
        `La cotizacion no puede cambiar desde estado ${cotizacion.estado}`,
      );
    }
  }

  private validarNoVencida(cotizacion: Comprobante): void {
    if (
      cotizacion.estado === EstadoComprobante.VENCIDO ||
      (cotizacion.fecha_vencimiento &&
        cotizacion.fecha_vencimiento.getTime() < new Date().getTime())
    ) {
      throw new BadRequestException('La cotizacion esta vencida');
    }
  }
}
