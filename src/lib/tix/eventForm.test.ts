import { describe, expect, it } from 'vitest'
import {
  DESCRIPTION_MAX, QUESTIONS_MAX, blankForm, formFromEvent, manilaLocalToIso, newQuestion, slugFromName,
  storedUtcToManilaLocal, toPayload, validateForm,
} from './eventForm'

const valid = () => ({ ...blankForm(), name: 'Launch', slug: 'launch', date: '2099-01-01', time: '09:00', location: 'Hall' })

describe('eventForm', () => {
  it('turns a name into a slug of lowercase letters and digits', () => {
    expect(slugFromName('BWAI 2026: Launch!')).toBe('bwai2026launch')
  })

  it('converts between Manila local time and stored UTC', () => {
    expect(manilaLocalToIso('2099-01-01T09:00')).toBe('2099-01-01T09:00:00+08:00')
    expect(storedUtcToManilaLocal('2099-01-01 00:00:00')).toBe('2099-01-01T08:00')
    expect(storedUtcToManilaLocal('2099-01-01 20:30:00')).toBe('2099-01-02T04:30')
    expect(storedUtcToManilaLocal(null)).toBe('')
  })

  it('accepts a complete form', () => {
    expect(validateForm(valid())).toEqual({})
  })

  it('requires the basics and a slug of lowercase letters and digits', () => {
    const errors = validateForm({ ...blankForm(), slug: 'Bad-Slug' })
    expect(Object.keys(errors).sort()).toEqual(['date', 'location', 'name', 'slug', 'time'])
    expect(validateForm({ ...valid(), slug: 'a'.repeat(61) }).slug).toBeTruthy()
  })

  it('caps the description and checks capacity and the window', () => {
    expect(validateForm({ ...valid(), description: 'x'.repeat(DESCRIPTION_MAX + 1) }).description).toBeTruthy()
    expect(validateForm({ ...valid(), capacity: '0' }).capacity).toBeTruthy()
    expect(validateForm({ ...valid(), capacity: '1.5' }).capacity).toBeTruthy()
    expect(validateForm({ ...valid(), capacity: '25' }).capacity).toBeUndefined()
    expect(validateForm({ ...valid(), admissionMode: 'lottery', closesAt: '' }).closesAt).toBe('A lottery needs a closing time.')
    expect(validateForm({ ...valid(), admissionMode: 'lottery', closesAt: '2099-01-01T09:00' }).closesAt).toBeUndefined()
    expect(validateForm({ ...valid(), admissionMode: 'fcfs', closesAt: '' }).closesAt).toBeUndefined()
    const window = validateForm({ ...valid(), opensAt: '2099-01-02T09:00', closesAt: '2099-01-02T09:00' })
    expect(window.closesAt).toBe('Registration must close after it opens.')
  })

  it('checks questions like the API', () => {
    const many = Array.from({ length: QUESTIONS_MAX + 1 }, (_, i) => ({ ...newQuestion(), label: `Q${i}` }))
    expect(validateForm({ ...valid(), questions: many }).questions).toBeTruthy()
    const choice = { ...newQuestion(), label: 'Diet', type: 'choice' as const, options: [] }
    expect(validateForm({ ...valid(), questions: [choice] }).questions).toContain('option')
    expect(validateForm({ ...valid(), questions: [{ ...choice, options: ['A', 'A'] }] }).questions).toContain('different')
    expect(validateForm({ ...valid(), questions: [{ ...newQuestion(), label: '  ' }] }).questions).toContain('label')
  })

  it('skips window, waitlist and questions for import events', () => {
    const form = { ...valid(), admissionMode: 'import' as const, waitlistEnabled: true, closesAt: '2099-01-01T00:00', opensAt: '2099-01-02T00:00', questions: [{ ...newQuestion(), label: '' }] }
    expect(validateForm(form)).toEqual({})
    const body = toPayload(form)
    expect(body).toMatchObject({ waitlistEnabled: false, registrationOpensAt: null, registrationClosesAt: null, questions: [] })
  })

  it('builds the API payload', () => {
    const body = toPayload({
      ...valid(), endTime: '11:00', description: '  hi ', capacity: '40', admissionMode: 'lottery', visibility: 'public',
      waitlistEnabled: true, opensAt: '2099-01-01T08:00', questions: [{ id: 'q1', label: ' Diet ', type: 'choice', options: [' None ', 'Vegan'], required: true }],
    })
    expect(body).toEqual({
      name: 'Launch', slug: 'launch', date: '2099-01-01', time: '09:00', endTime: '11:00', location: 'Hall', description: 'hi',
      admissionMode: 'lottery', visibility: 'public', capacity: 40, waitlistEnabled: true,
      registrationOpensAt: '2099-01-01T08:00:00+08:00', registrationClosesAt: null,
      questions: [{ id: 'q1', label: 'Diet', type: 'choice', options: ['None', 'Vegan'], required: true }],
    })
  })

  it('loads an event from the org view', () => {
    const form = formFromEvent({
      slug: 'launch', name: 'Launch', eventDate: '2099-01-01', eventTime: '09:00', endTime: null, location: 'Hall',
      description: null, admissionMode: 'approval', visibility: 'unlisted', capacity: 10, waitlistEnabled: false,
      registrationOpensAt: '2099-01-01 00:00:00', registrationClosesAt: null, questions: [{ id: 'a', label: 'Why', type: 'text' }],
    })
    expect(form).toMatchObject({ slug: 'launch', capacity: '10', opensAt: '2099-01-01T08:00', closesAt: '', admissionMode: 'approval' })
    expect(form.questions[0]).toEqual({ id: 'a', label: 'Why', type: 'text', options: [], required: false })
  })
})
