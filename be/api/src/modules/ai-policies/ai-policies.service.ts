import { Injectable } from '@nestjs/common'
import { DataClassification } from '../../database/generated/client'

export interface AiEvaluationPolicy {
  classification: DataClassification
  allowExternalAi: boolean
  modelTier: 'LOCAL_ONLY' | 'PRIVATE_ISOLATED' | 'BLOCKED'
  reason: string
}

@Injectable()
export class AiPoliciesService {
  evaluatePolicy(
    classification: DataClassification,
    orgExternalAiPolicy: string = 'OFF',
  ): AiEvaluationPolicy {
    // Law of P0: Any CONFIDENTIAL or RESTRICTED data MUST NOT be sent to external AI under any circumstance.
    if (classification === 'RESTRICTED') {
      return {
        classification,
        allowExternalAi: false,
        modelTier: 'BLOCKED',
        reason: 'Tài liệu mức RESTRICTED (Tuyệt mật) bị khóa cứng hoàn toàn khỏi mọi mô hình AI bên ngoài.',
      }
    }

    if (classification === 'CONFIDENTIAL') {
      return {
        classification,
        allowExternalAi: false,
        modelTier: 'LOCAL_ONLY',
        reason: 'Tài liệu mức CONFIDENTIAL (Mật) chỉ được xử lý bởi mô hình AI chạy trong mạng nội bộ (On-premise / Local parser).',
      }
    }

    // INTERNAL
    if (orgExternalAiPolicy === 'OFF') {
      return {
        classification,
        allowExternalAi: false,
        modelTier: 'LOCAL_ONLY',
        reason: 'Tổ chức đang cấu hình Chính sách AI bên ngoài = OFF. Mọi yêu cầu được giữ 100% trong hạ tầng nội bộ.',
      }
    }

    return {
      classification,
      allowExternalAi: true,
      modelTier: 'PRIVATE_ISOLATED',
      reason: 'Tài liệu thông thường (INTERNAL), được phép sử dụng bộ xử lý AI theo chính sách tổ chức.',
    }
  }
}
