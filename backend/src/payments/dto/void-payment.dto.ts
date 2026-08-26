import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trim } from '../../common/normalise';

/**
 * FR-PAY-08-v2. A payment is never erased — it is voided, and a void has to say
 * why. The reason is not optional the way a note is: this is the record of a
 * correction to the money, and "deleted by someone, some time" is not a record.
 */
export class VoidPaymentDto {
  @ApiProperty({ maxLength: 500, example: 'Cheque returned unpaid' })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Say why this payment is being voided' })
  @MaxLength(500)
  void_reason: string;
}
