import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ConsoleLogger, ValidationPipe } from '@nestjs/common';

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

  // 全局注册管道
  app.useGlobalPipes(
    new ValidationPipe({
      // 自动转换数据类型，一定开启。如将自动将普通请求对象转换成 DTO 实例，把 query 中的数字字符串转成 number
      transform: true,
      // 自动剔除请求中传入的 DTO 中没有定义的字段
      whitelist: true,
      // 当传递了DTO中不存在的字段，会抛出异常，而不是静默删除。可以不开启
      forbidNonWhitelisted: false,
      // 同一个字段一旦有一个校验规则失败，就不再继续检查该字段剩余的校验规则
      stopAtFirstError: true,
    }),
  );

  // 监听端口
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
