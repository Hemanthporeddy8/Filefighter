// src/app/(main)/dashboard/image-editor/page.tsx
"use client";

export default function DashboardImageEditorPage() {
  return (
    <div className="w-full flex justify-center bg-[#0e0e11]">
      <iframe 
        src="/image-editor/index.html?v=1.0" 
        style={{ height: 'calc(100vh - 64px)', minHeight: '800px' }}
        className="w-full border-none"
        title="Image Editor"
        allow="camera; microphone; clipboard-write; autoplay; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-downloads allow-forms allow-popups allow-modals"
      />
    </div>
  );
}
