export interface ServerToolDefinition {
  id: string;
  title: string;
  description: string;
  inputSchema: object;
}

export interface ToolImageImportInput {
  desiredId?: string;
  imageFileName: string;
  imageData: Buffer;
  prompt?: string;
  description?: string;
  width?: number;
  height?: number;
  seed?: number;
  steps?: number | null;
  cfg?: number | null;
  model?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface ToolActionDependencies {
  readGeneratedImageFile(imageId: string, fileName: string): Promise<{ data: Buffer; contentType: string }>;
  importGeneratedImage(input: ToolImageImportInput): Promise<{ id: string; imageFileName: string }>;
  runtimeState: {
    recordAction(action: string, detail: string): void;
  };
}

export interface ServerToolAdapter extends ServerToolDefinition {
  action?: string;
  invoke(input: Record<string, unknown>, dependencies: ToolActionDependencies): Promise<unknown>;
}