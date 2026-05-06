import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductosModule } from './producto/producto.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      username: process.env.DB_USER?.trim() || process.env.DB_USERNAME?.trim() || 'root',
      password:
        process.env.DB_PASS?.trim() || process.env.DB_PASSWORD?.trim() || '',
      database: process.env.DB_NAME || 'erp',
      synchronize: true,
      autoLoadEntities: true,
    }),
    ProductosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
