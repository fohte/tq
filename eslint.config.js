import { config } from '@fohte/eslint-config'
import storybook from 'eslint-plugin-storybook'
import tailwindcss from 'eslint-plugin-tailwindcss'

// Matches a Tailwind arbitrary *value* token (e.g. `w-[600px]`,
// `grid-cols-[14px_1fr]`) — the bracket sits right before the end of the
// token (optionally followed by `!`). Deliberately does not match arbitrary
// *variants* (e.g. `data-[state=open]:hidden`, `[&_svg]:size-4`,
// `group-[.is-open]:block`), where the bracket is either not preceded by a
// dash or is followed by `:` rather than the end of the token.
const ARBITRARY_VALUE_PATTERN = String.raw`-\[[^\]]+\]!?(?=\s|$)`

export default config(
  {
    typescript: { typeChecked: true },
    errorHandling: {},
  },
  {
    ignores: ['**/routeTree.gen.ts'],
  },
  ...storybook.configs['flat/recommended'],
  // no-restricted-syntax (throw/try-catch ban) is enforced only in api/,
  // including api's own config files (drizzle.config.ts, tsup.config.ts,
  // vitest.config.ts) — not just api/src. cli/ and web/ still throw, since
  // cli's command handlers run through commander's throw-based flow and
  // web hasn't moved off throw/try-catch.
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['api/**/*.ts', 'api/**/*.tsx'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  // neverthrow/must-use-result is enforced wherever code returns a Result:
  // api/ everywhere, and cli/'s shared helpers (cli/src/*.ts) which already
  // return Result. cli/src/commands/**, which still calls those helpers
  // through the throw-based unwrap()/unwrapAsync() wrappers in
  // cli/src/result.ts, and web/, which hasn't adopted neverthrow, keep it
  // off; enable it there once that code returns Result directly.
  {
    files: ['cli/src/commands/**/*.ts', 'web/**/*.ts', 'web/**/*.tsx'],
    rules: {
      'neverthrow/must-use-result': 'off',
    },
  },
  // vite.config.ts/vitest.config.ts are loaded through Vite's own
  // esbuild-based config loader, which doesn't resolve the package.json
  // "imports" field, unlike the Rollup pipeline that bundles the app itself.
  {
    files: ['web/vite.config.ts', 'web/vitest.config.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  // Keep web/ on design tokens (see docs/design-system.md) instead of
  // Tailwind arbitrary values. This must come after the no-restricted-syntax
  // 'off' block above, or it would be turned back off for web/.
  {
    files: ['web/**/*.ts', 'web/**/*.tsx'],
    plugins: { tailwindcss },
    settings: {
      tailwindcss: {
        cssConfigPath: 'web/src/index.css',
      },
    },
    rules: {
      'tailwindcss/no-arbitrary-value': 'error',
      // no-arbitrary-value only checks class attributes/functions, so a
      // bracket value stashed in a bare string constant (then interpolated
      // into className) would otherwise slip through undetected.
      'no-restricted-syntax': [
        'error',
        {
          // TemplateElement covers backtick strings (e.g. `` `w-[600px]` ``)
          // with no interpolation — those parse as a template literal, not a
          // plain Literal node, and would otherwise bypass this check.
          selector: `:matches(Literal[value=/${ARBITRARY_VALUE_PATTERN}/], TemplateElement[value.raw=/${ARBITRARY_VALUE_PATTERN}/])`,
          message:
            'Arbitrary Tailwind values are not allowed, including inside string constants. Add a token to `@theme` in web/src/index.css instead (see docs/design-system.md).',
        },
      ],
    },
  },
)
