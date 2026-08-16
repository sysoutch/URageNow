export type DashboardResourcePoolKind = "image" | "model3d" | "video" | "audio" | "music";

export interface DashboardResourcePoolRecord {
  id: string;
  kind: DashboardResourcePoolKind;
  name: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  builtIn: boolean;
}

export interface DashboardResourcePoolItem {
  id: string;
  title: string;
  fileName: string;
  resourceKind: DashboardResourcePoolKind;
  sourceValue: string;
  previewUrl: string | null;
  focusPreviewUrl?: string | null;
  downloadUrl: string | null;
  createdAt: string | null;
}

export interface DashboardResourcePoolDetail extends DashboardResourcePoolRecord {
  items: DashboardResourcePoolItem[];
}
