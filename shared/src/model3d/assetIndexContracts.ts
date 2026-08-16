export interface RustIndexedDirectoryFile {
  relativePath: string;
  fileName: string;
  sizeBytes: number;
}

export interface RustIndexedModelArtifact {
  id: string;
  directoryPath: string;
  topLevelFileCount: number;
  nestedFileCount: number;
  files: RustIndexedDirectoryFile[];
  warnings: string[];
}

export interface RustAssetIndexResult {
  inputPath: string;
  indexed: boolean;
  artifactCount: number;
  orphanFiles: RustIndexedDirectoryFile[];
  artifacts: RustIndexedModelArtifact[];
  warnings: string[];
}
