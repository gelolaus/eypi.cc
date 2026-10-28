import { describe, expect, it } from 'vitest'
import { renderEventMarkdown } from './markdownHtml'

// Descriptions are capped at 4,000 characters, so every input is cut to that length.
const N = 4000
const rep = (s: string) => s.repeat(N).slice(0, N)
const inputs: Record<string, string> = {
  heading: '# a' + ' '.repeat(3990) + 'x',
  headingTabs: '# a' + '\t'.repeat(3990) + 'x',
  headingHashes: '# a ' + '#'.repeat(N - 8) + ' x',
  hashSpaces: rep('# '),
  stars: rep('*'),
  starsText: rep('*a '),
  underscores: rep('_'),
  underscoreWords: rep('_a'),
  misnestedEmphasis: rep('**a*b'),
  brackets: rep('['),
  bracketLinks: rep('[a]('),
  bracketNoClose: '[' + 'a'.repeat(N),
  parens: rep('('),
  backticks: rep('`'),
  backtickSpans: rep('`a'),
  quotes: rep('>'),
  quoteSpaced: rep('> '),
  dashes: rep('-'),
  dashSpaces: rep('- '),
  digits: rep('1'),
  numbered: rep('1. '),
  bangs: rep('!['),
  mixed: rep('*_[`>-1.# (!'),
  manyLines: rep('- a\n'),
  fence: '```\n' + rep('a\n'),
  spaces: ' '.repeat(N),
  spacesThenText: ' '.repeat(N - 1) + 'x',
}

describe('renderEventMarkdown pathological input', () => {
  for (const [name, input] of Object.entries(inputs)) {
    it(`renders ${name} quickly`, () => {
      const start = performance.now()
      renderEventMarkdown(input)
      expect(performance.now() - start).toBeLessThan(50)
    })
  }
})
