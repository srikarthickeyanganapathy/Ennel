import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { GetSignedFileService } from '../services/get-signed-file.service';

/** Serves files behind signed URLs; the signature is the authorization. */
@ApiExcludeController()
@Controller('files')
export class FilesController {
  constructor(private readonly getSignedFile: GetSignedFileService) {}

  @Get('*key')
  async download(
    @Param('key') keyParam: string | string[],
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const key = Array.isArray(keyParam) ? keyParam.join('/') : keyParam;
    const file = await this.getSignedFile.execute(key, Number(exp), sig ?? '');
    response
      .setHeader('Content-Type', file.contentType)
      .setHeader('Cache-Control', 'private, max-age=300')
      .setHeader('X-Content-Type-Options', 'nosniff')
      .send(file.data);
  }
}
