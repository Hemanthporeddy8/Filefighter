"use client";

export default function DashboardPage() {
  return (
    <div className="w-full h-[calc(100vh-13rem)] flex justify-center bg-[#07070e] overflow-hidden">
      <iframe 
        src="/fileshare/index.html" 
        className="w-full h-full border-none"
        title="FileShare Dashboard"
        allow="wake-lock"
      />
    </div>
  );
}
