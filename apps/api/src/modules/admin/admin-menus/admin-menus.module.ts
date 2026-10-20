import { Module } from '@nestjs/common';
import { NotificationsModule } from '../../notifications/notifications.module';
import { AdminMenusController } from './controllers/admin-menus.controller';
import { AdminMenusRepository } from './repositories/admin-menus.repository';
import { MenuEditorService } from './services/menu-editor.service';
import { PublishMenuService } from './services/publish-menu.service';

/** Menus per date and meal with draft/publish (Admin §E). */
@Module({
  imports: [NotificationsModule],
  controllers: [AdminMenusController],
  providers: [AdminMenusRepository, MenuEditorService, PublishMenuService],
})
export class AdminMenusModule {}
