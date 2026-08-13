import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguracionModule } from 'src/configuracion/configuracion.module';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';
import { ListaPrecioModule } from 'src/lista-precio/lista-precio.module';
import { PdfModule } from 'src/pdf/pdf.module';
import { OfertaModule } from 'src/oferta/oferta.module';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { ProductoSucursal } from 'src/producto/entities/producto-sucursal-entity';
import { Producto } from 'src/producto/entities/producto.entity';
import { Stock } from 'src/stock/entities/stock.entity';
import { Lote } from 'src/lote/entities/lote.entity';
import { ConfiguracionSucursal } from 'src/configuracion/entities/configuracion.entity';
import { ComprobantesController } from './comprobantes.controller';
import { ComprobantesService } from './comprobantes.service';
import { ComprobanteItem } from './entities/comprobante-item.entity';
import { Comprobante } from './entities/comprobante.entity';
import { NumeradorComprobante } from './entities/numerador-comprobante.entity';
import { ComprobanteNumeradorService } from './services/comprobante-numerador.service';
import { ComprobanteItemsService } from './services/comprobante-items.service';
import { ComprobanteEmailService } from './services/comprobante-email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Comprobante,
      ComprobanteItem,
      NumeradorComprobante,
      Producto,
      Stock,
      Lote,
      ProductoSucursal,
      Cliente,
      ConfiguracionSucursal,
    ]),
    AuditoriaModule,
    ConfiguracionModule,
    ListaPrecioModule,
    PdfModule,
    OfertaModule,
  ],
  controllers: [ComprobantesController],
  providers: [
    ComprobantesService,
    ComprobanteNumeradorService,
    ComprobanteItemsService,
    ComprobanteEmailService,
  ],
  exports: [ComprobantesService, TypeOrmModule],
})
export class ComprobantesModule {}
