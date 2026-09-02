import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * 应用启动函数
 * @description: 创建NestJS应用实例并配置全局组件
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 监听端口
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
