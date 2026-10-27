import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('quotes RFC 4180 fields and prefixes formula characters', () => {
    expect(toCsv([['=1+1', 'a,b', 'he said "hi"']])).toBe('\'=1+1,"a,b","he said ""hi"""\r\n')
  })

  it('prefixes + - and @ before quoting a comma', () => {
    expect(toCsv([['+1', '-2', '@cmd']])).toBe("'+1,'-2,'@cmd\r\n")
    expect(toCsv([['+1,2']])).toBe('"\'+1,2"\r\n')
  })

  it('prefixes a leading tab or carriage return', () => {
    expect(toCsv([['\tcmd']])).toBe("'\tcmd\r\n")
    expect(toCsv([['\rcmd']])).toBe('"\'\rcmd"\r\n')
  })

  it('quotes a cell that contains a newline', () => {
    expect(toCsv([['line\nbreak']])).toBe('"line\nbreak"\r\n')
  })
})
