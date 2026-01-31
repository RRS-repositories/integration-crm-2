/**
 * LOA & Cover Letter PDF Generator - Google Apps Script v2
 * FIXED VERSION with proper timing and file handling
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Generate LOA PDF
    const loaResult = generatePDF(data, 'LOA');

    // Generate Cover Letter PDF (skip for Gambling)
    let coverLetterResult = null;
    if (data.lender_type && data.lender_type.toUpperCase() !== 'GAMBLING') {
      coverLetterResult = generatePDF(data, 'COVER_LETTER');
    }

    // Return FLAT structure for Zapier compatibility
    // Using download URLs so Zapier S3 can fetch the file
    const response = {
      success: true,
      loa_filename: loaResult.filename,
      loa_download_url: loaResult.download_url,
      loa_file_id: loaResult.file_id,
      loa_size_bytes: loaResult.size_bytes,
      cover_letter_filename: coverLetterResult ? coverLetterResult.filename : '',
      cover_letter_download_url: coverLetterResult ? coverLetterResult.download_url : '',
      cover_letter_file_id: coverLetterResult ? coverLetterResult.file_id : '',
      cover_letter_size_bytes: coverLetterResult ? coverLetterResult.size_bytes : 0
    };

    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString(),
      stack: error.stack
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function generatePDF(data, type) {
  // Create a temporary Google Doc
  const docName = `TEMP_${data.contact_id}_${data.lender_type}_${type}_${Date.now()}`;
  const doc = DocumentApp.create(docName);
  const docId = doc.getId();

  try {
    const body = doc.getBody();

    if (type === 'LOA') {
      buildLOADocument(body, data);
    } else {
      buildCoverLetterDocument(body, data);
    }

    // IMPORTANT: Save and close the document BEFORE converting
    doc.saveAndClose();

    // Wait a moment for Google to process (helps with timing issues)
    Utilities.sleep(1000);

    // Get the file from Drive
    const docFile = DriveApp.getFileById(docId);

    // Convert to PDF using the correct method
    const pdfBlob = docFile.getAs(MimeType.PDF);
    const filename = `${data.contact_id}_${data.lender_type}_${type}.pdf`;
    pdfBlob.setName(filename);

    // Get PDF bytes for size
    const pdfBytes = pdfBlob.getBytes();

    // Save PDF to Drive
    const pdfFile = DriveApp.createFile(pdfBlob);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Delete the temporary Google Doc (keep PDF)
    docFile.setTrashed(true);

    // Create download URL - Zapier can use this to download and upload to S3
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${pdfFile.getId()}`;

    return {
      filename: filename,
      file_id: pdfFile.getId(),
      download_url: downloadUrl,
      size_bytes: pdfBytes.length
    };

  } catch (err) {
    // Cleanup on error
    try {
      DriveApp.getFileById(docId).setTrashed(true);
    } catch (e) {
      // Ignore cleanup errors
    }
    throw new Error(`PDF generation failed for ${type}: ${err.message}`);
  }
}

function buildLOADocument(body, data) {
  // Clear any default content
  body.clear();

  // Set page margins
  body.setMarginTop(40);
  body.setMarginBottom(40);
  body.setMarginLeft(50);
  body.setMarginRight(50);

  // === HEADER ===
  const headerTable = body.appendTable();
  const headerRow = headerTable.appendTableRow();

  // Logo cell
  const logoCell = headerRow.appendTableCell('FAST ACTION CLAIMS');
  logoCell.setWidth(200);
  logoCell.getChild(0).asParagraph()
    .setFontSize(16)
    .setBold(true)
    .setForegroundColor('#b45f06');

  // Contact cell
  const contactCell = headerRow.appendTableCell(
    'Fast Action Claims\n' +
    'Tel: 0161 5331706\n' +
    '1.03 The boat shed, 12 Exchange Quay\n' +
    'Salford, M5 3EQ\n' +
    'irl@rowanrose.co.uk'
  );
  contactCell.getChild(0).asParagraph()
    .setAlignment(DocumentApp.HorizontalAlignment.RIGHT)
    .setFontSize(9);

  headerTable.setBorderWidth(0);

  body.appendParagraph('').setSpacingAfter(10);

  // === TITLE ===
  const title = body.appendParagraph('LETTER OF AUTHORITY');
  title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  title.setFontSize(16);
  title.setBold(true);

  // Add underline effect with a line
  body.appendParagraph('________________________________________')
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
    .setFontSize(8);

  body.appendParagraph('').setSpacingAfter(10);

  // === LENDER ===
  const lenderPara = body.appendParagraph('IN RESPECT OF: ' + (data.lender_type || 'N/A'));
  lenderPara.setFontSize(12);
  lenderPara.setBold(true);

  body.appendParagraph('').setSpacingAfter(5);

  // === CLIENT INFO TABLE ===
  const clientData = [
    ['Full Name:', data.full_name || ''],
    ['Address:', (data.street_address || '') + ', ' + (data.city || '')],
    ['Postal Code:', data.postal_code || ''],
    ['Date of Birth:', data.date_of_birth || ''],
    ['Previous Address:', data.previous_address || 'N/A']
  ];

  const clientTable = body.appendTable(clientData);
  clientTable.setBorderWidth(1);

  for (let i = 0; i < clientTable.getNumRows(); i++) {
    const row = clientTable.getRow(i);
    // Label cell
    row.getCell(0).setWidth(120);
    row.getCell(0).setBackgroundColor('#f0f0f0');
    row.getCell(0).getChild(0).asParagraph().setBold(true).setFontSize(10);
    // Value cell
    row.getCell(1).getChild(0).asParagraph().setFontSize(10);
  }

  body.appendParagraph('').setSpacingAfter(10);

  // === LEGAL TEXT ===
  const legalIntro = body.appendParagraph(
    'I/We hereby Authorise and instruct: You (The Bank/Door Step Lender/Building Society/Card Provider/Finance Provider/Loan Broker/Underwriter/Insurance Provider/Financial Advisor/Pension Provider/Catalogue Loans provider/Mortgage Broker/HMRC) to:'
  );
  legalIntro.setFontSize(9);
  legalIntro.setBold(true);

  body.appendParagraph('').setSpacingAfter(5);

  const points = [
    '1. Liaise exclusively with Fast Action Claims in respect of all aspects of my/our potential complaint/claim for compensation as stated above.',
    '2. Immediately release to Fast Action Claims any information/documentation relating to all my/our loans/credit cards/overdrafts/Store Cards/Car Finance/Packaged Bank Account/ to include all Broker Commissions, Tax deductions which may be requested. This includes information in response to a request made under Sections 77-78 of the Consumer Credit Act 1974 and/or Section 45 of the Data Protection Act 2018 and Article 15 GDPR.',
    '3. Contact Fast Action Claims whenever they need to send me/us information or contact me/us in connection with this matter.'
  ];

  points.forEach(point => {
    const p = body.appendParagraph(point);
    p.setFontSize(9);
    p.setSpacingAfter(5);
  });

  const authPara = body.appendParagraph(
    'I/We authorise Fast Action Claims of 1.03, 12 Exchange Quay, Salford, M5 3EQ as my/our sole representatives to deal with my potential complaint/claim for compensation in relation to all loans/credit cards/car finance/overdrafts/Packaged Bank Accounts/Store Cards. I/We confirm that Fast Action Claims are instructed to pursue all aspects they consider necessary in relation to my/our dealings with your organisation. This letter of authority relates to ALL products and accounts I/We have or have had with you.'
  );
  authPara.setFontSize(9);

  body.appendParagraph('').setSpacingAfter(15);

  // === SIGNATURE BOX ===
  const sigData = [
    ['Signature:', 'Signed Electronically by ' + (data.full_name || '')],
    ['Date:', new Date().toLocaleDateString('en-GB')]
  ];

  const sigTable = body.appendTable(sigData);
  sigTable.setBorderWidth(1);
  sigTable.getRow(0).getCell(0).setWidth(80);
  sigTable.getRow(1).getCell(0).setWidth(80);

  for (let i = 0; i < sigTable.getNumRows(); i++) {
    sigTable.getRow(i).getCell(0).getChild(0).asParagraph().setBold(true).setFontSize(10);
    sigTable.getRow(i).getCell(1).getChild(0).asParagraph().setFontSize(10).setItalic(i === 0);
  }

  body.appendParagraph('').setSpacingAfter(20);

  // === FOOTER ===
  const footer = body.appendParagraph(
    'Fast Action Claims is a trading style of Rowan Rose Solicitors, authorised and regulated by the Solicitors Regulation Authority (SRA No. 8000843). Registered office: 1.03 The Boat Shed, 12 Exchange Quay, Salford, M5 3EQ.'
  );
  footer.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  footer.setFontSize(7);
  footer.setForegroundColor('#666666');
}

function buildCoverLetterDocument(body, data) {
  // Clear any default content
  body.clear();

  // Set page margins
  body.setMarginTop(40);
  body.setMarginBottom(40);
  body.setMarginLeft(50);
  body.setMarginRight(50);

  // Lender addresses lookup
  const lenderAddresses = {
    'VANQUIS': {
      name: 'Vanquis Bank Limited',
      line1: 'Fairburn House, 5 Godwin Street',
      city: 'Bradford',
      postcode: 'BD1 2AH'
    },
    'LOANS2GO': {
      name: 'Loans 2 Go Limited',
      line1: 'Bridge Studios, 34a Deodar Road, Putney',
      city: 'London',
      postcode: 'SW15 2NN'
    },
    'LOANS 2 GO': {
      name: 'Loans 2 Go Limited',
      line1: 'Bridge Studios, 34a Deodar Road, Putney',
      city: 'London',
      postcode: 'SW15 2NN'
    }
  };

  const lenderKey = (data.lender_type || '').toUpperCase();
  const lenderAddr = lenderAddresses[lenderKey] || null;

  // === HEADER ===
  const headerTable = body.appendTable();
  const headerRow = headerTable.appendTableRow();

  const logoCell = headerRow.appendTableCell('FAST ACTION CLAIMS');
  logoCell.setWidth(200);
  logoCell.getChild(0).asParagraph()
    .setFontSize(16)
    .setBold(true)
    .setForegroundColor('#b45f06');

  const contactCell = headerRow.appendTableCell(
    'Fast Action Claims\n' +
    'Tel: 0161 5331706\n' +
    '1.03 The Boat Shed, 12 Exchange Quay\n' +
    'Salford, M5 3EQ\n' +
    'irl@rowanrose.co.uk'
  );
  contactCell.getChild(0).asParagraph()
    .setAlignment(DocumentApp.HorizontalAlignment.RIGHT)
    .setFontSize(9);

  headerTable.setBorderWidth(0);

  body.appendParagraph('').setSpacingAfter(15);

  // === DATE ===
  const datePara = body.appendParagraph(
    'Date: ' + new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  );
  datePara.setBold(true);
  datePara.setFontSize(11);

  body.appendParagraph('').setSpacingAfter(10);

  // === LENDER ADDRESS ===
  if (lenderAddr) {
    body.appendParagraph(lenderAddr.name).setFontSize(11);
    body.appendParagraph(lenderAddr.line1).setFontSize(11);
    body.appendParagraph(lenderAddr.city).setFontSize(11);
    body.appendParagraph(lenderAddr.postcode).setFontSize(11);
    body.appendParagraph('').setSpacingAfter(10);
  }

  // === REFERENCE ===
  body.appendParagraph('Our Reference: FAC-' + (data.contact_id || '')).setFontSize(11);
  body.appendParagraph('Client Name: ' + (data.full_name || '')).setFontSize(11);
  body.appendParagraph('Lender: ' + (data.lender_type || '')).setFontSize(11);

  body.appendParagraph('').setSpacingAfter(10);

  // === SUBJECT ===
  const subject = body.appendParagraph(
    'Subject: Request for Disclosure of Client Information – Data Subject Access Request'
  );
  subject.setBold(true);
  subject.setFontSize(11);

  body.appendParagraph('').setSpacingAfter(10);

  // === BODY ===
  body.appendParagraph('Dear Sir/Madam,').setFontSize(11);
  body.appendParagraph('').setSpacingAfter(5);

  body.appendParagraph('We act on behalf of the above-named client.').setFontSize(11);
  body.appendParagraph('').setSpacingAfter(5);

  body.appendParagraph(
    'We formally request that your organisation promptly disclose and release to Fast Action Claims all documentation and information relating to our client\'s financial arrangements with your institution. This includes, but is not limited to, all data and records regarding loans, credit cards, borrowing, and account activity.'
  ).setFontSize(11);
  body.appendParagraph('').setSpacingAfter(5);

  body.appendParagraph('Specifically, we require a complete file containing:').setFontSize(11);

  // === BULLET POINTS ===
  const bullets = [
    'True copies of all completed application forms',
    'All pre-contractual information and documentation provided',
    'Executed copies of credit or loan agreements',
    'Full statements of account, detailing all payments made, interest charged, fees incurred, and any outstanding balances',
    'Records of any affordability assessments or creditworthiness checks conducted',
    'Copies of all correspondence between your organisation and our client'
  ];

  bullets.forEach(item => {
    const li = body.appendListItem(item);
    li.setGlyphType(DocumentApp.GlyphType.BULLET);
    li.setFontSize(11);
  });

  body.appendParagraph('').setSpacingAfter(5);

  body.appendParagraph(
    'This request is made under the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. We remind you that you are obligated to respond to this request within one calendar month from the date of receipt.'
  ).setFontSize(11);
  body.appendParagraph('').setSpacingAfter(5);

  body.appendParagraph(
    'Please forward all requested information directly to our office at the address shown above, or via email to irl@rowanrose.co.uk.'
  ).setFontSize(11);
  body.appendParagraph('').setSpacingAfter(5);

  body.appendParagraph(
    'Should you require verification of our authority to act on behalf of our client, please find enclosed the signed Letter of Authority.'
  ).setFontSize(11);
  body.appendParagraph('').setSpacingAfter(5);

  body.appendParagraph('We look forward to your prompt response.').setFontSize(11);
  body.appendParagraph('').setSpacingAfter(15);

  // === SIGNATURE ===
  body.appendParagraph('Yours faithfully,').setFontSize(11);
  body.appendParagraph('');
  body.appendParagraph('');

  const sigName = body.appendParagraph('Fast Action Claims');
  sigName.setBold(true);
  sigName.setFontSize(11);

  body.appendParagraph('On behalf of ' + (data.full_name || '')).setFontSize(11);

  body.appendParagraph('').setSpacingAfter(20);

  // === FOOTER ===
  const footer = body.appendParagraph(
    'Fast Action Claims is a trading style of Rowan Rose Ltd, a company registered in England and Wales (12916452) whose registered office is situated at 1.03 Boat Shed, 12 Exchange Quay, Salford, M5 3EQ. We are authorised and regulated by the Solicitors Regulation Authority.'
  );
  footer.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  footer.setFontSize(7);
  footer.setForegroundColor('#666666');
}

// ============ TEST FUNCTION ============
function testDoPost() {
  const testData = {
    postData: {
      contents: JSON.stringify({
        first_name: "John",
        last_name: "Doe",
        full_name: "John Doe",
        email: "john@test.com",
        lender_type: "VANQUIS",
        street_address: "123 Test Street",
        city: "Manchester",
        postal_code: "M1 1AA",
        date_of_birth: "15/01/1990",
        contact_id: "12345",
        previous_address: "456 Old Road, Liverpool"
      })
    }
  };

  const result = doPost(testData);
  const output = JSON.parse(result.getContent());

  Logger.log('Success: ' + output.success);

  if (output.success) {
    Logger.log('LOA Filename: ' + output.loa_filename);
    Logger.log('LOA Size: ' + output.loa_size_bytes + ' bytes');
    Logger.log('LOA Download URL: ' + output.loa_download_url);

    if (output.cover_letter_filename) {
      Logger.log('Cover Letter Filename: ' + output.cover_letter_filename);
      Logger.log('Cover Letter Size: ' + output.cover_letter_size_bytes + ' bytes');
      Logger.log('Cover Letter Download URL: ' + output.cover_letter_download_url);
    }
  } else {
    Logger.log('Error: ' + output.error);
  }
}

// Quick test to verify PDF generation works
function quickTest() {
  const doc = DocumentApp.create('TEST_PDF_' + Date.now());
  doc.getBody().appendParagraph('Test PDF Generation');
  doc.saveAndClose();

  Utilities.sleep(500);

  const file = DriveApp.getFileById(doc.getId());
  const pdf = file.getAs(MimeType.PDF);
  const bytes = pdf.getBytes();

  // Check PDF header
  const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  Logger.log('PDF Header: ' + header); // Should be "%PDF"
  Logger.log('PDF Size: ' + bytes.length + ' bytes');

  file.setTrashed(true);

  return header === '%PDF';
}
