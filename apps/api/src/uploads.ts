import path from 'node:path'

export const MAX_LOGO_BYTES=5*1024*1024
export type LogoExtension='png'|'jpg'|'webp'

export function logoExtension(buffer:Buffer):LogoExtension|null{
  if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return'png'
  if(buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return'jpg'
  if(buffer.length>=12&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP')return'webp'
  return null
}

export function storedLogoPath(uploadRoot:string,logoUrl:string|null|undefined):string|null{
  if(!logoUrl?.startsWith('/uploads/team-logos/'))return null
  const filename=path.basename(logoUrl)
  if(!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(filename))return null
  return path.join(uploadRoot,'team-logos',filename)
}
