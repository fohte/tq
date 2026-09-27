import type { OperationDefinition } from 'api/operations'

type OperationGroup = {
  firstIndex: number
  operations: OperationDefinition[]
}

export type OrderedOperationGroup = {
  groupName: string
  groupOperations: OperationDefinition[]
  groupDescription: string | undefined
}

export function getOrderedOperationGroups(
  operations: readonly OperationDefinition[],
): OrderedOperationGroup[] {
  const cliOperations = operations.filter(
    (operation) => operation.surface?.only !== 'mcp',
  )
  const groups = new Map<string, OperationGroup>()

  cliOperations.forEach((operation, index) => {
    const groupName = (operation.cli.path ?? operation.path)[0]
    if (groupName === undefined) return
    const group = groups.get(groupName)
    if (group == null) {
      groups.set(groupName, { firstIndex: index, operations: [operation] })
      return
    }
    group.operations.push(operation)
  })

  const groupOrder = (group: OperationGroup) =>
    group.operations.find((operation) => operation.cli.group?.order != null)
      ?.cli.group?.order ?? group.firstIndex
  const orderedGroups = [...groups.entries()].sort(
    ([, left], [, right]) => groupOrder(left) - groupOrder(right),
  )

  return orderedGroups.map(([groupName, groupDefinition]) => {
    const groupOperations = groupDefinition.operations
      .map((operation, index) => ({ operation, index }))
      .sort(
        (left, right) =>
          (left.operation.cli.commandOrder ?? left.index) -
          (right.operation.cli.commandOrder ?? right.index),
      )
      .map(({ operation }) => operation)
    const groupDescription =
      groupOperations.find(
        (operation) => operation.cli.group?.description != null,
      )?.cli.group?.description ??
      groupOperations[0]?.cli.description ??
      groupOperations[0]?.description

    return { groupName, groupOperations, groupDescription }
  })
}
