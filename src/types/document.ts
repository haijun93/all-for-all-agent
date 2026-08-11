export type DocFormat = 'pdf' | 'docx' | 'doc' | 'xlsx' | 'xls' | 'hwp' | 'hwpx' | 'pptx' | 'txt' | 'epub' | 'zip' | 'cbz';

export interface DocumentItem {
  id: string;
  title: string;
  fileName: string;
  filePath?: string;
  fileSize: number; // in bytes
  format: DocFormat;
  dateCreated: string; // YYYY-MM-DD
  dateModified: string;
  pageCount?: number;
  thumbnailUrl: string; // 1st page visual thumbnail data URL
  previewSnippet?: string;
  extractedText: string;
  keywords: string[];
  category: string; // e.g. 사업계획서, 계약서, 재무/정산, 보고서, 도서/전자책, 견적서
  folder?: string;
  isStarred: boolean;
  author?: string;
  company?: string;
}

export type DocGroupBy = 'keyword' | 'date' | 'format' | 'category' | 'folder';
