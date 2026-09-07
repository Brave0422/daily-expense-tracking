import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  // 日志记录器
  private readonly logger = new Logger(MailService.name);
  // 邮件发送器实例
  private transporter: Transporter | null = null;

  /**
   * 构造函数
   * @param configService - 注入配置服务用于读取 SMTP 环境变量
   */
  constructor(private readonly configService: ConfigService) {}

  /**
   * 获取或创建 transporter
   * @returns Transporter 实例
   */
  private getTransporter(): Transporter {
    // 从环境变量读取 SMTP 配置
    const host = this.configService.get<string>('MAIL_HOST');
    const port = this.configService.get<number>('MAIL_PORT', 587);
    const secure =
      this.configService.get<string>('MAIL_SECURE', 'false') === 'true';
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASS');

    // SMTP 未配置时记录警告，后续发送时抛出明确错误
    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP 邮件服务未配置（缺少 MAIL_HOST / MAIL_USER / MAIL_PASS），无法发送验证码邮件',
      );
      return null as any;
    }

    // 创建邮件发送器
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    this.logger.log(`SMTP 邮件服务已配置 - 主机: ${host}:${port}`);

    return this.transporter;
  }

  /**
   * 发送邮件
   * @param to 收件人邮箱
   * @param subject 邮件标题
   * @param html 右键 HTML 正文
   */
  async sendMail(to: string, subject: string, html: string): Promise<void> {
    // 获取当前可用的邮件发送器
    const transporter = this.getTransporter();
    if (!transporter) {
      throw new InternalServerErrorException('邮件服务未配置，请联系管理员');
    }

    // 获取发件人标识
    const from = this.configService.get<string>('MAIL_FROM', '');

    // 组装 nodemailer 发送邮件所需的完整参数。
    const mailOptions = { from, to, subject, html };

    try {
      await transporter.sendMail(mailOptions);
      this.logger.log(`邮件发送成功 - 收件人: ${to}, 标题: ${subject}`);
    } catch (error) {
      this.logger.error(
        `邮件发送失败 - 收件人: ${to}, 错误: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException('邮件发送失败，请稍后重试');
    }
  }

  
}
