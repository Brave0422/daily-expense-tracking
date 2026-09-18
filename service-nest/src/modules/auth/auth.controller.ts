/**
 * @author Brave
 * @date 2026-9-2 17:35:30
 * @description 用户模块控制层
 */

import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ResonpseMsg } from 'src/common/decorators/response-message.decorator';
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './services/auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response, Request } from 'express';
import { changePasswordDto } from './dto/change-password.dto';
import { PasswordService } from './services/password.service';
import { AuthenticatedUser } from './guards/jwt-auth.guard';
import { VerificationPurpose } from '../verification-code/enums/verification-purpose-enum';
import { ResetPassword } from './dto/reset-password.dto';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

// Cookie 在浏览器中保存时使用的名字。
const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';

// 要和 JWT_REFRESH_EXPIRES_IN=7d 保持一致
const REFRESH_TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

interface AccessTokenResponse {
  accessToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    // 注入用户服务
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * 配置refresh token cookie选项
   * @returns Cookie 的公共配置
   */
  private getRefreshTokenCookieOptions(): CookieOptions {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    return {
      // cookie设置为httpOnly。HttpOnly 开启后前端无法通过 JavaScript 读取 ，这可以降低 XSS 风险
      httpOnly: true,
      // 表示只允许浏览器通过 HTTPS 发送这个 Cookie。生产环境一般使用 HTTPS，因此生产环境开启 Secure。
      secure: isProduction,
      // 前后端只是端口不同或使用同一主域名时，一般可以使用 Lax 。Lax 可以阻止大部分跨站请求携带 Cookie，从而降低 CSRF 风险
      sameSite: 'lax',
      // 限制 Cookie 只发送给path指定的接口
      path: '/auth/refresh',
      // 浏览器保存 Cookie 的时间，单位是毫秒
      maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
    };
  }

  /**
   * 把 refresh token 写入 HttpOnly Cookie
   * @param response 响应体
   * @param refreshToken refresh token
   * @returns 无返回值
   */
  private setRefreshTokenCookie(
    response: Response,
    refreshToken: string,
  ): void {
    // response.cookie() 会在响应头中添加 Set-Cookie。refresh token 不会出现在 Controller 返回的 JSON 数据里。
    response.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      refreshToken,
      this.getRefreshTokenCookieOptions(),
    );
  }

  /**
   * 注册用户
   * @param body 注册用户dto
   * @returns 是否注册成功
   */
  @Public()
  @Post('register')
  @ResonpseMsg('注册成功')
  async register(
    // 从请求体中提取并验证注册DTO
    @Body() body: RegisterDto,
  ): Promise<boolean> {
    const { email, password, code } = body;
    // 调用用户服务执行注册逻辑
    return await this.authService.register(email, password, code);
  }

  /**
   * 登录
   * @param body 登录dto
   * @param response 用于写入 refresh token Cookie 的响应体
   * @returns 包含 access token 的响应数据
   */
  @Public()
  @Post('login')
  @ResonpseMsg('登录成功')
  async login(
    @Body() body: LoginDto,

    // passthrough: true 表示只使用 Response 设置 Cookie，
    // 最终响应数据仍然交给 Nest 和 ResponseInterceptor 处理。
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenResponse> {
    const { email, password } = body;

    const { accessToken, refreshToken } = await this.authService.login(
      email,
      password,
    );

    // 把refresh token写入HttpOnly Cookie
    this.setRefreshTokenCookie(response, refreshToken);

    // 把access token返回给前端
    return { accessToken };
  }

  /**
   * 刷新token
   * @param request 用于读取 refresh token Cookie 的请求体
   * @param response 用于更新 refresh token Cookie 的响应体
   * @returns 包含新 access token 的响应数据
   */
  @Public()
  @Post('refresh')
  @ResonpseMsg('Token 刷新成功')
  async refresh(
    @Req() request: Request,
    // Response 用于覆盖浏览器中的旧 refresh token Cookie。
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenResponse> {
    // cookie-parser 会把 Cookie 解析到 request.cookies
    const oldRefreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE_NAME] as
      string | undefined;

    if (!oldRefreshToken) {
      throw new UnauthorizedException('Refresh Token 不存在，请重新登录');
    }

    // 刷新token并获取
    const { accessToken, refreshToken } =
      await this.authService.refresh(oldRefreshToken);

    // 把refresh token写入HttpOnly Cookie
    this.setRefreshTokenCookie(response, refreshToken);

    // 把access token返回给前端
    return { accessToken };
  }

  /**
   * 修改用户密码
   * @param body 修改密码dto
   * @param request 已认证修改的请求
   * @returns 是否修改成功
   */
  @Post('changePassword')
  @ResonpseMsg('修改密码成功')
  async changePassword(
    @Body() body: changePasswordDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<boolean> {
    const { newPassword, code } = body;

    // 获取守卫中添加的用户id
    const userId = request.user.id;

    // 设置验证码用途
    const purpose = VerificationPurpose.CHANGE_PASSWORD;

    return await this.passwordService.changePassword(
      userId,
      newPassword,
      code,
      purpose,
    );
  }

  /**
   * 重置密码
   * @param body 重置密码dto
   * @returns 是否重置成功
   */
  @Public()
  @Post('resetPassword')
  @ResonpseMsg('修改密码成功')
  async resetPassword(@Body() body: ResetPassword) {
    const { email, newPassword, code } = body;

    // 设置验证码用途
    const purpose = VerificationPurpose.RESET_PASSWORD;

    return await this.passwordService.resetPassword(
      email,
      newPassword,
      code,
      purpose,
    );
  }
}
