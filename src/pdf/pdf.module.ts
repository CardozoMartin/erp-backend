import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comprobante } from 'src/comprobantes/entities/comprobante.entity';
import { ConfiguracionSucursal } from 'src/configuracion/entities/configuracion.entity';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { PdfService } from './pdf.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comprobante, ConfiguracionSucursal, Cliente]),
  ],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
