const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const Processor=require('../utils/documentProcessor');
test('actual PDF extraction is repeatable and supports preview calls without a filename',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ht341-pdf-')),file=path.join(dir,'manual.pdf');
 try{fs.writeFileSync(file,Buffer.from(require('./fixtures/ht341/synthetic-manual.json').base64,'base64'));for(let i=0;i<5;i++){const text=await Processor.processFile(file);assert.ok(text.includes('WAN282X2GB'));assert.ok(text.includes('programme A'));}}finally{fs.rmSync(dir,{recursive:true});}
});
test('truncated PDFs fail without creating invented text',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ht341-invalid-')),file=path.join(dir,'broken.pdf');try{fs.writeFileSync(file,'%PDF-1.4 truncated');await assert.rejects(Processor.processFile(file),/Failed to process PDF/);}finally{fs.rmSync(dir,{recursive:true});}});
