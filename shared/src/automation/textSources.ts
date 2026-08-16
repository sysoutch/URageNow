export interface TextSourceSummary {
  fileName: string;
  fullPath: string;
  lineCount: number;
  updatedAt: string;
}

export interface TextSourcePreview {
  fileName: string;
  fullPath: string;
  content: string;
  previewLines: string[];
  previewLineCount: number;
  truncated: boolean;
  updatedAt: string;
}
