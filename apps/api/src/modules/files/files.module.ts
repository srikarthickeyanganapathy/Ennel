import { Module } from '@nestjs/common';
import { FilesController } from './controllers/files.controller';
import { GetSignedFileService } from './services/get-signed-file.service';

@Module({
  controllers: [FilesController],
  providers: [GetSignedFileService],
})
export class FilesModule {}
