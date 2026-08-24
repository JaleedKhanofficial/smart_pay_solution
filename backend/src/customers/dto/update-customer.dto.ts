import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional } from 'class-validator';
import {
  CUSTOMER_UPLOAD_FIELDS,
  type CustomerUploadField,
} from '../customer-uploads.fields';
import { CreateCustomerDto } from './create-customer.dto';

/**
 * A multipart body repeats the key rather than sending an array, so one removal
 * arrives as a string and several as a string[]. Both are normalised here.
 */
const toFieldArray = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === '') return undefined;

  return Array.isArray(value) ? value : [value];
};

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  /**
   * FR-CUS-07 covers keeping and replacing an image; this covers taking one
   * away. An omitted image still means "keep", so deleting has to be asked for
   * explicitly — otherwise every edit that skipped the picker would wipe the
   * scans.
   */
  @ApiPropertyOptional({
    enum: CUSTOMER_UPLOAD_FIELDS,
    isArray: true,
    description: 'Image fields to clear, e.g. customer_cnic_back',
  })
  @Transform(toFieldArray)
  @IsOptional()
  @IsArray()
  @IsIn(CUSTOMER_UPLOAD_FIELDS, { each: true })
  remove_images?: CustomerUploadField[];
}
