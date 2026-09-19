import { describe, expect, it } from 'vitest'
import { factUpdate, patientUpdate, type FactFormValues } from './caseFormValues'

const fact: FactFormValues = {
  key: 'vital.pulse',
  label: 'Pulse',
  value: 0,
  unit: '',
  assertion: 'present',
  provenance: 'manual',
  confirmed: false,
  order_status: 'not_applicable',
}

describe('patient editor request compatibility', () => {
  it('keeps zero values, superseded fact identity, expected version and null missing fields', () => {
    expect(factUpdate({ version: 6 }, { id: 'original-fact' }, fact)).toEqual({
      expected_version: 6,
      supersedes: ['original-fact'],
      facts: [
        {
          ...fact,
          value: 0,
          unit: null,
          event_time: null,
          available_time: null,
          source_id: null,
          span: null,
        },
      ],
    })
  })

  it.each(['page:3', 'excerpt:Quoted evidence', 'Quoted evidence'])(
    'preserves source locators when saving an evidence-backed fact (%s)',
    (span) => {
      const update = factUpdate({ version: 2 }, null, {
        ...fact,
        source_id: 'source-1',
        span,
        event_time: '2026-09-18T09:15:00+05:00',
      })
      expect(update.supersedes).toEqual([])
      expect(update.facts[0]).toMatchObject({
        source_id: 'source-1',
        span: span.includes(':') ? span : `excerpt:${span}`,
        event_time: '2026-09-18T04:15:00.000Z',
      })
    },
  )

  it('does not invent a full name for a legacy patient and preserves unknown age', () => {
    expect(
      patientUpdate(
        { version: 3, full_name: '' },
        { full_name: '  ', summary: '  Original note.  ', patient_phone: '  +998 90 123 45 67  ' },
      ),
    ).toEqual({
      expected_version: 3,
      age: null,
      sex: 'unknown',
      patient_phone: '+998 90 123 45 67',
      summary: 'Original note.',
    })
  })

  it('saves a supplied name and retains zero age', () => {
    expect(
      patientUpdate(
        { version: 3, full_name: '' },
        { full_name: '  Patient Name  ', age: 0, sex: 'female' },
      ),
    ).toMatchObject({ full_name: 'Patient Name', age: 0, sex: 'female', expected_version: 3 })
  })
})
