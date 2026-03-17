import { describe, it, expect } from 'vitest'
import * as solver from '../src/geometry/solver'
import * as canon from '../src/geometry/canonicalization'
import * as extract from '../src/geometry/extraction'

describe('imports', () => {
  it('solver exports', () => { console.log('solver:', Object.keys(solver)); expect(typeof solver.solve).toBe('function') })
  it('canon exports', () => { console.log('canon:', Object.keys(canon)); expect(typeof canon.canonicalise).toBe('function') })
  it('extract exports', () => { console.log('extract:', Object.keys(extract)); expect(typeof extract.extractProblem).toBe('function') })
})
