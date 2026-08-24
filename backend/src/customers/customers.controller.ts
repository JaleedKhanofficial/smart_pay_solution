import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Paginated } from '../common/pagination';
import { MAX_UPLOAD_BYTES } from '../files/files.service';
import { CUSTOMER_UPLOAD_FIELDS } from './customer-uploads.fields';
import type { CustomerUploads } from './customer-uploads.service';
import type { CustomerResponse } from './customer.mapper';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

// Derived, not restated: an image field added to CUSTOMER_UPLOAD_FIELDS is
// accepted here and narrowed below without either list being edited.
const UPLOAD_FIELDS = CUSTOMER_UPLOAD_FIELDS.map((name) => ({
  name,
  maxCount: 1,
}));

const UPLOAD_OPTIONS = {
  limits: { fileSize: MAX_UPLOAD_BYTES, files: UPLOAD_FIELDS.length },
};

type UploadedFieldMap = Record<string, Express.Multer.File[] | undefined>;

/**
 * Multer hands back a map of field name to file array; this narrows it to the
 * single file each field allows. Built from the same list the interceptor uses,
 * so a field cannot be accepted and then silently dropped here.
 */
function toUploads(files: UploadedFieldMap | undefined): CustomerUploads {
  const uploads: CustomerUploads = {};

  for (const field of CUSTOMER_UPLOAD_FIELDS) {
    uploads[field] = files?.[field]?.[0];
  }

  return uploads;
}

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create a customer with two guarantors (FR-CUS-02, FR-CUS-03-v2)',
  })
  @UseInterceptors(FileFieldsInterceptor(UPLOAD_FIELDS, UPLOAD_OPTIONS))
  create(
    @Body() body: CreateCustomerDto,
    @UploadedFiles() files: UploadedFieldMap,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<CustomerResponse> {
    return this.customers.create(body, toUploads(files), user, req.ip);
  }

  @Get()
  @ApiOperation({ summary: 'List customers (FR-CUS-01)' })
  findAll(
    @Query() query: ListCustomersDto,
  ): Promise<Paginated<CustomerResponse>> {
    return this.customers.findAll(query);
  }

  /** Distinct occupations for the filter dropdown. Declared before ':id' so
   *  the literal path is matched first. */
  @Get('occupations')
  @ApiOperation({ summary: 'Occupations present in the register' })
  occupations(): Promise<string[]> {
    return this.customers.occupations();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<CustomerResponse> {
    return this.customers.findOne(id);
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update a customer (FR-CUS-07)' })
  @UseInterceptors(FileFieldsInterceptor(UPLOAD_FIELDS, UPLOAD_OPTIONS))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
    @UploadedFiles() files: UploadedFieldMap,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<CustomerResponse> {
    return this.customers.update(id, dto, toUploads(files), user, req.ip);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a customer (FR-CUS-09-v2)' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    return this.customers.remove(id, user, req.ip);
  }
}
