import { BadRequestException } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ format: 'email' }) email!: string
  @ApiProperty({ format: 'password', maxLength: 128 }) password!: string
}

export class RegisterDto extends LoginDto {
  @ApiProperty({ minLength: 2, maxLength: 100 }) name!: string
}

export class PublicUser {
  @ApiProperty({ format: 'uuid' }) id!: string
  @ApiProperty({ format: 'email' }) email!: string
  @ApiProperty() name!: string
  @ApiProperty({ enum: ['SYSTEM_ADMIN'], required: false }) systemRole?: 'SYSTEM_ADMIN'
}

export class ActivateAccountDto {
  @ApiProperty() token!: string
  @ApiProperty({ minLength: 12, maxLength: 128 }) password!: string
}

export class UpdateProfileDto {
  @ApiProperty({ minLength: 2, maxLength: 100 }) name!: string
}

export class ChangePasswordDto {
  @ApiProperty({ maxLength: 128 }) currentPassword!: string
  @ApiProperty({ minLength: 12, maxLength: 128 }) newPassword!: string
}

export function updateProfileInput(body?: Partial<UpdateProfileDto>): UpdateProfileDto {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (name.length < 2 || name.length > 100) {
    throw new BadRequestException('Họ tên hiển thị cần từ 2 đến 100 ký tự.')
  }
  return { name }
}

export function changePasswordInput(body?: Partial<ChangePasswordDto>): ChangePasswordDto {
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''
  if (!currentPassword || currentPassword.length > 128) {
    throw new BadRequestException('Vui lòng nhập mật khẩu hiện tại.')
  }
  if (newPassword.length < 12 || newPassword.length > 128) {
    throw new BadRequestException('Mật khẩu mới cần từ 12 đến 128 ký tự.')
  }
  if (currentPassword === newPassword) {
    throw new BadRequestException('Mật khẩu mới cần khác mật khẩu hiện tại.')
  }
  return { currentPassword, newPassword }
}

export function activationInput(body?: Partial<ActivateAccountDto>): ActivateAccountDto {
  if (typeof body?.token !== 'string' || typeof body.password !== 'string') {
    throw new BadRequestException('Thông tin kích hoạt không hợp lệ.')
  }
  return { token: body.token, password: body.password }
}

export function loginInput(body?: Partial<LoginDto>): LoginDto {
  if (
    typeof body?.email !== 'string' || body.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ||
    typeof body.password !== 'string' || body.password.length < 1 || body.password.length > 128
  ) {
    throw new BadRequestException('Email hoặc mật khẩu không hợp lệ.')
  }
  return { email: body.email.trim().toLowerCase(), password: body.password }
}

export function registerInput(body?: Partial<RegisterDto>): RegisterDto {
  const input = loginInput(body)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (name.length < 2 || name.length > 100 || input.password.length < 12) {
    throw new BadRequestException('Tên cần 2–100 ký tự và mật khẩu cần ít nhất 12 ký tự.')
  }
  return { ...input, name }
}
