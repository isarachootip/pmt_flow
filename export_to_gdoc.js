/**
 * export_to_gdoc.js
 * Converts user_manual.md → Google Doc via Google Docs API (OAuth 2.0)
 * Flow: Open browser for auth → paste code → create Google Doc
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');
const { google } = require('googleapis');

// ─── CONFIG ────────────────────────────────────────────────────────────────
// Using Google's universal "desktop" OAuth client (works for any Google account)
// This is the standard "Google OAuth Playground" approach for local scripts.
// Replace with your own Client ID/Secret from Google Cloud Console for production.
const CLIENT_ID     = process.env.GDOC_CLIENT_ID     || 'YOUR_CLIENT_ID';
const CLIENT_SECRET = process.env.GDOC_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const REDIRECT_URI  = 'http://localhost:8765/oauth2callback';
const SCOPES        = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file',
];

const MANUAL_PATH = path.join(
  'C:\\Users\\isara\\.gemini\\antigravity\\brain\\449a0fe4-4d0e-4266-b6be-07f40e3a6bc9',
  'user_manual.md'
);

// ─── MARKDOWN PARSER → Google Docs requests ────────────────────────────────
function markdownToRequests(markdown) {
  const lines    = markdown.split('\n');
  const requests = [];
  let   index    = 1; // insertion index (after doc start)

  function insertText(text, style = null) {
    const req = {
      insertText: {
        location: { index },
        text: text + '\n',
      },
    };
    requests.push(req);

    if (style) {
      requests.push({
        updateParagraphStyle: {
          range: {
            startIndex: index,
            endIndex:   index + text.length + 1,
          },
          paragraphStyle: { namedStyleType: style },
          fields: 'namedStyleType',
        },
      });
    }
    index += text.length + 1;
  }

  function insertBold(text) {
    requests.push({ insertText: { location: { index }, text: text + '\n' } });
    requests.push({
      updateTextStyle: {
        range: { startIndex: index, endIndex: index + text.length },
        textStyle: { bold: true, fontSize: { magnitude: 11, unit: 'PT' } },
        fields: 'bold,fontSize',
      },
    });
    index += text.length + 1;
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Headings
    if (line.startsWith('# ')) {
      insertText(line.slice(2), 'HEADING_1');
    } else if (line.startsWith('## ')) {
      insertText(line.slice(3), 'HEADING_2');
    } else if (line.startsWith('### ')) {
      insertText(line.slice(4), 'HEADING_3');
    } else if (line.startsWith('#### ')) {
      insertText(line.slice(5), 'HEADING_4');
    }

    // Bold lines (e.g. **text**)
    else if (/^\*\*(.+)\*\*$/.test(line)) {
      insertBold(line.replace(/\*\*/g, ''));
    }

    // Horizontal rule
    else if (/^---+$/.test(line)) {
      insertText('─'.repeat(60));
    }

    // Mermaid / code blocks — skip diagram syntax, show as note
    else if (line.startsWith('```')) {
      insertText('[ดู Diagram ในระบบ PMT หรือ REQUIREMENTS.md]');
    }

    // Bullet/numbered list
    else if (/^[\*\-]\s+/.test(line)) {
      const text = line.replace(/^[\*\-]\s+/, '• ').replace(/\*\*/g, '');
      insertText(text);
    } else if (/^\d+\.\s+/.test(line)) {
      const text = line.replace(/\*\*/g, '');
      insertText(text);
    }

    // Table rows — convert to plain text
    else if (line.startsWith('|')) {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map(c => c.trim())
        .join('  │  ');
      if (!/^[\s\|:\-]+$/.test(line)) {
        insertText(cells);
      }
    }

    // Normal paragraph
    else if (line.length > 0) {
      const clean = line.replace(/\*\*/g, '').replace(/\*/g, '');
      insertText(clean);
    }

    // Empty line
    else {
      insertText('');
    }
  }

  return requests;
}

// ─── OAUTH + CREATE DOC ────────────────────────────────────────────────────
async function getAuthToken(oauth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    // Start local callback server
    const server = http.createServer(async (req, res) => {
      try {
        const urlObj = new URL(req.url, 'http://localhost:8765');
        const code   = urlObj.searchParams.get('code');
        if (!code) {
          res.end('No code found. Please try again.');
          return;
        }
        res.end(`
          <html><body style="font-family:sans-serif;padding:40px;text-align:center">
          <h2>✅ Authorization Successful!</h2>
          <p>คุณสามารถปิด Tab นี้ได้แล้ว ระบบกำลังสร้าง Google Doc...</p>
          </body></html>
        `);
        server.close();
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        resolve(oauth2Client);
      } catch (err) {
        reject(err);
      }
    });

    server.listen(8765, () => {
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('📋 เปิด Browser แล้วไปที่ URL ด้านล่างเพื่อ Authorize:');
      console.log('═══════════════════════════════════════════════════════');
      console.log('\n' + authUrl + '\n');
      console.log('═══════════════════════════════════════════════════════');
      console.log('⏳ รอการ Authorize จาก Browser...');

      // Auto-open browser
      try {
        require('child_process').exec(`start "" "${authUrl}"`);
      } catch(e) {}
    });
  });
}

async function main() {
  if (CLIENT_ID === 'YOUR_CLIENT_ID') {
    console.error('\n❌ กรุณาตั้งค่า Environment Variables ก่อนรัน:');
    console.error('   $env:GDOC_CLIENT_ID     = "your-client-id"');
    console.error('   $env:GDOC_CLIENT_SECRET = "your-client-secret"\n');
    console.error('ดูวิธีสร้าง OAuth Client ID ได้ที่: https://console.cloud.google.com/apis/credentials\n');
    process.exit(1);
  }

  console.log('\n🚀 SPMT PMT — Export user_manual.md → Google Doc');
  console.log('─'.repeat(60));

  const markdown = fs.readFileSync(MANUAL_PATH, 'utf8');
  console.log(`✅ อ่านไฟล์สำเร็จ: ${markdown.split('\n').length} บรรทัด`);

  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  console.log('\n🔐 กำลังเปิด Browser สำหรับ Google Login...');
  const authClient = await getAuthToken(oauth2Client);

  console.log('\n✅ Authorized สำเร็จ! กำลังสร้าง Google Doc...');

  const docs  = google.docs({ version: 'v1', auth: authClient });
  const drive = google.drive({ version: 'v3', auth: authClient });

  // Create blank Google Doc
  const created = await docs.documents.create({
    requestBody: { title: 'คู่มือการใช้งานระบบ PMT (SPMT) v1.0 — กันยายน 2569' },
  });
  const docId = created.data.documentId;
  console.log(`✅ สร้างเอกสารสำเร็จ: ${docId}`);

  // Build content requests from markdown
  const requests = markdownToRequests(markdown);
  console.log(`📝 กำลังเขียนเนื้อหา (${requests.length} operations)...`);

  // Batch update in chunks of 500
  const CHUNK = 500;
  for (let i = 0; i < requests.length; i += CHUNK) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests: requests.slice(i, i + CHUNK) },
    });
    process.stdout.write(`   ${Math.min(i + CHUNK, requests.length)}/${requests.length} done\r`);
  }

  // Make document viewable by anyone with link
  await drive.permissions.create({
    fileId: docId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('🎉 สร้าง Google Doc สำเร็จ!');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📄 Document ID : ${docId}`);
  console.log(`🔗 เปิดได้ที่  : ${docUrl}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Auto-open result
  try { require('child_process').exec(`start "" "${docUrl}"`); } catch(e) {}
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
