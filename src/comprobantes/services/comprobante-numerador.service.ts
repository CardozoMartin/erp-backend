import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfiguracionService } from 'src/configuracion/configuracion.service';
import {
  TipoComprobante,
} from '../entities/comprobante.entity';
import { NumeradorComprobante } from '../entities/numerador-comprobante.entity';

@Injectable()
export class ComprobanteNumeradorService {
  constructor(
    @InjectRepository(NumeradorComprobante)
    private readonly numeradorRepo: Repository<NumeradorComprobante>,
    private readonly configuracionService: ConfiguracionService,
  ) {}

  async verNumeradores(sucursalId: string): Promise<NumeradorComprobante[]> {
    return this.numeradorRepo.find({
      where: { sucursal_id: sucursalId },
      order: { tipo: 'ASC' },
    });
  }

  async generarNumero(
    sucursalId: string,
    tipo: TipoComprobante,
    repo: Repository<NumeradorComprobante>,
    /** Número autorizado por AFIP; cuando viene, manda sobre el contador local */
    numeroAfip?: number | null,
  ): Promise<{ numero: string; secuencial: number; prefijo: string }> {
    let numerador = await repo.findOne({
      where: { sucursal_id: sucursalId, tipo },
      lock: { mode: 'pessimistic_write' },
    });

    if (!numerador) {
      numerador = repo.create({
        sucursal_id: sucursalId,
        tipo,
        ultimo_numero: 0,
        prefijo: await this.prefijoPorTipo(sucursalId, tipo),
        longitud: 6,
      });
    }

    // La numeración fiscal la define AFIP. Si el contador local quedó atrás (o
    // adelante) se lo alinea, para que el número impreso sea el autorizado.
    numerador.ultimo_numero = numeroAfip
      ? Number(numeroAfip)
      : Number(numerador.ultimo_numero) + 1;
    await repo.save(numerador);

    return {
      secuencial: numerador.ultimo_numero,
      numero: this.formatearNumero(tipo, numerador),
      prefijo: numerador.prefijo,
    };
  }

  private async prefijoPorTipo(sucursalId: string, tipo: TipoComprobante): Promise<string> {
    const config = await this.configuracionService.crearPorDefecto(sucursalId);

    if (tipo === TipoComprobante.COTIZACION) return config.prefijo_cotizacion;
    if (tipo === TipoComprobante.TICKET) return config.prefijo_ticket;
    if (tipo === TipoComprobante.REMITO) return config.prefijo_remito;
    if (tipo === TipoComprobante.NOTA_CREDITO) return config.prefijo_nota_credito;
    if (
      tipo === TipoComprobante.FACTURA_A ||
      tipo === TipoComprobante.FACTURA_B ||
      tipo === TipoComprobante.FACTURA_C
    ) {
      return config.punto_venta_arca ?? '0001';
    }

    return 'VTA';
  }

  formatearNumero(tipo: TipoComprobante, numerador: NumeradorComprobante): string {
    const correlativo = String(numerador.ultimo_numero).padStart(numerador.longitud, '0');

    if (tipo === TipoComprobante.FACTURA_A) return `A${numerador.prefijo}-${correlativo}`;
    if (tipo === TipoComprobante.FACTURA_B) return `B${numerador.prefijo}-${correlativo}`;
    if (tipo === TipoComprobante.FACTURA_C) return `C${numerador.prefijo}-${correlativo}`;

    return `${numerador.prefijo}-${correlativo}`;
  }
}
