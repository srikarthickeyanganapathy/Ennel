import { Global, Module } from '@nestjs/common';
import { FileStorageProvider } from './file-storage.provider';
import { FileUrlSigner } from './file-url-signer';
import { LocalFileStorageProvider } from './local-file-storage.provider';

@Global()
@Module({
  providers: [{ provide: FileStorageProvider, useClass: LocalFileStorageProvider }, FileUrlSigner],
  exports: [FileStorageProvider, FileUrlSigner],
})
export class StorageModule {}
