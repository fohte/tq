import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { makeProjectField } from '#components/project/project-field-test-fixtures'
import { ProjectFieldsManagerDialog } from '#components/project/project-fields-manager-dialog'

function renderDialog(
  overrides: Partial<
    React.ComponentProps<typeof ProjectFieldsManagerDialog>
  > = {},
) {
  const callbacks = {
    onCreateField: vi.fn(async () => {}),
    onRenameField: vi.fn(async () => {}),
    onDeleteField: vi.fn(async () => {}),
    onCreateOption: vi.fn(async () => {}),
    onRenameOption: vi.fn(async () => {}),
    onDeleteOption: vi.fn(async () => {}),
  }
  render(
    <ProjectFieldsManagerDialog
      open
      onOpenChange={vi.fn()}
      fields={[makeProjectField()]}
      {...callbacks}
      {...overrides}
    />,
  )
  return callbacks
}

describe('ProjectFieldsManagerDialog', () => {
  it('creates and renames fields and options', async () => {
    const user = userEvent.setup()
    const callbacks = renderDialog()

    await user.type(screen.getByLabelText('新しいフィールド名'), '別分類')
    const fieldForm = screen
      .getByLabelText('新しいフィールド名')
      .closest('form')
    if (fieldForm == null) throw new Error('Field input must be inside a form')
    await user.click(within(fieldForm).getByRole('button', { name: '追加' }))

    await user.click(screen.getByRole('button', { name: '分類サンプルを編集' }))
    await user.clear(screen.getByLabelText('フィールド名を変更'))
    await user.type(screen.getByLabelText('フィールド名を変更'), '変更済み分類')
    await user.click(screen.getByRole('button', { name: 'フィールド名を保存' }))

    await user.click(screen.getByRole('button', { name: '候補 Aを編集' }))
    await user.clear(screen.getByLabelText('選択肢名を変更'))
    await user.type(screen.getByLabelText('選択肢名を変更'), '候補 C')
    await user.click(screen.getByRole('button', { name: '選択肢名を保存' }))

    const optionForm = screen
      .getByLabelText('分類サンプルの新しい選択肢')
      .closest('form')
    if (optionForm == null)
      throw new Error('Option input must be inside a form')
    await user.type(
      screen.getByLabelText('分類サンプルの新しい選択肢'),
      '候補 D',
    )
    await user.click(within(optionForm).getByRole('button', { name: '追加' }))

    const result = () => ({
      createField: callbacks.onCreateField.mock.calls,
      renameField: callbacks.onRenameField.mock.calls,
      createOption: callbacks.onCreateOption.mock.calls,
      renameOption: callbacks.onRenameOption.mock.calls,
    })
    await waitFor(() => {
      expect(result()).toEqual({
        createField: [['別分類']],
        renameField: [['field-a', '変更済み分類']],
        createOption: [['field-a', '候補 D']],
        renameOption: [['field-a', 'option-a', '候補 C']],
      })
    })
  })

  it('confirms deletions with their task value effects', async () => {
    const user = userEvent.setup()
    const callbacks = renderDialog()

    await user.click(screen.getByRole('button', { name: '分類サンプルを削除' }))
    const fieldDescription = screen.getByText(
      '「分類サンプル」を削除すると、このフィールドに設定されているすべてのタスクの値も削除されます。この操作は取り消せません。',
    ).textContent
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: '候補 Aを削除' }))
    const optionDescription = screen.getByText(
      '「候補 A」を削除すると、この選択肢を設定しているタスクは未設定になります。この操作は取り消せません。',
    ).textContent
    await user.click(screen.getByRole('button', { name: '削除' }))
    await user.click(screen.getByRole('button', { name: '分類サンプルを削除' }))
    await user.click(screen.getByRole('button', { name: '削除' }))

    const result = () => ({
      fieldDescription,
      optionDescription,
      deleteField: callbacks.onDeleteField.mock.calls,
      deleteOption: callbacks.onDeleteOption.mock.calls,
    })
    await waitFor(() => {
      expect(result()).toEqual({
        fieldDescription:
          '「分類サンプル」を削除すると、このフィールドに設定されているすべてのタスクの値も削除されます。この操作は取り消せません。',
        optionDescription:
          '「候補 A」を削除すると、この選択肢を設定しているタスクは未設定になります。この操作は取り消せません。',
        deleteField: [['field-a']],
        deleteOption: [['field-a', 'option-a']],
      })
    })
  })

  it('shows an API duplicate-name error', async () => {
    const user = userEvent.setup()
    const onCreateField = vi.fn(() =>
      Promise.reject(
        new Error('このプロジェクトには同じ名前のフィールドがあります'),
      ),
    )
    renderDialog({ onCreateField })

    await user.type(screen.getByLabelText('新しいフィールド名'), '分類サンプル')
    const form = screen.getByLabelText('新しいフィールド名').closest('form')
    if (form == null) throw new Error('Field input must be inside a form')
    await user.click(within(form).getByRole('button', { name: '追加' }))
    await screen.findByRole('alert')

    const result = () => ({
      message: screen.getByRole('alert').textContent,
      calls: onCreateField.mock.calls,
    })
    expect(result()).toEqual({
      message: 'このプロジェクトには同じ名前のフィールドがあります',
      calls: [['分類サンプル']],
    })
  })
})
