import React from "react";
import ReactDOM from "react-dom/client";
import Editor from "./components/editor/Editor";
import { emptyDoc } from "./lib/editor/factories";
import "./app/globals.css";

function App() {
  const [doc, setDoc] = React.useState(() => {
    try {
      const saved = localStorage.getItem("editroy_image_last_project");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.layers)) {
          return parsed;
        }
      }
    } catch {
      /* ignore */
    }
    return emptyDoc(1080, 1080, "Untitled design");
  });

  return <Editor initial={doc} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
