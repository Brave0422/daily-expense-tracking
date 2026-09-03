import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ConsoleLogger } from '@nestjs/common';

/**
 * 应用启动函数
 * @description: 创建NestJS应用实例并配置全局组件
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // 修改日志Logger的配置
    logger: new ConsoleLogger({
      // 修改日志前缀
      prefix: '记账系统',
      // 开启日志颜色
      colors: true,
      // 显示时间戳
      timestamp: true,
      // 指定允许输出的日志等级
      logLevels: ['log', 'warn', 'error', 'debug'],
    }),
  });

  // 全局注册日志拦截器
  app.useGlobalInterceptors(new LoggingInterceptor());

  // 监听端口
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
