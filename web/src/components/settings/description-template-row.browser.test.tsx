import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DescriptionTemplateRow } from '#components/settings/description-template-row'
import { makeDescriptionTemplate } from '#components/settings/description-template-test-fixtures'
import { useDeleteDescriptionTemplate } from '#hooks/use-description-templates'
import { partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-description-templates', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-description-templates')>()
  return {
    ...original,
    useDeleteDescriptionTemplate: vi.fn(),
  }
})

const mockUseDeleteDescriptionTemplate = vi.mocked(useDeleteDescriptionTemplate)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DescriptionTemplateRow', () => {
  it('deletes the template after confirmation', async () => {
    const mutate =
      vi.fn<ReturnType<typeof useDeleteDescriptionTemplate>['mutate']>()
    mockUseDeleteDescriptionTemplate.mockReturnValue(
      partialMutation<ReturnType<typeof useDeleteDescriptionTemplate>>({
        mutate,
        isPending: false,
        isError: false,
      }),
    )
    const user = userEvent.setup()
    render(
      <DescriptionTemplateRow
        template={makeDescriptionTemplate({
          id: 'template-id-1',
          name: 'Sample template',
        })}
        onEdit={vi.fn()}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Sample template を削除' }),
    )
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(mutate.mock.calls).toEqual([['Sample template']])
  })
})
