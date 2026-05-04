// src/types/index.ts

export type DocumentSource = 'Direct Upload' | 'Gmail' | 'System' | 'QR Upload';

export interface DocumentQueueItem {
  id: string;
  name: string;
  type: 'PDF' | 'Word' | 'Excel' | 'Image' | 'PowerPoint' | 'Text' | 'Video' | 'Batch';
  status: 'Pending Review' | 'Processing' | 'Completed' | 'Error' | 'Queued' | 'Edited';
  uploadedAt: Date;
  size: string; // e.g., "1.2MB"
  source?: DocumentSource;
  senderContact?: string; // e.g., email or phone number
  senderSessionId?: string; // To track QR/WA sessions for sending files back
  dataUri?: string; // This will only exist for client-side items, not from Firestore
  files?: Omit<DocumentQueueItem, 'id' | 'files' | 'status'>[]; // For batch uploads
}



// User role definition
declare module "@radix-ui/react-checkbox" {
  interface CheckboxProps {
    indeterminate?: boolean;
  }
}

// PDF Editor Types
export type Edit =
  | { type: "text"; page: number; x: number; y: number; text: string; size: number; id: string }
  | { type: "image"; page: number; x: number; y: number; width: number; height: number; dataUrl: string; id: string }
  | { type: "whiteout"; page: number; x: number; y: number; w: number; h: number; id: string }
  | { type: "highlight"; page: number; x: number; y: number; w: number; h: number; id: string };

export type PDFDocState = {
  file?: File | null;
  url?: string | null; // object URL
  numPages: number;
  pages: number[]; // page order array (1..N)
  edits: Edit[];
};

// Design Studio Types
export type DesignLayerType = 'image' | 'text' | 'shape' | 'video' | 'group';

export interface BaseLayer {
  id: string;
  type: DesignLayerType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  isHidden?: boolean;
  isLocked?: boolean;
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  src: string;
  image: HTMLImageElement | null;
}

export interface VideoLayer extends BaseLayer {
    type: 'video';
    src: string; // This will be the object URL
    videoElement?: HTMLVideoElement; // Non-serializable, managed in component state
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
}

export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  shapeType: 'rectangle' | 'circle';
  fillColor: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface GroupLayer extends BaseLayer {
  type: 'group';
  childLayerIds: string[];
}

export type DesignLayer = ImageLayer | TextLayer | ShapeLayer | VideoLayer | GroupLayer;
