// src/app/(main)/dashboard/video-editor/page.tsx
"use client";

export default function DashboardVideoEditorPage() {
  return (
    <div className="w-full flex justify-center bg-[#07070e]">
      <iframe 
        src="/video-editor/index.html" 
        style={{ height: 'calc(100vh - 64px)', minHeight: '800px' }}
        className="w-full border-none"
        title="Video Editor"
        allow="camera; microphone; clipboard-write; autoplay; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-downloads allow-forms allow-popups allow-modals"
      />
    </div>
  );
}
