const { readFile } = require("node:fs/promises");
const { createHash } = require("node:crypto");
// Reuse the PDF.js version bundled by the existing pdf-parse dependency.
const pdf = require("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js");
const { UserDocument, PropertyDocument, EvidenceSource } = require("../models");

class SurveyPassageError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const positiveInteger = value => Number.isSafeInteger(value) && value > 0;

function normalizeSelection(value) {
  if (value == null) return null;
  const { documentId, pageNumber, start, end, digest } = value;
  if (
    !positiveInteger(documentId) || !positiveInteger(pageNumber) ||
    !Number.isSafeInteger(start) || start < 0 ||
    !Number.isSafeInteger(end) || end <= start || end - start > 2000 ||
    typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)
  ) {
    throw new SurveyPassageError("Select up to 2,000 characters from one PDF page.");
  }
  return { documentId, pageNumber, start, end, digest };
}

async function getPage(userId, documentId, pageNumber, options = {}) {
  if (!positiveInteger(documentId) || !positiveInteger(pageNumber) || pageNumber > 500) {
    throw new SurveyPassageError("Choose a PDF page between 1 and 500.");
  }
  const document = await UserDocument.findOne({
    where: { id: documentId, user_id: userId, is_active: true },
    transaction: options.transaction,
    lock: options.transaction?.LOCK.UPDATE,
  });
  if (!document) throw new SurveyPassageError("Document unavailable.", 404);
  if (document.file_type !== ".pdf") throw new SurveyPassageError("Passages are available for PDFs with selectable text.", 422);
  if (document.file_size > 10 * 1024 * 1024) throw new SurveyPassageError("The PDF is too large to read passages.", 422);

  let text = "";
  let pageCount;
  let loading;
  try {
    const data = await readFile(document.file_path);
    loading = pdf.getDocument({ data: new Uint8Array(data), isEvalSupported: false, disableFontFace: true });
    const pdfDocument = await loading.promise;
    pageCount = Math.min(pdfDocument.numPages, 500);
    if (pageNumber > pageCount) throw new SurveyPassageError("That page is unavailable.", 404);

    const page = await pdfDocument.getPage(pageNumber);
    const content = await page.getTextContent();
    let line;
    for (const item of content.items) {
      const nextLine = item.transform[5];
      if (line !== undefined && line !== nextLine) text += "\n";
      text += item.str;
      line = nextLine;
    }
  } catch (error) {
    if (error instanceof SurveyPassageError) throw error;
    throw new SurveyPassageError("The PDF page could not be read.", 422);
  } finally {
    await loading?.destroy().catch(() => {});
  }
  text = text.replace(/\r\n?/g, "\n").trim();
  return {
    pageNumber,
    pageCount,
    text,
    digest: createHash("sha256").update(text).digest("hex"),
  };
}

function selectionMatchesPage(page, selection) {
  return page.digest === selection.digest && Number.isSafeInteger(selection.start) &&
    Number.isSafeInteger(selection.end) && selection.start >= 0 && selection.end > selection.start &&
    selection.end <= page.text.length &&
    Boolean(page.text.slice(selection.start, selection.end).trim());
}

async function findActiveLink(propertyId, documentId, options = {}) {
  return PropertyDocument.findOne({
    where: { property_id: propertyId, user_document_id: documentId, is_active: true },
    transaction: options.transaction,
  });
}

async function selectionMatchesSource(sourceId, selection, transaction) {
  if (!sourceId || !selection) return !sourceId && !selection;
  const source = await EvidenceSource.findByPk(sourceId, { transaction });
  return source?.user_document_id === selection.documentId &&
    source.page_number === selection.pageNumber &&
    source.locator?.start === selection.start &&
    source.locator?.end === selection.end &&
    source.locator?.digest === selection.digest;
}

module.exports = { SurveyPassageError, normalizeSelection, getPage, selectionMatchesPage, selectionMatchesSource, findActiveLink };
