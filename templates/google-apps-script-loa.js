/**
 * LOA & Cover Letter PDF Generator - Google Apps Script
 *
 * This script converts HTML to proper PDF using Google Docs as intermediary.
 * Deploy as Web App and call from Zapier.
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Generate LOA PDF
    const loaResult = generatePDF(data, 'LOA');

    // Generate Cover Letter PDF (skip for Gambling if needed)
    let coverLetterResult = null;
    if (data.lender_type && data.lender_type.toUpperCase() !== 'GAMBLING') {
      coverLetterResult = generatePDF(data, 'COVER_LETTER');
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      loa: loaResult,
      cover_letter: coverLetterResult
    })).setMimeType(ContentService.MimeType.JSON);

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
  const docName = `${data.contact_id}_${data.lender_type}_${type}_${Date.now()}`;
  const doc = DocumentApp.create(docName);
  const body = doc.getBody();

  try {
    if (type === 'LOA') {
      buildLOADocument(body, data);
    } else {
      buildCoverLetterDocument(body, data);
    }

    doc.saveAndClose();

    // Convert Google Doc to PDF
    const docFile = DriveApp.getFileById(doc.getId());
    const pdfBlob = docFile.getAs('application/pdf');
    pdfBlob.setName(`${data.contact_id}_${data.lender_type}_${type}.pdf`);

    // Save PDF to Drive
    const pdfFile = DriveApp.createFile(pdfBlob);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Get download URL
    const pdfUrl = `https://drive.google.com/uc?export=download&id=${pdfFile.getId()}`;

    // Get PDF as Base64 (more reliable for Zapier transfer)
    const pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());

    // Delete the temporary Google Doc (keep only PDF)
    docFile.setTrashed(true);

    // Also delete PDF from Drive (we're returning base64 directly)
    pdfFile.setTrashed(true);

    return {
      file_id: pdfFile.getId(),
      pdf_url: pdfUrl,
      filename: pdfBlob.getName(),
      pdf_base64: pdfBase64
    };

  } catch (err) {
    // Cleanup on error
    try {
      DriveApp.getFileById(doc.getId()).setTrashed(true);
    } catch (e) {}
    throw err;
  }
}

function buildLOADocument(body, data) {
  // Set margins
  body.setMarginTop(36);
  body.setMarginBottom(36);
  body.setMarginLeft(50);
  body.setMarginRight(50);

  // Header - Company Info
  const headerTable = body.appendTable([
    ['FAST ACTION CLAIMS', 'Fast Action Claims\nTel: 0161 5331706\n1.03 The boat shed, 12 Exchange Quay\nSalford, M5 3EQ\nirl@rowanrose.co.uk']
  ]);
  headerTable.setBorderWidth(0);
  headerTable.getCell(0, 0).getChild(0).asParagraph().setHeading(DocumentApp.ParagraphHeading.HEADING1);
  headerTable.getCell(0, 0).setWidth(250);
  headerTable.getCell(0, 1).getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.RIGHT);

  body.appendParagraph('');

  // Title
  const title = body.appendParagraph('LETTER OF AUTHORITY');
  title.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  title.setBold(true);

  body.appendParagraph('');

  // Lender
  const lenderPara = body.appendParagraph('IN RESPECT OF: ' + (data.lender_type || 'N/A'));
  lenderPara.setBold(true);

  body.appendParagraph('');

  // Client Info Table
  const clientTable = body.appendTable([
    ['Full Name:', data.full_name || ''],
    ['Address:', (data.street_address || '') + ', ' + (data.city || '')],
    ['Postal Code:', data.postal_code || ''],
    ['Date of Birth:', data.date_of_birth || ''],
    ['Previous Address:', data.previous_address || '']
  ]);
  clientTable.setBorderWidth(1);

  // Style the table
  for (let i = 0; i < clientTable.getNumRows(); i++) {
    clientTable.getCell(i, 0).setWidth(120);
    clientTable.getCell(i, 0).setBackgroundColor('#f2f2f2');
    clientTable.getCell(i, 0).getChild(0).asParagraph().setBold(true);
  }

  body.appendParagraph('');

  // Legal Text
  const legalText = `I/We hereby Authorise and instruct: You (The Bank/Door Step Lender/Building Society/Card Provider/Finance Provider/Loan Broker/Underwriter/Insurance Provider/Financial Advisor/Pension Provider/Catalogue Loans provider/Mortgage Broker/HMRC) to:

1. Liaise exclusively with Fast Action Claims in respect of all aspects of my/our potential complaint/claim for compensation as stated above.

2. Immediately release to Fast Action Claims any information/documentation relating to all my/our loans/credit cards/overdrafts/Store Cards/Car Finance/Packaged Bank Account/ to include all Broker Commissions, Tax deductions which may be requested. This includes information in response to a request made under Sections 77-78 of the Consumer Credit Act 1974 and/or Section 45 of the Data Protection Act 2018 and Article 15 GDPR.

3. Contact Fast Action Claims whenever they need to send me/us information or contact me/us in connection with this matter.

I/We authorise Fast Action Claims of 1.03, 12 Exchange Quay, Salford, M5 3EQ as my/our sole representatives to deal with my potential complaint/claim for compensation in relation to all loans/credit cards/car finance/overdrafts/Packaged Bank Accounts/Store Cards. I/We confirm that Fast Action Claims are instructed to pursue all aspects they consider necessary in relation to my/our dealings with your organisation. This letter of authority relates to ALL products and accounts I/We have or have had with you.`;

  const legalPara = body.appendParagraph(legalText);
  legalPara.setFontSize(9);
  legalPara.setAlignment(DocumentApp.HorizontalAlignment.JUSTIFY);

  body.appendParagraph('');

  // Signature Box
  const sigTable = body.appendTable([
    ['Signature:', 'Signed Electronically by ' + (data.full_name || '')],
    ['Date:', new Date().toLocaleDateString('en-GB')]
  ]);
  sigTable.setBorderWidth(1);
  sigTable.getCell(0, 0).setWidth(100);
  sigTable.getCell(1, 0).setWidth(100);

  body.appendParagraph('');

  // Footer
  const footer = body.appendParagraph('Fast Action Claims is a trading style of Rowan Rose Solicitors, authorised and regulated by the Solicitors Regulation Authority (SRA No. 8000843). Registered office: 1.03 The Boat Shed, 12 Exchange Quay, Salford, M5 3EQ.');
  footer.setFontSize(8);
  footer.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
}

function buildCoverLetterDocument(body, data) {
  // Set margins
  body.setMarginTop(36);
  body.setMarginBottom(36);
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

  // Header
  const headerTable = body.appendTable([
    ['FAST ACTION CLAIMS', 'Fast Action Claims\nTel: 0161 5331706\n1.03 The Boat Shed, 12 Exchange Quay\nSalford, M5 3EQ\nirl@rowanrose.co.uk']
  ]);
  headerTable.setBorderWidth(0);
  headerTable.getCell(0, 0).getChild(0).asParagraph().setHeading(DocumentApp.ParagraphHeading.HEADING1);
  headerTable.getCell(0, 0).setWidth(250);
  headerTable.getCell(0, 1).getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.RIGHT);

  body.appendParagraph('');

  // Date
  const datePara = body.appendParagraph('Date: ' + new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }));
  datePara.setBold(true);

  body.appendParagraph('');

  // Lender Address
  if (lenderAddr) {
    body.appendParagraph(lenderAddr.name);
    body.appendParagraph(lenderAddr.line1);
    body.appendParagraph(lenderAddr.city);
    body.appendParagraph(lenderAddr.postcode);
    body.appendParagraph('');
  }

  // Reference
  body.appendParagraph('Our Reference: FAC-' + (data.contact_id || ''));
  body.appendParagraph('Client Name: ' + (data.full_name || ''));
  body.appendParagraph('Lender: ' + (data.lender_type || ''));
  body.appendParagraph('');

  // Subject
  const subject = body.appendParagraph('Subject: Request for Disclosure of Client Information – Data Subject Access Request');
  subject.setBold(true);

  body.appendParagraph('');

  // Greeting
  body.appendParagraph('Dear Sir/Madam,');
  body.appendParagraph('');

  // Body
  body.appendParagraph('We act on behalf of the above-named client.');
  body.appendParagraph('');

  body.appendParagraph('We formally request that your organisation promptly disclose and release to Fast Action Claims all documentation and information relating to our client\'s financial arrangements with your institution. This includes, but is not limited to, all data and records regarding loans, credit cards, borrowing, and account activity.');
  body.appendParagraph('');

  body.appendParagraph('Specifically, we require a complete file containing:');

  // Bullet points
  const bullets = [
    'True copies of all completed application forms',
    'All pre-contractual information and documentation provided',
    'Executed copies of credit or loan agreements',
    'Full statements of account, detailing all payments made, interest charged, fees incurred, and any outstanding balances',
    'Records of any affordability assessments or creditworthiness checks conducted',
    'Copies of all correspondence between your organisation and our client'
  ];

  bullets.forEach(item => {
    const listItem = body.appendListItem(item);
    listItem.setGlyphType(DocumentApp.GlyphType.BULLET);
  });

  body.appendParagraph('');

  body.appendParagraph('This request is made under the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. We remind you that you are obligated to respond to this request within one calendar month from the date of receipt.');
  body.appendParagraph('');

  body.appendParagraph('Please forward all requested information directly to our office at the address shown above, or via email to irl@rowanrose.co.uk.');
  body.appendParagraph('');

  body.appendParagraph('Should you require verification of our authority to act on behalf of our client, please find enclosed the signed Letter of Authority.');
  body.appendParagraph('');

  body.appendParagraph('We look forward to your prompt response.');
  body.appendParagraph('');

  // Signature
  body.appendParagraph('Yours faithfully,');
  body.appendParagraph('');
  body.appendParagraph('');
  const sigName = body.appendParagraph('Fast Action Claims');
  sigName.setBold(true);
  body.appendParagraph('On behalf of ' + (data.full_name || ''));

  body.appendParagraph('');

  // Footer
  const footer = body.appendParagraph('Fast Action Claims is a trading style of Rowan Rose Ltd, a company registered in England and Wales (12916452) whose registered office is situated at 1.03 Boat Shed, 12 Exchange Quay, Salford, M5 3EQ. We are authorised and regulated by the Solicitors Regulation Authority.');
  footer.setFontSize(8);
  footer.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
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
  Logger.log(result.getContent());
}
