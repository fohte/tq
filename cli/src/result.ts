import type { Command } from 'commander'
import { Result } from 'neverthrow'

import { formatError } from '#errors'

export const tryParseJson = Result.fromThrowable((text: string): unknown =>
  JSON.parse(text),
)

// commands/*.ts action handlers propagate failures through commander's own
// exit flow: Command#error() writes the message and throws internally (via
// exitOverride), which cli.ts's parseAsync rejection handler turns into the
// process exit code. A Result's error is routed into that flow by matching
// on it at the call site (`result.match(v => v, e => fail(command, e))`) —
// `neverthrow/must-use-result` only recognizes match()/isOk()/isErr() called
// directly on a Result, not passed through a wrapper function, so there's no
// generic `unwrap()` helper here.
export function fail(command: Command, error: Error): never {
  return command.error(`Error: ${formatError(error)}`)
}
