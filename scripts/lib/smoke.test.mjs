import { describe, it, expect } from 'vitest'
import { checkResponse } from './smoke.mjs'

const html = { status: 200, contentTypePrefix: 'text/html' }

describe('checkResponse', () => {
  it('passes a 200 text/html response for the SPA', () => {
    expect(checkResponse('https://eypi.cc/', { status: 200, contentType: 'text/html; charset=utf-8' }, html)).toBeNull()
  })
  it('fails on a 500', () => {
    expect(checkResponse('https://eypi.cc/', { status: 500, contentType: 'text/html' }, html)).toMatch(/500/)
  })
  it('fails when the content type is wrong', () => {
    expect(checkResponse('https://eypi.cc/', { status: 200, contentType: 'text/plain' }, html)).toMatch(/text\/html/)
  })
})
