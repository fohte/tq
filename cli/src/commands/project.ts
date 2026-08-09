import {
  createProjectSchema,
  listProjectsQuerySchema,
  updateProjectSchema,
} from 'api/schemas/project'
import type { Command } from 'commander'
import type { InferRequestType } from 'hono/client'

import type { Client } from '#client'
import { toApiError } from '#client'
import { buildClient } from '#command-context'
import { printJson, printJsonList } from '#output'
import { addSchemaOptions, pickSchemaFields } from '#schema-options'

type ListProjectsQuery = InferRequestType<
  Client['api']['projects']['$get']
>['query']

type CreateProjectJson = InferRequestType<
  Client['api']['projects']['$post']
>['json']

type UpdateProjectJson = InferRequestType<
  Client['api']['projects'][':id']['$patch']
>['json']

export function registerProjectCommands(
  program: Command,
  fetchImpl: typeof fetch,
): void {
  const project = program.command('project').description('Manage projects')

  addSchemaOptions(
    project
      .command('list')
      .description('List projects')
      .option('--full', 'Include full project description in the output'),
    listProjectsQuerySchema,
  ).action(
    async (
      options: Record<string, unknown> & { full?: boolean },
      command: Command,
    ) => {
      const client = buildClient(command, fetchImpl)
      const query: ListProjectsQuery = pickSchemaFields(
        listProjectsQuerySchema,
        options,
      )
      const res = await client.api.projects.$get({ query })
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the route only declares a 200 response, so `res.ok` is always true at the type level; kept as a defense against status codes (e.g. from a proxy in front of the API) the client types don't know about
      if (!res.ok) throw await toApiError(res)
      printJsonList(await res.json(), 'description', { full: options.full })
    },
  )

  project
    .command('get <id>')
    .description('Get a project')
    .action(async (id: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl)
      const res = await client.api.projects[':id'].$get({ param: { id } })
      if (!res.ok) throw await toApiError(res)
      printJson(await res.json())
    })

  addSchemaOptions(
    project.command('create <title>').description('Create a project'),
    createProjectSchema,
    ['title'],
  ).action(
    async (
      title: string,
      options: Record<string, unknown>,
      command: Command,
    ) => {
      const client = buildClient(command, fetchImpl)
      const json: CreateProjectJson = {
        ...pickSchemaFields(createProjectSchema, options, ['title']),
        title,
      }
      const res = await client.api.projects.$post({ json })
      if (!res.ok) throw await toApiError(res)
      printJson(await res.json())
    },
  )

  addSchemaOptions(
    project.command('update <id>').description('Update a project'),
    updateProjectSchema,
  ).action(
    async (id: string, options: Record<string, unknown>, command: Command) => {
      const client = buildClient(command, fetchImpl)
      const json: UpdateProjectJson = pickSchemaFields(
        updateProjectSchema,
        options,
      )
      const res = await client.api.projects[':id'].$patch({
        param: { id },
        json,
      })
      if (!res.ok) throw await toApiError(res)
      printJson(await res.json())
    },
  )

  project
    .command('delete <id>')
    .description('Delete a project')
    .action(async (id: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl)
      const res = await client.api.projects[':id'].$delete({ param: { id } })
      if (!res.ok) throw await toApiError(res)
      printJson({ deleted: true, id })
    })

  project
    .command('tasks <id>')
    .description('List tasks in a project')
    .option('--full', 'Include full task description in the output')
    .action(
      async (id: string, options: { full?: boolean }, command: Command) => {
        const client = buildClient(command, fetchImpl)
        // GET /api/tasks?projectId= filters by equality without checking the
        // project exists, so a bogus id would otherwise silently print `[]`
        // instead of surfacing the same 404 the old dedicated endpoint gave.
        const projectRes = await client.api.projects[':id'].$get({
          param: { id },
        })
        if (!projectRes.ok) throw await toApiError(projectRes)

        const res = await client.api.tasks.$get({ query: { projectId: id } })
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the route only declares a 200 response, so `res.ok` is always true at the type level; kept as a defense against status codes (e.g. from a proxy in front of the API) the client types don't know about
        if (!res.ok) throw await toApiError(res)
        printJsonList(await res.json(), 'description', { full: options.full })
      },
    )
}
