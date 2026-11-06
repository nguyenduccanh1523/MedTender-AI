'use client'

import { useEffect, useState } from 'react'

import { listOrganizationMembers, type OrganizationMember } from '../api'
import { loadResource, readResource } from '../../../lib/api/resource-cache'
import { roleLabels } from '../roles'

export function OrganizationMembers({ slug }: { slug: string }) {
  const [members, setMembers] = useState<OrganizationMember[] | undefined>(() => readResource(`members:${slug}`))
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    loadResource(`members:${slug}`, () => listOrganizationMembers(slug))
      .then((result) => { if (active) setMembers(result) })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không tải được danh sách thành viên.')
      })
    return () => { active = false }
  }, [slug, attempt])

  function retry() {
    setError('')
    setAttempt((previous) => previous + 1)
  }

  return (
    <section className="surface members-panel" aria-labelledby="members-title">
      <h2 id="members-title">Thành viên tổ chức</h2>
      <p className="muted">Danh sách thành viên, vai trò và trạng thái truy cập.</p>

      {error ? (
        <div className="members-state">
          <p className="notice notice-error" role="alert">{error}</p>
          <button className="button button-secondary" type="button" onClick={retry}>Thử lại</button>
        </div>
      ) : !members ? (
        <div className="members-skeleton" aria-label="Đang tải" aria-busy="true"><i /><i /><i /></div>
      ) : members.length === 0 ? (
        <p className="muted members-state">Chưa có thành viên để hiển thị.</p>
      ) : (
        <div className="members-table-wrap">
          <table className="members-table" aria-labelledby="members-title">
            <thead>
              <tr>
                <th scope="col">Tên</th>
                <th scope="col">Vai trò</th>
                <th scope="col">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.userId}>
                  <th scope="row">{member.name}</th>
                  <td>{roleLabels[member.role]}</td>
                  <td>
                    <span className={member.status === 'ACTIVE' ? 'member-status is-active' : 'member-status'}>
                      {member.status === 'ACTIVE' ? 'Đang hoạt động' : 'Vô hiệu hóa'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
