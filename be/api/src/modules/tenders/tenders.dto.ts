import { BadRequestException } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { ProcurementStage } from '../../database/generated/client'

export class CreateTenderDto { @ApiProperty() title!: string; @ApiProperty({ enum: ProcurementStage }) procurementStage!: ProcurementStage; @ApiProperty({ required: false }) reference?: string }
export class CreateLotDto { @ApiProperty() code!: string; @ApiProperty() name!: string }
export class CreateItemDto { @ApiProperty() itemNo!: string; @ApiProperty() name!: string; @ApiProperty() quantity!: number; @ApiProperty() unit!: string; @ApiProperty({ required: false }) description?: string }
const text = (value: unknown, label: string, max = 200) => { const result = typeof value === 'string' ? value.trim() : ''; if (!result || result.length > max) throw new BadRequestException(`${label} không hợp lệ.`); return result }
export function tenderInput(body?: Partial<CreateTenderDto>) { if (!Object.values(ProcurementStage).includes(body?.procurementStage as ProcurementStage)) throw new BadRequestException('Loại hồ sơ không hợp lệ.'); return { title: text(body?.title, 'Tên hồ sơ'), procurementStage: body!.procurementStage!, reference: body?.reference?.trim() || null } }
export function lotInput(body?: Partial<CreateLotDto>) { return { code: text(body?.code, 'Mã lot', 50), name: text(body?.name, 'Tên lot') } }
export function itemInput(body?: Partial<CreateItemDto>) { const quantity = Number(body?.quantity); if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequestException('Số lượng phải lớn hơn 0.'); return { itemNo: text(body?.itemNo, 'STT', 50), name: text(body?.name, 'Tên hàng hóa'), quantity, unit: text(body?.unit, 'Đơn vị', 50), description: body?.description?.trim() || null } }
