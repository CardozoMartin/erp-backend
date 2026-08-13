import { Injectable } from '@nestjs/common';
import { ReportePosQueryDto } from './dto/reporte-pos-query.dto';
import { ReportesVentasService } from './reportes-ventas.service';
import { ReportesCajaService } from './reportes-caja.service';
import { ReportesClientesService } from './reportes-clientes.service';
import { ReportesStockService } from './reportes-stock.service';
import { calcularPeriodo } from './reportes-pos.helpers';

@Injectable()
export class ReportesPosService {
  constructor(
    private readonly ventasService: ReportesVentasService,
    private readonly cajaService: ReportesCajaService,
    private readonly clientesService: ReportesClientesService,
    private readonly stockService: ReportesStockService,
  ) {}

  async resumen(sucursalId: string, query: ReportePosQueryDto) {
    const [resumenVentas, stockSalidas] = await Promise.all([
      this.ventasService.resumen(sucursalId, query),
      this.stockService.salidasPorCaja(sucursalId, query),
    ]);

    return {
      ...resumenVentas,
      periodo: calcularPeriodo(query),
      stock: {
        unidades_salidas: Number(stockSalidas?.cantidad ?? 0),
      },
    };
  }

  ventasPorDia(sucursalId: string, query: ReportePosQueryDto) {
    return this.ventasService.ventasPorDia(sucursalId, query);
  }

  mediosPago(sucursalId: string, query: ReportePosQueryDto) {
    return this.ventasService.mediosPago(sucursalId, query);
  }

  productos(sucursalId: string, query: ReportePosQueryDto) {
    return this.ventasService.productos(sucursalId, query);
  }

  empleados(sucursalId: string, query: ReportePosQueryDto) {
    return this.ventasService.empleados(sucursalId, query);
  }

  notasCredito(sucursalId: string, query: ReportePosQueryDto) {
    return this.ventasService.notasCredito(sucursalId, query);
  }

  cajas(sucursalId: string, query: ReportePosQueryDto) {
    return this.cajaService.cajas(sucursalId, query);
  }

  diferenciasCaja(sucursalId: string, query: ReportePosQueryDto) {
    return this.cajaService.diferenciasCaja(sucursalId, query);
  }

  cobrosPendientes(sucursalId: string, query: ReportePosQueryDto) {
    return this.clientesService.cobrosPendientes(sucursalId, query);
  }

  stock(sucursalId: string, query: ReportePosQueryDto) {
    return this.stockService.stock(sucursalId, query);
  }
}
