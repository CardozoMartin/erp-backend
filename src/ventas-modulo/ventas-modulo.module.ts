import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VentasModuloService } from './ventas-modulo.service';
import { VentasModuloController } from './ventas-modulo.controller';
import { Producto } from '../producto/entities/producto.entity';
import { VentasModulo } from './entities/ventas-modulo.entity';
import { VentaItem } from './entities/venta-item.entity';
import { VentaPago } from './entities/venta-pago.entity';
import { VentaHistorial } from './entities/venta-historial.entity';
import { Stock } from '../stock/entities/stock.entity';
import { Variante } from '../variante/entities/variante.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Producto,
      VentasModulo,
      VentaItem,
      VentaPago,
      VentaHistorial,
      Stock,
      Variante,
    ]),
  ],
  controllers: [VentasModuloController],
  providers: [VentasModuloService],
})
export class VentasModuloModule {}
