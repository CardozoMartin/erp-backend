import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Caja } from 'src/caja/entities/caja.entity';
import { MovimientoCaja } from 'src/caja/entities/movimiento-caja.entity';
import { ComprobanteItem } from 'src/comprobantes/entities/comprobante-item.entity';
import { Comprobante } from 'src/comprobantes/entities/comprobante.entity';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { CuentaCorriente } from 'src/clientes/entities/cuenta-corriente.entity';
import { MovimientoCuentaCorriente } from 'src/clientes/entities/movimiento-cuenta-corriente.entity';
import { Empleado } from 'src/empleados/entities/empleado.entity';
import { PagoPos } from 'src/pagos-pos/entities/pago-pos.entity';
import { Producto } from 'src/producto/entities/producto.entity';
import { StockMovimiento } from 'src/stock-movimientos/entities/stock-movimiento.entity';
import { ExcelModule } from 'src/excel/excel.module';
import { ReportesPosController } from './reportes-pos.controller';
import { ReportesPosService } from './reportes-pos.service';
import { ReportesVentasService } from './reportes-ventas.service';
import { ReportesCajaService } from './reportes-caja.service';
import { ReportesClientesService } from './reportes-clientes.service';
import { ReportesStockService } from './reportes-stock.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Comprobante,
      ComprobanteItem,
      PagoPos,
      Producto,
      Empleado,
      Caja,
      MovimientoCaja,
      StockMovimiento,
      Cliente,
      CuentaCorriente,
      MovimientoCuentaCorriente,
    ]),
    ExcelModule,
  ],
  controllers: [ReportesPosController],
  providers: [
    ReportesPosService,
    ReportesVentasService,
    ReportesCajaService,
    ReportesClientesService,
    ReportesStockService,
  ],
  exports: [ReportesPosService],
})
export class ReportesPosModule {}
