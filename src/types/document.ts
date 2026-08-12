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

// Simplified, user-facing format buckets for the sidebar filter — collapses
// the many real extensions the scanner indexes (docx, pptx, txt, zip, ...)
// down to the 4 categories users actually want to filter by. Formats not
// covered by any bucket (e.g. docx) simply have no format-filter entry;
// they're still fully indexed and browsable via category/folder/keyword.
export type DocFormatGroup = 'hangul' | 'pdf' | 'excel' | 'ebook';

export const DOC_FORMAT_GROUPS: Array<{ key: DocFormatGroup; label: string; formats: DocFormat[] }> = [
  { key: 'hangul', label: '한글문서', formats: ['hwp', 'hwpx'] },
  { key: 'pdf', label: 'PDF', formats: ['pdf'] },
  { key: 'excel', label: '엑셀문서', formats: ['xlsx', 'xls'] },
  { key: 'ebook', label: '전자책', formats: ['epub', 'cbz', 'zip'] },
];

export function getDocFormatGroup(format: DocFormat): DocFormatGroup | null {
  return DOC_FORMAT_GROUPS.find((g) => g.formats.includes(format))?.key ?? null;
}
