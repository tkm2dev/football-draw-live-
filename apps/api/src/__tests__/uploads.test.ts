import {describe,expect,it} from 'vitest'
import {logoExtension,storedLogoPath} from '../uploads.js'

describe('team logo upload validation',()=>{
  it('detects supported image signatures instead of trusting the filename',()=>{
    expect(logoExtension(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))).toBe('png')
    expect(logoExtension(Buffer.from([0xff,0xd8,0xff,0xe0]))).toBe('jpg')
    expect(logoExtension(Buffer.from('RIFF0000WEBP','ascii'))).toBe('webp')
    expect(logoExtension(Buffer.from('<svg></svg>'))).toBeNull()
  })

  it('only resolves application-owned logo paths',()=>{
    expect(storedLogoPath('/srv/uploads','/uploads/team-logos/550e8400-e29b-41d4-a716-446655440000.png')).toMatch(/team-logos/)
    expect(storedLogoPath('/srv/uploads','/uploads/team-logos/../../secret.png')).toBeNull()
    expect(storedLogoPath('/srv/uploads','https://example.com/logo.png')).toBeNull()
  })
})
