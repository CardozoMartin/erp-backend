import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comprobante } from 'src/comprobantes/entities/comprobante.entity';
import { ConfiguracionSucursal } from 'src/configuracion/entities/configuracion.entity';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Empleado } from 'src/empleados/entities/empleado.entity';
import { PdfService } from './pdf.service';
import { QrAfipService } from './qr-afip.service';
import { ConfiguracionModule } from 'src/configuracion/configuracion.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comprobante, ConfiguracionSucursal, Cliente, Empleado]),
    ConfiguracionModule,
  ],
  providers: [PdfService, QrAfipService],
  exports: [PdfService, QrAfipService],
})
export class PdfModule {}
