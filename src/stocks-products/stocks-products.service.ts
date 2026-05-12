import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AjustarStockDto, CreateStocksProductDto } from './dto/create-stocks-product.dto';
import { UpdateStocksProductDto } from './dto/update-stocks-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { StocksProduct } from './entities/stocks-product.entity';
import { IsNull, Repository } from 'typeorm';

@Injectable()
export class StocksProductsService {

  constructor(
    @InjectRepository(StocksProduct)
    private stocksProductRepository: Repository<StocksProduct>,
){}

  async create(createStocksProductDto: CreateStocksProductDto) {
    const productoExiste = await this.stocksProductRepository.findOne({
      where: {
        producto_id: createStocksProductDto.producto_id,
        variante_id: createStocksProductDto.variante_id ?? IsNull(),
        sucursal_id: createStocksProductDto.sucursal_id
      }
    });

    // verificamos que no exista un stock para el mismo producto, variante y sucursal
    if(productoExiste){
      throw new Error('Ya existe un stock para este producto, variante y sucursal');
    }

    // si no existe, creamos el nuevo stock
    const nuevoStock = this.stocksProductRepository.create({
      producto_id: createStocksProductDto.producto_id,
      variante_id: createStocksProductDto.variante_id ?? null,
      sucursal_id: createStocksProductDto.sucursal_id,
      cantidad: createStocksProductDto.cantidad,
      cantidad_minima: createStocksProductDto.cantidad_minima
    });
    return this.stocksProductRepository.save(nuevoStock);
  }

  async findAll(): Promise<StocksProduct[]> {
    const stocks = await this.stocksProductRepository.find();
    if(stocks.length === 0){
      throw new Error('No se encontraron stocks de productos');
    }
    return stocks;
  }

 async findByProducto(producto_id: string): Promise<StocksProduct[]> {
    return this.stocksProductRepository.find({
      where: { producto_id },
      relations: ['variante'],
    });
  }
async findBySucursal(sucursal_id: string): Promise<StocksProduct[]> {
    return this.stocksProductRepository.find({
      where: { sucursal_id },
      relations: ['producto', 'variante'],
    });
  }

  async findOneOrFail(id: string): Promise<StocksProduct> {
    const stock = await this.stocksProductRepository.findOne({
      where: { id },
      relations: ['producto', 'variante'],
    });
    if (!stock) throw new NotFoundException(`Stock ${id} no encontrado`);
    return stock;
  }
  async update(id: string, dto: UpdateStocksProductDto): Promise<StocksProduct> {
    const stock = await this.findOneOrFail(id);
    Object.assign(stock, dto);
    return this.stocksProductRepository.save(stock);
  }

  // Suma o resta del stock actual (para movimientos de ventas/compras)
  async ajustar(id: string, dto: AjustarStockDto): Promise<StocksProduct> {
    const stock = await this.findOneOrFail(id);
    const nuevaCantidad = Number(stock.cantidad) + dto.cantidad;
    if (nuevaCantidad < 0) throw new BadRequestException('El stock no puede quedar negativo');
    stock.cantidad = nuevaCantidad;
    return this.stocksProductRepository.save(stock);
  }

  async remove(id: string): Promise<void> {
    const stock = await this.findOneOrFail(id);
    await this.stocksProductRepository.remove(stock);
  }
}
