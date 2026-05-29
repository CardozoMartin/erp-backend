// ventas/ventas.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VentasModulo } from './entities/ventas-modulo.entity';
import { VentaItem } from './entities/venta-item.entity';
import { VentaPago } from './entities/venta-pago.entity';
import { VentaHistorial } from './entities/venta-historial.entity';

import { ConfigPosModule } from 'src/config-pos/config-pos.module';
import { PagosModule } from 'src/pagos-module/pagos-module.module';
import { VentasController } from './ventas-modulo.controller';
import { VentasService } from './ventas-modulo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VentasModulo,
      VentaItem,
      VentaPago,
      VentaHistorial,
    ]),
    ConfigPosModule, // ← para leer config de la sucursal
    PagosModule, // ← para validar medios de pago
  ],
  controllers: [VentasController],
  providers: [VentasService],
  exports: [VentasService],
})
export class VentasModuloModule {}
