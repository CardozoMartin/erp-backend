import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Caja } from 'src/caja/entities/caja.entity';
import { MovimientoCaja } from 'src/caja/entities/movimiento-caja.entity';
import { ComprobanteItem } from 'src/comprobantes/entities/comprobante-item.entity';
import { Comprobante } from 'src/comprobantes/entities/comprobante.entity';
import { Empleado } from 'src/empleados/entities/empleado.entity';
import { PagoPos } from 'src/pagos-pos/entities/pago-pos.entity';
import { Producto } from 'src/producto/entities/producto.entity';
import { StockMovimiento } from 'src/stock-movimientos/entities/stock-movimiento.entity';
import { ReportesPosController } from './reportes-pos.controller';
import { ReportesPosService } from './reportes-pos.service';

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
    ]),
  ],
  controllers: [ReportesPosController],
  providers: [ReportesPosService],
  exports: [ReportesPosService],
})
export class ReportesPosModule {}
