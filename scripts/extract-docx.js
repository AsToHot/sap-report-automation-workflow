const fs = require('fs');
const zlib = require('zlib');

function extractTextFromDocx(docxPath) {
  const data = fs.readFileSync(docxPath);
  let offset = 0;
  while (offset < data.length - 30) {
    if (data.readUInt32LE(offset) !== 0x04034b50) break;
    const compSize = data.readUInt32LE(offset + 18);
    const nameLen = data.readUInt16LE(offset + 26);
    const extraLen = data.readUInt16LE(offset + 28);
    const name = data.toString('utf8', offset + 30, offset + 30 + nameLen);
    const compData = data.subarray(offset + 30 + nameLen + extraLen, offset + 30 + nameLen + extraLen + compSize);
    if (name === 'word/document.xml') {
      const xml = zlib.inflateRawSync(compData).toString('utf8');
      let text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log(text);
      return;
    }
    offset += 30 + nameLen + extraLen + compSize;
  }
  throw new Error('word/document.xml not found');
}

const p = process.argv[2] || 'E:/项目资料-赢家/功能说明书/EE071 - 序时账_V1.2_20260325.docx';
extractTextFromDocx(p);
