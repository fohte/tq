import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ProjectFieldsManagerDialog } from '#components/project/project-fields-manager-dialog'
import { makeProjectField } from '#components/project/project-test-fixtures'

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

function inputForm(label: string) {
  const form = screen.getByLabelText(label).closest('form')
  if (form == null) throw new Error('The input must be inside a form')
  return within(form)
}

describe('ProjectFieldsManagerDialog', () => {
  it('creates a field', async () => {
    const user = userEvent.setup()
    const callbacks = renderDialog()

    fireEvent.change(screen.getByLabelText('新しいフィールド名'), {
      target: { value: 'OtherCategory' },
    })
    await user.click(
      inputForm('新しいフィールド名').getByRole('button', { name: '追加' }),
    )

    await waitFor(() => {
      expect(callbacks.onCreateField.mock.calls).toEqual([['OtherCategory']])
    })
  })

  it('renames a field', async () => {
    const user = userEvent.setup()
    const callbacks = renderDialog()

    await user.click(
      screen.getByRole('button', { name: 'SampleCategoryを編集' }),
    )
    fireEvent.change(screen.getByLabelText('フィールド名を変更'), {
      target: { value: 'RenamedCategory' },
    })
    await user.click(screen.getByRole('button', { name: 'フィールド名を保存' }))

    await waitFor(() => {
      expect(callbacks.onRenameField.mock.calls).toEqual([
        ['field-a', 'RenamedCategory'],
      ])
    })
  })

  it('creates an option', async () => {
    const user = userEvent.setup()
    const callbacks = renderDialog()

    fireEvent.change(screen.getByLabelText('SampleCategoryの新しい選択肢'), {
      target: { value: 'OptionD' },
    })
    await user.click(
      inputForm('SampleCategoryの新しい選択肢').getByRole('button', {
        name: '追加',
      }),
    )

    await waitFor(() => {
      expect(callbacks.onCreateOption.mock.calls).toEqual([
        ['field-a', 'OptionD'],
      ])
    })
  })

  it('renames an option', async () => {
    const user = userEvent.setup()
    const callbacks = renderDialog()

    await user.click(screen.getByRole('button', { name: 'OptionAを編集' }))
    fireEvent.change(screen.getByLabelText('選択肢名を変更'), {
      target: { value: 'OptionC' },
    })
    await user.click(screen.getByRole('button', { name: '選択肢名を保存' }))

    await waitFor(() => {
      expect(callbacks.onRenameOption.mock.calls).toEqual([
        ['field-a', 'option-a', 'OptionC'],
      ])
    })
  })

  it('confirms field deletion with its task value effect', async () => {
    const user = userEvent.setup()
    const callbacks = renderDialog()

    await user.click(
      screen.getByRole('button', { name: 'SampleCategoryを削除' }),
    )
    const description = screen.getByText(
      '「SampleCategory」を削除すると、このフィールドに設定されているすべてのタスクの値も削除されます。この操作は取り消せません。',
    ).textContent
    await user.click(screen.getByRole('button', { name: '削除' }))

    const result = () => ({
      description,
      calls: callbacks.onDeleteField.mock.calls,
    })
    await waitFor(() => {
      expect(result()).toEqual({
        description:
          '「SampleCategory」を削除すると、このフィールドに設定されているすべてのタスクの値も削除されます。この操作は取り消せません。',
        calls: [['field-a']],
      })
    })
  })

  it('confirms option deletion with its task value effect', async () => {
    const user = userEvent.setup()
    const callbacks = renderDialog()

    await user.click(screen.getByRole('button', { name: 'OptionAを削除' }))
    const description = screen.getByText(
      '「OptionA」を削除すると、この選択肢を設定しているタスクは未設定になります。この操作は取り消せません。',
    ).textContent
    await user.click(screen.getByRole('button', { name: '削除' }))

    const result = () => ({
      description,
      calls: callbacks.onDeleteOption.mock.calls,
    })
    await waitFor(() => {
      expect(result()).toEqual({
        description:
          '「OptionA」を削除すると、この選択肢を設定しているタスクは未設定になります。この操作は取り消せません。',
        calls: [['field-a', 'option-a']],
      })
    })
  })

  it('disables deletes while another mutation is pending', async () => {
    const user = userEvent.setup()
    let finishCreate: (() => void) | undefined
    const onCreateField = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishCreate = resolve
        }),
    )
    renderDialog({ onCreateField })

    fireEvent.change(screen.getByLabelText('新しいフィールド名'), {
      target: { value: 'OtherCategory' },
    })
    await user.click(
      inputForm('新しいフィールド名').getByRole('button', { name: '追加' }),
    )

    const deleteButtonsDisabled = () => ({
      field: screen.getByRole<HTMLButtonElement>('button', {
        name: 'SampleCategoryを削除',
      }).disabled,
      option: screen.getByRole<HTMLButtonElement>('button', {
        name: 'OptionAを削除',
      }).disabled,
    })
    const pendingState = deleteButtonsDisabled()
    if (finishCreate == null) throw new Error('Field creation did not start')
    finishCreate()
    await waitFor(() => {
      if (Object.values(deleteButtonsDisabled()).some(Boolean)) {
        throw new Error('Delete buttons are still disabled')
      }
    })

    const result = () => ({
      pendingState,
      idleState: deleteButtonsDisabled(),
      createCalls: onCreateField.mock.calls,
    })
    expect(result()).toEqual({
      pendingState: { field: true, option: true },
      idleState: { field: false, option: false },
      createCalls: [['OtherCategory']],
    })
  })

  it('resets form and error state when reopened', async () => {
    const user = userEvent.setup()
    const onCreateField = vi.fn(() =>
      Promise.reject(
        new Error('このプロジェクトには同じ名前のフィールドがあります'),
      ),
    )
    const props: React.ComponentProps<typeof ProjectFieldsManagerDialog> = {
      open: true,
      onOpenChange: vi.fn(),
      fields: [makeProjectField()],
      initialEditingFieldId: 'field-a',
      initialEditingOption: { fieldId: 'field-a', optionId: 'option-a' },
      onCreateField,
      onRenameField: vi.fn(async () => {}),
      onDeleteField: vi.fn(async () => {}),
      onCreateOption: vi.fn(async () => {}),
      onRenameOption: vi.fn(async () => {}),
      onDeleteOption: vi.fn(async () => {}),
    }
    const { rerender } = render(<ProjectFieldsManagerDialog {...props} />)

    fireEvent.change(screen.getByLabelText('新しいフィールド名'), {
      target: { value: 'DuplicateCategory' },
    })
    fireEvent.change(screen.getByLabelText('SampleCategoryの新しい選択肢'), {
      target: { value: 'UnsavedOption' },
    })
    await user.click(
      inputForm('新しいフィールド名').getByRole('button', { name: '追加' }),
    )
    await screen.findByRole('alert')

    rerender(<ProjectFieldsManagerDialog {...props} open={false} />)
    rerender(<ProjectFieldsManagerDialog {...props} open />)
    await waitFor(() => {
      if (screen.queryByRole('alert') != null) {
        throw new Error('The previous error is still visible')
      }
      if (screen.queryByLabelText('フィールド名を変更') != null) {
        throw new Error('The previous field editor is still open')
      }
      if (screen.queryByLabelText('選択肢名を変更') != null) {
        throw new Error('The previous option editor is still open')
      }
    })

    const result = () => ({
      error: screen.queryByRole('alert')?.textContent ?? null,
      newFieldName:
        screen.getByLabelText<HTMLInputElement>('新しいフィールド名').value,
      newOptionName: screen.getByLabelText<HTMLInputElement>(
        'SampleCategoryの新しい選択肢',
      ).value,
      editingField:
        screen.queryByLabelText<HTMLInputElement>('フィールド名を変更')
          ?.value ?? null,
      editingOption:
        screen.queryByLabelText<HTMLInputElement>('選択肢名を変更')?.value ??
        null,
    })
    expect(result()).toEqual({
      error: null,
      newFieldName: '',
      newOptionName: '',
      editingField: null,
      editingOption: null,
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

    fireEvent.change(screen.getByLabelText('新しいフィールド名'), {
      target: { value: 'DuplicateCategory' },
    })
    await user.click(
      inputForm('新しいフィールド名').getByRole('button', { name: '追加' }),
    )
    await screen.findByRole('alert')

    const result = () => ({
      message: screen.getByRole('alert').textContent,
      calls: onCreateField.mock.calls,
    })
    expect(result()).toEqual({
      message: 'このプロジェクトには同じ名前のフィールドがあります',
      calls: [['DuplicateCategory']],
    })
  })
})
