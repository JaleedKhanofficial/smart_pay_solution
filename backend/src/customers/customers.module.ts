import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract, Customer, Guarantor } from '../database/entities';
import { CustomerUploadsService } from './customer-uploads.service';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  // Guarantor is registered so the module owns its own repository metadata even
  // though the service reaches it through the transaction manager.
  imports: [TypeOrmModule.forFeature([Customer, Guarantor, Contract])],
  controllers: [CustomersController],
  providers: [CustomersService, CustomerUploadsService],
})
export class CustomersModule {}
