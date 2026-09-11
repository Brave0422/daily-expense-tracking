/**
 * @author Brave
 * @date 2026-9-2 17:33:26
 * @description 用户模块服务层
 */

import {
  UnauthorizedException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { hash, compare } from 'bcrypt';
import { UserService } from '../../users/users.service';
import { VerificationCodeService } from '../../verification-code/verification-code.service';
import { VerificationPurpose } from '../../verification-code/enums/verification-purpose-enum';
import { AuthTokenService } from './auth-token.service';

@Injectable()
export class AuthService {
  constructor(
    // 注入用户服务
    private readonly userService: UserService,
    // 注入验证码服务
    private readonly verificationService: VerificationCodeService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  /**
   * 哈希密码
   * @param password 密码
   * @returns 密码哈希值
   */
  private async hashPassword(password: string): Promise<string> {
    // 使用bcrypt加盐哈希，盐轮数为10
    return await hash(password, 10);
  }

  /**
   * 验证密码是否匹配
   * @param inputPassword 用户输入的明文密码
   * @param passwordHash 数据存储的密码哈希
   * @returns 比较结果
   */
  private async comparePassword(
    inputPassword: string,
    passwordHash: string,
  ): Promise<boolean> {
    return await compare(inputPassword, passwordHash);
  }

  /**
   * 用户注册（两步式：需先通过 sendRegisterCode 获取验证码）
   * @param email - 邮箱
   * @param password - 明文密码
   * @param code - 注册验证码
   * @returns 注册成功消息
   */
  async register(
    email: string,
    password: string,
    code: string,
  ): Promise<boolean> {
    // 检查邮箱是否已注册
    const existingUser = await this.userService.findOneByEmail(email);

    // 如果邮箱已存在则抛出冲突异常
    if (existingUser) throw new ConflictException('该邮箱已被注册');

    // 校验验证码
    await this.verificationService.verifyAndConsume(
      email,
      VerificationPurpose.REGISTER,
      code,
    );

    try {
      // 对密码进行哈希处理
      const passwordHash = await this.hashPassword(password);

      // 创建用户实体
      const user = this.userService.create(email, passwordHash);

      // 保存用户
      await this.userService.save(user);

      return true;
    } catch {
      throw new InternalServerErrorException('注册失败');
    }
  }

  /**
   * 用户登录
   * @param email 邮箱
   * @param password 密码
   * @returns token
   */
  async login(email: string, password: string): Promise<string> {
    // 根据邮箱查找对应用户
    const user = await this.userService.findOneByEmail(email);
    if (!user) throw new UnauthorizedException('用户名或密码错误');

    const matched = await this.comparePassword(password, user.passwordHash);

    if (!matched) throw new UnauthorizedException('用户名或密码错误');

    // 匹配成功，生成token返回给客户端，登录成功
    const token = await this.authTokenService.createToken(user.id, email);

    return token;
  }
}
