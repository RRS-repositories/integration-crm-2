/**
 * LOA & Cover Letter PDF Generator - Google Apps Script v3
 * With Logo Image, Arial Font, Organized Drive Folder, Better Formatting
 */

// ============ CONFIGURATION ============
// Upload your logo to Google Drive, make it shareable, and put the FILE ID here
// To get file ID: Right-click logo in Drive → Get link → Copy the ID from URL
// Example: https://drive.google.com/file/d/1ABC123XYZ/view → ID is "1ABC123XYZ"
const LOGO_FILE_ID = '1CAAWLcdyFU-CHsQPUHalpZDE0naFqfDM'; // FAC Logo from Google Drive
const PARENT_FOLDER_NAME = 'FAC_Generated_PDFs'; // Parent folder for all client folders

// ============ MAIN ENTRY POINT ============
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Create unique folder for this client: FAC_[contact_id]_[timestamp]
    const clientFolderName = `FAC_${data.contact_id}_${Date.now()}`;
    const parentFolder = getOrCreateFolder(PARENT_FOLDER_NAME);
    const clientFolder = parentFolder.createFolder(clientFolderName);

    // Generate LOA PDF
    const loaResult = generatePDF(data, 'LOA', clientFolder);

    // Generate Cover Letter PDF (skip for Gambling)
    let coverLetterResult = null;
    if (data.lender_type && data.lender_type.toUpperCase() !== 'GAMBLING') {
      coverLetterResult = generatePDF(data, 'COVER_LETTER', clientFolder);
    }

    // Return FLAT structure for Zapier compatibility
    // folder_id is the unique client folder - use this for deletion
    const response = {
      success: true,
      folder_id: clientFolder.getId(),
      folder_name: clientFolderName,
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

// ============ FOLDER MANAGEMENT ============
function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

// ============ DELETE FOLDER ENDPOINT ============
// Call this via GET request with ?folder_id=xxx to delete the entire client folder after S3 upload
// This deletes the unique client folder and all files inside it
function doGet(e) {
  try {
    const folderId = e.parameter.folder_id;

    if (folderId) {
      try {
        const folder = DriveApp.getFolderById(folderId);
        const folderName = folder.getName();

        // Delete all files inside the folder first
        const files = folder.getFiles();
        while (files.hasNext()) {
          files.next().setTrashed(true);
        }

        // Delete the folder itself
        folder.setTrashed(true);

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          deleted_folder: folderName,
          folder_id: folderId
        })).setMimeType(ContentService.MimeType.JSON);

      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: 'Folder not found or already deleted: ' + err.message
        })).setMimeType(ContentService.MimeType.JSON);
      }
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Missing folder_id parameter. Use ?folder_id=YOUR_FOLDER_ID'
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============ PDF GENERATION ============
function generatePDF(data, type, folder) {
  const docName = `TEMP_${data.contact_id}_${data.lender_type}_${type}_${Date.now()}`;
  const doc = DocumentApp.create(docName);
  const docId = doc.getId();

  try {
    const body = doc.getBody();

    // Set default font to Arial for entire document
    const style = {};
    style[DocumentApp.Attribute.FONT_FAMILY] = 'Arial';
    body.setAttributes(style);

    if (type === 'LOA') {
      buildLOADocument(body, data);
    } else {
      buildCoverLetterDocument(body, data);
    }

    doc.saveAndClose();
    Utilities.sleep(1000);

    const docFile = DriveApp.getFileById(docId);
    const pdfBlob = docFile.getAs(MimeType.PDF);
    const filename = `${data.contact_id}_${data.lender_type}_${type}.pdf`;
    pdfBlob.setName(filename);

    const pdfBytes = pdfBlob.getBytes();

    // Save PDF to the organized folder
    const pdfFile = folder.createFile(pdfBlob);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Delete the temporary Google Doc
    docFile.setTrashed(true);

    const downloadUrl = `https://drive.google.com/uc?export=download&id=${pdfFile.getId()}`;

    return {
      filename: filename,
      file_id: pdfFile.getId(),
      download_url: downloadUrl,
      size_bytes: pdfBytes.length
    };

  } catch (err) {
    try {
      DriveApp.getFileById(docId).setTrashed(true);
    } catch (e) { }
    throw new Error(`PDF generation failed for ${type}: ${err.message}`);
  }
}

// ============ LOGO HELPER ============
function getLogoBlob() {
  try {
    if (LOGO_FILE_ID && LOGO_FILE_ID.length > 10) {
      Logger.log('Attempting to load logo with ID: ' + LOGO_FILE_ID);
      const logoFile = DriveApp.getFileById(LOGO_FILE_ID);
      Logger.log('Logo file found: ' + logoFile.getName());
      const blob = logoFile.getBlob();
      Logger.log('Logo blob size: ' + blob.getBytes().length + ' bytes');
      return blob;
    } else {
      Logger.log('No valid LOGO_FILE_ID configured');
    }
  } catch (e) {
    Logger.log('Logo error: ' + e.message);
    Logger.log('Make sure the logo file is shared (Anyone with link) in Google Drive');
  }
  return null;
}

// Test function to check if logo is accessible
function testLogo() {
  const blob = getLogoBlob();
  if (blob) {
    Logger.log('SUCCESS: Logo is accessible!');
    Logger.log('Logo type: ' + blob.getContentType());
    Logger.log('Logo size: ' + blob.getBytes().length + ' bytes');
  } else {
    Logger.log('FAILED: Could not load logo');
    Logger.log('Check that LOGO_FILE_ID is correct: ' + LOGO_FILE_ID);
  }
}

// ============ BUILD HEADER WITH LOGO ============
function buildHeader(body) {
  const headerTable = body.appendTable();
  const headerRow = headerTable.appendTableRow();

  // Logo cell (left)
  const logoCell = headerRow.appendTableCell();
  logoCell.setWidth(250);

  const logoBlob = getLogoBlob();
  if (logoBlob) {
    try {
      const logoPara = logoCell.getChild(0).asParagraph();
      const logoImage = logoPara.appendInlineImage(logoBlob);
      // Scale logo - max height 70px
      const width = logoImage.getWidth();
      const height = logoImage.getHeight();
      const maxHeight = 70;
      if (height > maxHeight) {
        const ratio = maxHeight / height;
        logoImage.setWidth(Math.round(width * ratio));
        logoImage.setHeight(maxHeight);
      }
    } catch (e) {
      // Fallback to styled text if logo fails
      addFallbackLogo(logoCell);
    }
  } else {
    // No logo configured - use styled text
    addFallbackLogo(logoCell);
  }

  // Contact info cell (right)
  const contactCell = headerRow.appendTableCell();
  const contactPara = contactCell.getChild(0).asParagraph();
  contactPara.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);

  // Build contact info with proper formatting - darker text
  contactPara.appendText('Tel: 0161 5331706').setFontFamily('Arial').setFontSize(9).setForegroundColor('#000000');
  contactPara.appendText('\n1.03 The Boat Shed, 12 Exchange Quay').setFontFamily('Arial').setFontSize(9).setForegroundColor('#000000');
  contactPara.appendText('\nSalford, M5 3EQ').setFontFamily('Arial').setFontSize(9).setForegroundColor('#000000');
  contactPara.appendText('\nirl@rowanrose.co.uk').setFontFamily('Arial').setFontSize(9).setForegroundColor('#000000');

  headerTable.setBorderWidth(0);

  return headerTable;
}

function addFallbackLogo(cell) {
  const logoPara = cell.getChild(0).asParagraph();
  // Create FAC style text logo with orange arrow styling
  logoPara.appendText('FAC').setFontFamily('Arial').setFontSize(24).setBold(true).setForegroundColor('#1a3a5c');
  logoPara.appendText('\n');
  logoPara.appendText('FAST ACTION CLAIMS').setFontFamily('Arial').setFontSize(10).setBold(true).setForegroundColor('#1a3a5c');
}

// ============ LOA DOCUMENT ============
function buildLOADocument(body, data) {
  body.clear();

  // Page margins
  body.setMarginTop(40);
  body.setMarginBottom(40);
  body.setMarginLeft(50);
  body.setMarginRight(50);

  // === HEADER WITH LOGO ===
  buildHeader(body);
  body.appendParagraph('').setSpacingAfter(15);

  // === TITLE ===
  const title = body.appendParagraph('LETTER OF AUTHORITY');
  title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  title.setFontFamily('Arial');
  title.setFontSize(16);
  title.setBold(true);
  title.setForegroundColor('#000000');

  // Underline
  const underline = body.appendParagraph('_'.repeat(50));
  underline.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  underline.setFontSize(6);
  underline.setForegroundColor('#333333');

  body.appendParagraph('').setSpacingAfter(12);

  // === LENDER ===
  const lenderPara = body.appendParagraph('');
  lenderPara.appendText('IN RESPECT OF: ').setFontFamily('Arial').setFontSize(11).setBold(true).setForegroundColor('#000000');
  lenderPara.appendText(data.lender_type || 'N/A').setFontFamily('Arial').setFontSize(11).setBold(false).setForegroundColor('#000000');

  body.appendParagraph('').setSpacingAfter(8);

  // === CLIENT INFO TABLE ===
  const clientData = [
    ['Full Name', data.full_name || ''],
    ['Address', (data.street_address || '') + ', ' + (data.city || '')],
    ['Postal Code', data.postal_code || ''],
    ['Date of Birth', data.date_of_birth || ''],
    ['Previous Address', data.previous_address || 'N/A']
  ];

  const clientTable = body.appendTable(clientData);
  clientTable.setBorderWidth(1);
  clientTable.setBorderColor('#dddddd');

  for (let i = 0; i < clientTable.getNumRows(); i++) {
    const row = clientTable.getRow(i);
    // Label cell - bold, dark text
    row.getCell(0).setWidth(120);
    row.getCell(0).setBackgroundColor('#f5f5f5');
    row.getCell(0).getChild(0).asParagraph()
      .setFontFamily('Arial')
      .setFontSize(10)
      .setBold(true)
      .setForegroundColor('#000000');
    // Value cell - NOT bold, dark text
    row.getCell(1).getChild(0).asParagraph()
      .setFontFamily('Arial')
      .setFontSize(10)
      .setForegroundColor('#000000');
  }

  body.appendParagraph('').setSpacingAfter(12);

  // === LEGAL TEXT (intro bold, rest normal) ===
  const legalIntro = body.appendParagraph('');
  legalIntro.appendText('I/We hereby Authorise and instruct: ')
    .setFontFamily('Arial').setFontSize(9).setBold(true).setForegroundColor('#000000');
  legalIntro.appendText('You (The Bank/Door Step Lender/Building Society/Card Provider/Finance Provider/Loan Broker/Underwriter/Insurance Provider/Financial Advisor/Pension Provider/Catalogue Loans provider/Mortgage Broker/HMRC) to:')
    .setFontFamily('Arial').setFontSize(9).setBold(false).setForegroundColor('#000000');

  body.appendParagraph('').setSpacingAfter(6);

  // Points - numbers bold, text normal
  const points = [
    ['1.', 'Liaise exclusively with Fast Action Claims in respect of all aspects of my/our potential complaint/claim for compensation as stated above.'],
    ['2.', 'Immediately release to Fast Action Claims any information/documentation relating to all my/our loans/credit cards/overdrafts/Store Cards/Car Finance/Packaged Bank Account/ to include all Broker Commissions, Tax deductions which may be requested. This includes information in response to a request made under Sections 77-78 of the Consumer Credit Act 1974 and/or Section 45 of the Data Protection Act 2018 and Article 15 GDPR.'],
    ['3.', 'Contact Fast Action Claims whenever they need to send me/us information or contact me/us in connection with this matter.']
  ];

  points.forEach(([num, text]) => {
    const p = body.appendParagraph('');
    p.appendText(num + ' ').setFontFamily('Arial').setFontSize(9).setBold(true).setForegroundColor('#000000');
    p.appendText(text).setFontFamily('Arial').setFontSize(9).setBold(false).setForegroundColor('#000000');
    p.setSpacingAfter(4);
  });

  body.appendParagraph('').setSpacingAfter(6);

  const authPara = body.appendParagraph(
    'I/We authorise Fast Action Claims of 1.03, 12 Exchange Quay, Salford, M5 3EQ as my/our sole representatives to deal with my potential complaint/claim for compensation in relation to all loans/credit cards/car finance/overdrafts/Packaged Bank Accounts/Store Cards. I/We confirm that Fast Action Claims are instructed to pursue all aspects they consider necessary in relation to my/our dealings with your organisation. This letter of authority relates to ALL products and accounts I/We have or have had with you.'
  );
  authPara.setFontFamily('Arial');
  authPara.setFontSize(9);
  authPara.setForegroundColor('#000000');

  body.appendParagraph('').setSpacingAfter(15);

  // === SIGNATURE BOX ===
  buildSignatureBox(body, data);

  body.appendParagraph('').setSpacingAfter(15);

  // === FOOTER ===
  const footer = body.appendParagraph(
    'Fast Action Claims is a trading style of Rowan Rose Solicitors, authorised and regulated by the Solicitors Regulation Authority (SRA No. 8000843). Registered office: 1.03 The Boat Shed, 12 Exchange Quay, Salford, M5 3EQ.'
  );
  footer.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  footer.setFontFamily('Arial');
  footer.setFontSize(7);
  footer.setForegroundColor('#888888');
}

// ============ SIGNATURE BOX - 2 COLUMN FORMAT ============
// Horizontal line between labels only, not between values
// Uses nested table: outer table (1 row, 2 cols) + inner table for labels (2 rows)
function buildSignatureBox(body, data) {
  // Outer container table - 1 row, 2 columns, with border
  const outerTable = body.appendTable();
  outerTable.setBorderWidth(1);
  outerTable.setBorderColor('#333333');

  const outerRow = outerTable.appendTableRow();

  // LEFT CELL - Contains nested table with labels (NO outer borders, only internal divider)
  const leftCell = outerRow.appendTableCell();
  leftCell.setWidth(100);
  leftCell.setPaddingTop(0);
  leftCell.setPaddingBottom(0);
  leftCell.setPaddingLeft(0);
  leftCell.setPaddingRight(0);

  // Nested table with NO borders (border=0), divider added manually
  leftCell.clear();
  const labelTable = leftCell.appendTable();
  labelTable.setBorderWidth(0);  // NO table borders

  // Signature label row
  const sigLabelRow = labelTable.appendTableRow();
  const sigLabelCell = sigLabelRow.appendTableCell();
  sigLabelCell.setPaddingTop(8);
  sigLabelCell.setPaddingBottom(0);
  sigLabelCell.setPaddingLeft(5);

  // Signature text
  const sigTextPara = sigLabelCell.getChild(0).asParagraph();
  sigTextPara.appendText('Signature:')
    .setFontFamily('Arial')
    .setFontSize(10)
    .setBold(true)
    .setForegroundColor('#000000');

  // Divider line at bottom of Signature cell
  const dividerPara = sigLabelCell.appendParagraph('____________');
  dividerPara.setFontFamily('Arial');
  dividerPara.setFontSize(10);
  dividerPara.setForegroundColor('#333333');
  dividerPara.setSpacingBefore(12);

  // Date label row
  const dateLabelRow = labelTable.appendTableRow();
  const dateLabelCell = dateLabelRow.appendTableCell();
  dateLabelCell.setPaddingTop(5);
  dateLabelCell.setPaddingBottom(8);
  dateLabelCell.setPaddingLeft(5);

  const dateTextPara = dateLabelCell.getChild(0).asParagraph();
  dateTextPara.appendText('Date:')
    .setFontFamily('Arial')
    .setFontSize(10)
    .setBold(true)
    .setForegroundColor('#000000');

  // RIGHT CELL - Contains values stacked (NO divider)
  const rightCell = outerRow.appendTableCell();
  rightCell.setPaddingTop(8);
  rightCell.setPaddingLeft(8);
  rightCell.setVerticalAlignment(DocumentApp.VerticalAlignment.TOP);

  // Signature image or fallback
  const sigPara = rightCell.getChild(0).asParagraph();

  if (data.signature_url) {
    try {
      const response = UrlFetchApp.fetch(data.signature_url, { muteHttpExceptions: true });
      if (response.getResponseCode() === 200) {
        const imageBlob = response.getBlob();
        const inlineImage = sigPara.appendInlineImage(imageBlob);
        const width = inlineImage.getWidth();
        const height = inlineImage.getHeight();
        const maxHeight = 35;
        if (height > maxHeight) {
          const ratio = maxHeight / height;
          inlineImage.setWidth(Math.round(width * ratio));
          inlineImage.setHeight(maxHeight);
        }
      } else {
        sigPara.appendText('Signed Electronically by ' + (data.full_name || ''))
          .setFontFamily('Arial').setFontSize(10).setItalic(true).setForegroundColor('#000000');
      }
    } catch (e) {
      sigPara.appendText('Signed Electronically by ' + (data.full_name || ''))
        .setFontFamily('Arial').setFontSize(10).setItalic(true).setForegroundColor('#000000');
    }
  } else {
    sigPara.appendText('Signed Electronically by ' + (data.full_name || ''))
      .setFontFamily('Arial').setFontSize(10).setItalic(true).setForegroundColor('#000000');
  }

  // Date value (spacing to roughly align with Date label row)
  const dateValuePara = rightCell.appendParagraph(new Date().toLocaleDateString('en-GB'));
  dateValuePara.setFontFamily('Arial');
  dateValuePara.setFontSize(10);
  dateValuePara.setForegroundColor('#000000');
  dateValuePara.setSpacingBefore(20);
}

function addFallbackSignature(cell, data) {
  cell.getChild(0).asParagraph()
    .appendText('Signed Electronically by ' + (data.full_name || ''))
    .setFontFamily('Arial')
    .setFontSize(10)
    .setItalic(true)
    .setForegroundColor('#000000');
}

// ============ COVER LETTER DOCUMENT ============
function buildCoverLetterDocument(body, data) {
  body.clear();

  body.setMarginTop(40);
  body.setMarginBottom(40);
  body.setMarginLeft(50);
  body.setMarginRight(50);

  // Lender addresses
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

  // === HEADER WITH LOGO ===
  buildHeader(body);
  body.appendParagraph('').setSpacingAfter(20);

  // === DATE ===
  const datePara = body.appendParagraph(
    'Date: ' + new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  );
  datePara.setFontFamily('Arial');
  datePara.setFontSize(11);
  datePara.setBold(true);
  datePara.setForegroundColor('#000000');

  body.appendParagraph('').setSpacingAfter(15);

  // === LENDER ADDRESS ===
  if (lenderAddr) {
    const addrLines = [lenderAddr.name, lenderAddr.line1, lenderAddr.city, lenderAddr.postcode];
    addrLines.forEach(line => {
      const p = body.appendParagraph(line);
      p.setFontFamily('Arial');
      p.setFontSize(11);
      p.setForegroundColor('#000000');
    });
    body.appendParagraph('').setSpacingAfter(15);
  }

  // === REFERENCE ===
  const refLines = [
    ['Our Reference: ', 'FAC-' + (data.contact_id || '')],
    ['Client Name: ', data.full_name || ''],
    ['Lender: ', data.lender_type || '']
  ];

  refLines.forEach(([label, value]) => {
    const p = body.appendParagraph('');
    p.appendText(label).setFontFamily('Arial').setFontSize(11).setBold(true).setForegroundColor('#000000');
    p.appendText(value).setFontFamily('Arial').setFontSize(11).setBold(false).setForegroundColor('#000000');
  });

  body.appendParagraph('').setSpacingAfter(15);

  // === SUBJECT ===
  const subject = body.appendParagraph(
    'Subject: Request for Disclosure of Client Information – Data Subject Access Request'
  );
  subject.setFontFamily('Arial');
  subject.setFontSize(11);
  subject.setBold(true);
  subject.setForegroundColor('#000000');

  body.appendParagraph('').setSpacingAfter(15);

  // === BODY ===
  const bodyParagraphs = [
    'Dear Sir/Madam,',
    '',
    'We act on behalf of the above-named client.',
    '',
    'We formally request that your organisation promptly disclose and release to Fast Action Claims all documentation and information relating to our client\'s financial arrangements with your institution. This includes, but is not limited to, all data and records regarding loans, credit cards, borrowing, and account activity.',
    '',
    'Specifically, we require a complete file containing:'
  ];

  bodyParagraphs.forEach(text => {
    if (text === '') {
      body.appendParagraph('').setSpacingAfter(8);
    } else {
      const p = body.appendParagraph(text);
      p.setFontFamily('Arial');
      p.setFontSize(11);
      p.setForegroundColor('#000000');
    }
  });

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
    li.setFontFamily('Arial');
    li.setFontSize(11);
    li.setForegroundColor('#000000');
  });

  body.appendParagraph('').setSpacingAfter(8);

  const closingParagraphs = [
    'This request is made under the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. We remind you that you are obligated to respond to this request within one calendar month from the date of receipt.',
    '',
    'Please forward all requested information directly to our office at the address shown above, or via email to irl@rowanrose.co.uk.',
    '',
    'Should you require verification of our authority to act on behalf of our client, please find enclosed the signed Letter of Authority.',
    '',
    'We look forward to your prompt response.'
  ];

  closingParagraphs.forEach(text => {
    if (text === '') {
      body.appendParagraph('').setSpacingAfter(8);
    } else {
      const p = body.appendParagraph(text);
      p.setForegroundColor('#000000');
      p.setFontFamily('Arial');
      p.setFontSize(11);
    }
  });

  body.appendParagraph('').setSpacingAfter(20);

  // === SIGNATURE ===
  const yoursFaithfully = body.appendParagraph('Yours faithfully,');
  yoursFaithfully.setFontFamily('Arial');
  yoursFaithfully.setFontSize(11);
  yoursFaithfully.setForegroundColor('#000000');
  body.appendParagraph('').setSpacingAfter(25);

  const sigName = body.appendParagraph('Fast Action Claims');
  sigName.setFontFamily('Arial');
  sigName.setFontSize(11);
  sigName.setBold(true);
  sigName.setForegroundColor('#000000');

  const onBehalf = body.appendParagraph('On behalf of ' + (data.full_name || ''));
  onBehalf.setFontFamily('Arial');
  onBehalf.setFontSize(11);
  onBehalf.setForegroundColor('#000000');

  body.appendParagraph('').setSpacingAfter(25);

  // === FOOTER ===
  const footer = body.appendParagraph(
    'Fast Action Claims is a trading style of Rowan Rose Ltd, a company registered in England and Wales (12916452) whose registered office is situated at 1.03 Boat Shed, 12 Exchange Quay, Salford, M5 3EQ. We are authorised and regulated by the Solicitors Regulation Authority.'
  );
  footer.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  footer.setFontFamily('Arial');
  footer.setFontSize(7);
  footer.setForegroundColor('#888888');
}

// ============ TEST FUNCTIONS ============
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
        previous_address: "456 Old Road, Liverpool",
        signature_url: "" // Add your S3 signature URL here for testing
      })
    }
  };

  const result = doPost(testData);
  const output = JSON.parse(result.getContent());

  Logger.log('Success: ' + output.success);
  Logger.log('Folder ID: ' + output.folder_id);

  if (output.success) {
    Logger.log('LOA Filename: ' + output.loa_filename);
    Logger.log('LOA File ID: ' + output.loa_file_id);
    Logger.log('LOA Download URL: ' + output.loa_download_url);

    if (output.cover_letter_filename) {
      Logger.log('Cover Letter Filename: ' + output.cover_letter_filename);
      Logger.log('Cover Letter File ID: ' + output.cover_letter_file_id);
    }
  } else {
    Logger.log('Error: ' + output.error);
    Logger.log('Stack: ' + output.stack);
  }
}

// Test the delete endpoint - pass the folder_id from testDoPost response
function testDelete() {
  const testParams = {
    parameter: {
      folder_id: 'YOUR_FOLDER_ID' // Use folder_id from testDoPost response
    }
  };

  const result = doGet(testParams);
  Logger.log(result.getContent());
}