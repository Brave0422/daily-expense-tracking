/**
 * @author Brave
 * @date 2026-9-2 17:33:15
 * @description 用户模块
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { UsersService } from './users.service';

@Module({
  // 在当前模块里注册 User 用户实体仓库
  imports: [TypeOrmModule.forFeature([UserEntity])],

  // 注册本模块的服务提供者
  providers: [UsersService],

  // 供认证等其他模块调用用户数据能力
  exports: [UsersService],
})
export class UsersModule {}
