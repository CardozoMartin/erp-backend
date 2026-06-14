import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CajaModule } from 'src/caja/caja.module';
import { ComprobantesModule } from 'src/comprobantes/comprobantes.module';
import { ConfiguracionModule } from 'src/configuracion/configuracion.module';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';
import { Empleado } from 'src/empleados/entities/empleado.entity';
import { FacturacionModule } from 'src/facturacion/facturacion.module';
import { ListaPrecioModule } from 'src/lista-precio/lista-precio.module';
import { NotasCreditoModule } from 'src/notas-credito/notas-credito.module';
import { PagosPosModule } from 'src/pagos-pos/pagos-pos.module';
import { Producto } from 'src/producto/entities/producto.entity';
import { PosVentasController } from './pos-ventas.controller';
import { PosVentasService } from './pos-ventas.service';
import { PosVentasQueryService } from './pos-ventas-query.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Empleado, Producto]),
    CajaModule,
    ComprobantesModule,
    PagosPosModule,
    ListaPrecioModule,
    FacturacionModule,
    ConfiguracionModule,
    NotasCreditoModule,
    AuditoriaModule,
  ],
  controllers: [PosVentasController],
  providers: [PosVentasService, PosVentasQueryService],
  exports: [PosVentasService, PosVentasQueryService],
})
export class PosVentasModule {}
