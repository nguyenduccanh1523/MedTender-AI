import type { IncomingMessage, ServerResponse } from 'node:http'
import { Body, Controller, Get, Header, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'

import { AuthRateGuard } from './guards/auth-rate.guard'
import { accessCookie, readSessionCookie, refreshCookie, setSessionCookies } from './session-cookies'
import { SessionGuard, type IdentityRequest } from './guards/session.guard'
import { WebMutationGuard } from '../../../../common/http/web-mutation.guard'
import { activationInput, ActivateAccountDto, loginInput, LoginDto, PublicUser, registerInput, RegisterDto } from './identity.dto'
import { IdentityService } from '../../application/identity.service'

@ApiTags('identity')
@Controller('api/v1/auth')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post('register')
  @UseGuards(WebMutationGuard, AuthRateGuard)
  @Header('Cache-Control', 'no-store')
  @ApiCreatedResponse({ type: PublicUser })
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) res: ServerResponse) {
    const { user, tokens } = await this.identity.register(registerInput(body))
    setSessionCookies(res, tokens)
    return user
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(WebMutationGuard, AuthRateGuard)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PublicUser })
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: ServerResponse) {
    const { user, tokens } = await this.identity.login(loginInput(body))
    setSessionCookies(res, tokens)
    return user
  }

  @Post('activate')
  @HttpCode(200)
  @UseGuards(WebMutationGuard, AuthRateGuard)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PublicUser })
  async activate(@Body() body: ActivateAccountDto, @Res({ passthrough: true }) res: ServerResponse) {
    const input = activationInput(body)
    const { user, tokens } = await this.identity.activate(input.token, input.password)
    setSessionCookies(res, tokens)
    return user
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(WebMutationGuard)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PublicUser })
  async refresh(@Req() req: IncomingMessage, @Res({ passthrough: true }) res: ServerResponse) {
    const { user, tokens } = await this.identity.refresh(readSessionCookie(req, refreshCookie))
    setSessionCookies(res, tokens)
    return user
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(WebMutationGuard)
  @Header('Cache-Control', 'no-store')
  async logout(@Req() req: IncomingMessage, @Res({ passthrough: true }) res: ServerResponse) {
    await this.identity.logout(readSessionCookie(req, accessCookie), readSessionCookie(req, refreshCookie))
    setSessionCookies(res)
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @ApiCookieAuth(accessCookie)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PublicUser })
  me(@Req() req: IdentityRequest) {
    return req.identity
  }
}
