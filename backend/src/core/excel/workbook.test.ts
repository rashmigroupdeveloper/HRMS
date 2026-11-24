import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { writeWorkbook, readFirstSheet } from './workbook.js'
import { writeReport } from './report.js'

const sheets = [{name:'Register',columns:[{header:'Code',key:'code',text:true,width:20},{header:'Day',key:'day',date:true},{header:'Remarks',key:'remarks',width:30}],rows:[{code:'0007',day:new Date('2026-11-24T00:00:00Z'),remarks:'=1+1'}]}]
async function load(bytes:Uint8Array){const book=new ExcelJS.Workbook();await book.xlsx.load(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer);return book}
describe('Excel review reports',()=>{
  it('preserves real headers, codes, dates and literal formula-like remarks, with printable review context',async()=>{
    const bytes=await writeReport(sheets,{title:'People & roles',preparedBy:'Reviewer 007',coverage:'Company A only',filters:[{label:'Status',value:'Active'}],exportedAt:new Date('2026-11-24T08:00:00Z')})
    const book=await load(bytes),sheet=book.getWorksheet('Register')!,review=book.getWorksheet('Review notes')!
    expect(sheet.getCell('A1').value).toBe('Code')
    expect(sheet.getCell('A2').value).toBe('0007')
    expect(sheet.getCell('A2').numFmt).toBe('@')
    expect(sheet.getCell('B2').value).toEqual(new Date('2026-11-24T00:00:00Z'))
    expect(sheet.getCell('C2').value).toBe('=1+1')
    expect(sheet.getCell('C2').type).toBe(ExcelJS.ValueType.String)
    expect(sheet.pageSetup.printTitlesRow).toBe('1:1')
    expect(sheet.pageSetup.printTitlesColumn).toBe('A:B')
    expect(sheet.pageSetup.printArea).toBe('A1:C2')
    expect(sheet.headerFooter.oddHeader).toContain('People && roles')
    expect(sheet.headerFooter.oddFooter).toContain('Page &P of &N')
    expect(review.getCell('B4').value).toBe('Company A only')
    expect(review.getCell('B5').value).toBe('Active')
    expect(review.getCell('B6').value).toBe('1')
    expect(review.getCell('B11').text).toContain('does not change records or approve requests')
    expect((await readFirstSheet(bytes)).rows[0]?.values.Code).toBe('0007')
  })
  it('prints wide registers across pages at a readable scale and avoids duplicate review-sheet names',async()=>{
    const wide={...sheets[0]!,columns:sheets[0]!.columns.map(c=>({...c,width:80})),name:'Review notes'}
    const book=await load(await writeReport([wide],{title:'Wide',preparedBy:'Tester',coverage:'Selected company and department filters. '.repeat(12)}))
    expect(book.worksheets[0]!.pageSetup.scale).toBe(85)
    expect(book.worksheets[0]!.pageSetup.fitToPage).toBe(false)
    expect(book.getWorksheet('Review notes 2')).toBeDefined()
    expect(book.getWorksheet('Review notes 2')!.getRow(4).height).toBeGreaterThan(45)
  })
  it('keeps import templates without review sheets or changed dropdown/header positions',async()=>{
    const book=await load(await writeWorkbook([{name:'Import',columns:[{header:'Code',key:'code',text:true},{header:'Status',key:'status',list:['Active','Retired']}],rows:[{code:'0001',status:'Active'}],dropdownRows:10}]))
    expect(book.worksheets.map(s=>s.name)).toEqual(['Lists','Import'])
    expect(book.getWorksheet('Lists')!.state).toBe('hidden')
    expect(book.getWorksheet('Import')!.getCell('B11').dataValidation.formulae).toEqual(['Lists!$A$1:$A$2'])
    expect(book.getWorksheet('Import')!.getCell('A1').value).toBe('Code')
  })
})
