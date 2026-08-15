import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '#components/ui/button'
import { Checkbox } from '#components/ui/checkbox'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '#components/ui/field'
import { Input } from '#components/ui/input'
import { Textarea } from '#components/ui/textarea'

const meta = {
  title: 'UI/Field',
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <FieldGroup className="w-80">
      <Field>
        <FieldLabel htmlFor="field-story-title">Task title</FieldLabel>
        <Input
          id="field-story-title"
          placeholder="Write the quarterly report"
        />
        <FieldDescription>
          Shown in the task list and notifications.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="field-story-description">Description</FieldLabel>
        <Textarea
          id="field-story-description"
          placeholder="Add description..."
        />
      </Field>
    </FieldGroup>
  ),
}

export const WithError: Story = {
  render: () => (
    <Field className="w-80" data-invalid="true">
      <FieldLabel htmlFor="field-story-email">Email</FieldLabel>
      <Input id="field-story-email" aria-invalid defaultValue="not-an-email" />
      <FieldError>Please enter a valid email address.</FieldError>
    </Field>
  ),
}

export const WithMultipleErrors: Story = {
  render: () => (
    <Field className="w-80" data-invalid="true">
      <FieldLabel htmlFor="field-story-password">Password</FieldLabel>
      <Input id="field-story-password" type="password" aria-invalid />
      <FieldError
        errors={[
          { message: 'Must be at least 8 characters.' },
          { message: 'Must contain a number.' },
        ]}
      />
    </Field>
  ),
}

export const Horizontal: Story = {
  parameters: {
    // Checkbox's hit-slop pseudo-element overflows its own box on purpose —
    // see checkbox.stories.tsx for the same exemption.
    overflowCheck: { ignoreSelectors: ['[data-slot="checkbox"]'] },
  },
  render: () => (
    <Field orientation="horizontal" className="w-80">
      <Checkbox id="field-story-notify" />
      <FieldContent>
        <FieldLabel htmlFor="field-story-notify">Notify me</FieldLabel>
        <FieldDescription>
          Receive an email when a task is due.
        </FieldDescription>
      </FieldContent>
    </Field>
  ),
}

export const WithSeparator: Story = {
  render: () => (
    <FieldGroup className="w-80">
      <Field>
        <FieldLabel htmlFor="field-story-signin-email">Email</FieldLabel>
        <Input
          id="field-story-signin-email"
          type="email"
          placeholder="m@example.com"
        />
      </Field>
      <FieldSeparator>Or continue with</FieldSeparator>
      <Field>
        <Button variant="outline" type="button" className="w-full">
          Continue with GitHub
        </Button>
      </Field>
    </FieldGroup>
  ),
}
