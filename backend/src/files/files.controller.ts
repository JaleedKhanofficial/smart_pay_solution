import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { FilesService } from './files.service';

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  /**
   * FR-CUS-05-v2: the only way to read an upload. The global JWT guard means an
   * unauthenticated request gets 401 rather than the image.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Stream an uploaded file (FR-CUS-05-v2)' })
  async serve(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ): Promise<void> {
    const record = await this.files.findById(id);

    if (!record) {
      throw new NotFoundException('File not found');
    }

    try {
      await access(record.storage_path);
    } catch {
      throw new NotFoundException('File is no longer on disk');
    }

    res.setHeader('Content-Type', record.mime);
    res.setHeader('Content-Length', record.size_bytes);
    // Stored names carry spaces and non-ASCII, so the RFC 5987 form is the one
    // that survives; the quoted fallback is stripped down for old clients.
    const asciiName = record.stored_name.replace(/[^\x20-\x7E]/g, '_');

    res.setHeader(
      'Content-Disposition',
      `inline; filename="${asciiName.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(
        record.stored_name,
      )}`,
    );
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    createReadStream(record.storage_path).pipe(res);
  }
}
