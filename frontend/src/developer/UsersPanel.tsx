import { useQuery } from '@tanstack/react-query'
import { Button, Form, Input, Modal, Select, Space, Switch, Table, Tag } from 'antd'
import { Plus, Search, Settings2 } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { get, patch, post } from '../api/client'
import LocalizedForm from '../LocalizedForm'
import { Failure, Loading, useAction } from '../ui'

import type { Member, MemberValues, Page } from './types'

import { roleName, roles } from './presentation'

function MemberEditor({
  member,
  clinicId,
  onClose,
}: {
  member: Member | 'new'
  clinicId?: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const editing = member === 'new' ? null : member
  const [form] = Form.useForm<MemberValues>()
  const { act, busy } = useAction()
  const save = async (values: MemberValues) => {
    if (!editing && !clinicId) return
    const body = {
      name: values.name.trim(),
      role: values.role,
      password: values.password || undefined,
      ...(editing ? { active: values.active } : { email: values.email?.trim() }),
    }
    const saved = await act(() =>
      editing
        ? patch(`/developer/users/${editing.id}`, { ...body, expected_version: editing.version })
        : post(`/developer/clinics/${clinicId}/users`, body),
    )
    if (saved) onClose()
  }
  return (
    <Modal
      title={editing ? t('commerceManageMember') : t('commerceAddClinicMember')}
      open
      onCancel={() => {
        if (!busy) onClose()
      }}
      footer={null}
      maskClosable={!busy}
    >
      <LocalizedForm
        disabled={busy}
        form={form}
        initialValues={
          editing
            ? { name: editing.name, role: editing.role, active: editing.active }
            : { role: 'doctor', active: true }
        }
        layout="vertical"
        onFinish={(values) => void save(values)}
      >
        <Form.Item
          name="name"
          label={t('commerceFullName')}
          rules={[
            {
              required: true,
              whitespace: true,
              min: 2,
              max: 120,
              message: t('commerceNameLength'),
            },
          ]}
        >
          <Input />
        </Form.Item>
        {!editing && (
          <Form.Item
            name="email"
            label={t('commerceLoginEmailShort')}
            rules={[{ required: true, type: 'email', message: t('commerceValidEmail') }]}
          >
            <Input type="email" autoComplete="off" />
          </Form.Item>
        )}
        {editing && (
          <p className="commerce-fineprint">
            {editing.email} · {editing.clinic_name}
          </p>
        )}
        <Form.Item name="role" label={t('commerceWorkingRole')} rules={[{ required: true }]}>
          <Select options={roles()} />
        </Form.Item>
        <Form.Item
          name="password"
          label={editing ? t('commerceNewPasswordOptional') : t('commerceInitialPassword')}
          extra={t('commercePasswordNotShown')}
          rules={[{ required: !editing, min: 12, max: 128, message: t('commercePasswordLength') }]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        {editing && (
          <Form.Item name="active" label={t('commerceAccountActive')} valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
        <Space>
          <Button type="primary" htmlType="submit" loading={busy}>
            {t('commerceSave')}
          </Button>
          <Button onClick={onClose} disabled={busy}>
            {t('commerceCancel')}
          </Button>
        </Space>
      </LocalizedForm>
    </Modal>
  )
}

export function UsersPanel({
  clinicId,
  currentUserId,
  canAdd = true,
}: {
  clinicId?: string
  currentUserId: string
  canAdd?: boolean
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const q = useDeferredValue(search)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Member | 'new' | null>(null)
  const query = useQuery({
    queryKey: ['developer-users', clinicId, q, page],
    queryFn: ({ signal }) =>
      get<Page<Member>>(
        `/developer/users?page=${page}&page_size=10&q=${encodeURIComponent(q)}${clinicId ? `&tenant_id=${encodeURIComponent(clinicId)}` : ''}`,
        signal,
      ),
  })
  return (
    <section className="commerce-card">
      <div className="commerce-section-heading">
        <div>
          <h2>{clinicId ? t('commerceClinicTeam') : t('commerceAllUsers')}</h2>
          <p>{t('commerceUserManagementHint')}</p>
        </div>
        {clinicId && (
          <Button
            type="primary"
            icon={<Plus size={15} />}
            disabled={!canAdd}
            aria-describedby={!canAdd ? `developer-team-hint-${clinicId}` : undefined}
            onClick={() => setSelected('new')}
          >
            {t('commerceAddMember')}
          </Button>
        )}
      </div>
      {clinicId && !canAdd && (
        <p id={`developer-team-hint-${clinicId}`} className="commerce-fineprint">
          {t('commerceActivateBeforeAdd')}
        </p>
      )}
      <div className="commerce-toolbar">
        <Input
          allowClear
          value={search}
          prefix={<Search size={15} />}
          placeholder={t('commerceSearchNameEmail')}
          aria-label={t('commerceSearchStaff')}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <Table<Member>
          rowKey="id"
          dataSource={query.data.items}
          scroll={{ x: clinicId ? 650 : 830 }}
          pagination={{
            current: page,
            pageSize: 10,
            total: query.data.total,
            onChange: setPage,
            showSizeChanger: false,
            hideOnSinglePage: true,
          }}
          columns={[
            {
              title: t('commerceMember'),
              key: 'name',
              render: (_, item) => (
                <div className="commerce-person">
                  <strong>{item.name}</strong>
                  <span>{item.email}</span>
                  {!clinicId && <small>{item.clinic_name}</small>}
                </div>
              ),
            },
            {
              title: t('commerceRole'),
              key: 'role',
              render: (_, item) => (
                <>
                  {roleName(item.role)}
                  {item.is_clinic_owner && <Tag>{t('commerceClinicOwner')}</Tag>}
                </>
              ),
            },
            {
              title: t('commerceStatus'),
              key: 'active',
              render: (_, item) => (
                <Tag color={item.active ? 'green' : 'default'}>
                  {item.active ? t('commerceActive') : t('commerceInactive')}
                </Tag>
              ),
            },
            {
              title: '',
              key: 'edit',
              render: (_, item) =>
                item.is_clinic_owner || item.role === 'developer' || item.id === currentUserId ? (
                  <span className="commerce-fineprint" title={t('commerceAdminProtectedHint')}>
                    {t('commerceProtectedAccount')}
                  </span>
                ) : (
                  <Button icon={<Settings2 size={14} />} onClick={() => setSelected(item)}>
                    {t('commerceManage')}
                  </Button>
                ),
            },
          ]}
        />
      )}
      {selected && (
        <MemberEditor
          key={selected === 'new' ? 'new' : selected.id}
          member={selected}
          clinicId={clinicId}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  )
}
