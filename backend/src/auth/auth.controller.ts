import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService, type AuthResult } from './auth.service';
import type { AuthenticatedUser } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

export const REFRESH_COOKIE = 'sps_refresh';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in (FR-AUT-01)' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, req.ip);
    this.setRefreshCookie(res, result);

    return this.toBody(result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the refresh token (FR-AUT-02)' })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = this.readRefreshToken(req, dto);
    const result = await this.auth.refresh(token, req.ip);
    this.setRefreshCookie(res, result);

    return this.toBody(result);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the refresh token (FR-AUT-03)' })
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(this.readRefreshToken(req, dto), req.ip);

    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The signed-in user (FR-AUT-06)' })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change your own password (FR-AUT-07)' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.changePassword(user.id, dto, req.ip);

    // Every refresh token was just revoked, so the stale cookie is useless.
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  private readRefreshToken(req: Request, dto: RefreshDto): string | undefined {
    const cookies = req.cookies as
      Record<string, string | undefined> | undefined;

    return cookies?.[REFRESH_COOKIE] ?? dto.refreshToken;
  }

  private setRefreshCookie(res: Response, result: AuthResult): void {
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      ...this.cookieOptions(),
      expires: result.refreshTokenExpiresAt,
    });
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      // Only over TLS in production; dev runs on plain http://localhost.
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
    };
  }

  private toBody(result: AuthResult) {
    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      // Also returned in the body so the Next.js server can hold it in its own
      // httpOnly cookie; the browser never calls this API directly.
      refreshToken: result.refreshToken,
      user: result.user,
    };
  }
}
