import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, QueryFailedError, Repository } from 'typeorm';
import { Customer } from './customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

// Postgres unique_violation
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
  ) {}

  async create(dto: CreateCustomerDto): Promise<Customer> {
    const customer = this.customersRepository.create(dto);

    try {
      return await this.customersRepository.save(customer);
    } catch (error) {
      throw this.translateError(error, dto.cnic);
    }
  }

  findAll(): Promise<Customer[]> {
    return this.customersRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customersRepository.findOneBy({ id });

    if (!customer) {
      throw new NotFoundException(`Customer with id "${id}" was not found`);
    }

    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);

    // Checked up front so a duplicate CNIC reads as a clear 409 rather than
    // depending on the driver error; the constraint below is still the guard.
    if (dto.cnic && dto.cnic !== customer.cnic) {
      const clash = await this.customersRepository.findOneBy({
        cnic: dto.cnic,
        id: Not(id),
      });

      if (clash) {
        throw new ConflictException(
          `A customer with CNIC "${dto.cnic}" already exists`,
        );
      }
    }

    Object.assign(customer, dto);

    try {
      return await this.customersRepository.save(customer);
    } catch (error) {
      throw this.translateError(error, dto.cnic ?? customer.cnic);
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.customersRepository.delete(id);

    if (!result.affected) {
      throw new NotFoundException(`Customer with id "${id}" was not found`);
    }
  }

  private translateError(error: unknown, cnic: string): unknown {
    const driverError: { code?: string } | undefined =
      error instanceof QueryFailedError
        ? (error.driverError as { code?: string })
        : undefined;

    if (driverError?.code === UNIQUE_VIOLATION) {
      return new ConflictException(
        `A customer with CNIC "${cnic}" already exists`,
      );
    }

    return error;
  }
}
