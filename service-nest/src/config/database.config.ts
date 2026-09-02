/**
 * @author: Brave
 * @data: 2026-9-2 11:12:30
 * @description: 使用TypeORM连接MySQL数据库的配置
 */

// 从 NestJS 配置模块导入 ConfigService
import { ConfigService } from '@nestjs/config';
// 从 NestJS TypeORM 模块导入数据库配置类型
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getDatabaseConfig = (
  // 注入配置服务用于读取环境变量
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  // 数据库类型为MySQL
  type: 'mysql',
  // 从环境变量读取数据库主机地址
  host: configService.get<string>('DB_HOST'),
  // 从环境变量读取数据库端口号
  port: configService.get<number>('DB_PORT'),
  // 从环境变量读取数据库用户名
  username: configService.get<string>('DB_USER'),
  // 从环境变量读取数据库密码
  password: configService.get<string>('DB_PASSWORD'),
  // 从环境变量读取数据库名称
  database: configService.get<string>('DB_DATABASE'),
  // 自动加载所有实体类，减少在根模块里手动维护实体清单。
  autoLoadEntities: true,
  // 让 mysql2 将 DECIMAL 和聚合结果按 number 返回，避免金额字段变成字符串
  extra: {
    decimalNumbers: true,
  },
  // 数据库根据 Entity 自动同步数据库表结构。线上需要关闭，避免运行时自动修改数据库结构。
  synchronize: configService.get<string>('NODE_ENV') !== 'production',
});
