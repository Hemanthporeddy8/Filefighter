"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [iframeHeight, setIframeHeight] = useState("360px");

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === "resize-iframe" && typeof e.data.height === "number") {
        setIframeHeight(`${e.data.height + 4}px`);
      }
    };
    window.addEventListener("message", handleMessage);
    // Request initial height once iframe is ready
    const timer = setTimeout(() => {
      const iframe = document.querySelector("iframe");
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({ type: "request-height" }, "*");
      }
    }, 1000);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="w-full flex justify-center bg-[#07070e]">
      <iframe 
        src="/fileshare/index.html" 
        style={{ height: iframeHeight }}
        className="w-full border-none transition-all duration-300"
        title="FileShare Dashboard"
        allow="wake-lock"
        scrolling="no"
      />
    </div>
  );
}
