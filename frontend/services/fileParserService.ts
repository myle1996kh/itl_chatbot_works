// This service uses third-party libraries to parse different file formats into text.
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Required configuration for pdf.js to work with its worker script from the CDN.
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.5.136/build/pdf.worker.mjs`;

/**
 * Parses a .txt file and returns its content.
 * @param file The .txt file to parse.
 * @returns A promise that resolves to the text content of the file.
 */
const parseTxt = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve(event.target?.result as string);
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsText(file);
  });
};

/**
 * Parses a .pdf file and extracts its text content.
 * @param file The .pdf file to parse.
 * @returns A promise that resolves to the extracted text content.
 */
const parsePdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n';
    }

    return fullText;
};

/**
 * Parses a .docx file and converts its content to plain text.
 * @param file The .docx file to parse.
 * @returns A promise that resolves to the converted text content.
 */
const parseDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
};

/**
 * Takes a file of a supported type (.txt, .pdf, .docx) and extracts its text content.
 * @param file The file to parse.
 * @returns A promise that resolves to the extracted text content, or an error message if the format is unsupported.
 */
export const parseFileToText = (file: File): Promise<string> => {
  if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
    return parseTxt(file);
  }
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    return parsePdf(file);
  }
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
    return parseDocx(file);
  }

  return Promise.reject(new Error('Unsupported file type. Please upload .txt, .pdf, or .docx files.'));
};