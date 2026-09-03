import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// 从 NestJS TypeORM 模块导入 TypeOrmModule。
import { TypeOrmModule } from '@nestjs/typeorm';
// 导入数据库配置函数
import { getDatabaseConfig } from './config/database.config';
import { ConfigModule, ConfigService } from '@nestjs/config';
// 导入用户模块
import { UserModule } from './modules/users/users.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

@Module({
  imports: [
    // 注册配置服务，并按当前运行环境加载对应的环境变量文件。
    ConfigModule.forRoot({
      // 把 ConfigModule 注册成全局模块，其他模块使用 ConfigService 时，不需要再次导入
      isGlobal: true,
      // 指定环境变量文件路径
      envFilePath: `.env.${process.env.NODE_ENV ?? 'development'}`,
    }),

    // TypeORM数据库模块
    TypeOrmModule.forRootAsync({
      // 把注入值(ConfigService)作为函数工厂的第一个参数传进去
      inject: [ConfigService],
      // 函数工厂
      useFactory: getDatabaseConfig,
    }),

    // 用户模块
    UserModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // 全局注册响应拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
