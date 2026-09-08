/**
 * @author Brave
 * @date 2026-9-4 17:38:16
 * @description 邮件模块服务层
 */
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

  /**
   * 发送验证码邮件
   * @param to - 收件人邮箱
   * @param code - 6位验证码
   * @param purpose - 验证码用途标识（如 'register' / 'change_password'）
   */
  async sendVerificationCode(
    to: string,
    code: string,
    purpose: string,
  ): Promise<void> {
    const LABEL_MAP = {
      register: '注册',
      change_password: '修改密码',
      delete_account: '账号注销',
      forgot_password: '忘记密码',
    };

    // 根据用途确定邮件标题和文字描述
    const title = `${LABEL_MAP[purpose] || ''}验证码`;
    const label = LABEL_MAP[purpose] || '操作';

    // 读取验证码过期时间
    const expiresMinutes = this.configService.get<number>(
      'MAIL_CODE_EXPIRES_MINUTES',
    );

    // 设置邮件主题
    const subject = `【日常消费记录系统】${title}`;

    // 设置邮件HTML正文
    const html = `
      <div style="max-width:480px;margin:0 auto;padding:24px;font-family:Microsoft YaHei,sans-serif;color:#1f2937;">
        <div style="font-size:20px;font-weight:bold;color:#153f3a;margin-bottom:16px;">${subject}</div>
        <p style="font-size:14px;line-height:1.8;">您的${label}验证码为：</p>
        <div style="background:#e7f7f4;border-radius:8px;padding:16px;text-align:center;margin:20px 0;">
          <span style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#0f766e;">${code}</span>
        </div>
        <p style="font-size:13px;color:#667085;line-height:1.6;">
          该验证码 ${expiresMinutes} 分钟内有效，请勿告诉他人。<br/>
          如非您本人操作，请忽略此邮件。
        </p>
      </div>
    `;

    await this.sendMail(to, subject, html);
  }
}
