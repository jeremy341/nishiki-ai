import { createLowlight } from "lowlight";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";

// Only the common languages are bundled, to keep the app small.
const lowlight = createLowlight();
lowlight.register({ bash, css, javascript, json, python, sql, typescript, xml });

// Renders an assistant answer as Markdown. Raw HTML is not rendered, so text from the
// model or from the web cannot inject markup. Links open in a new tab.
const components = {
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

export default function Answer({ text }) {
  return (
    <div className="prose-answer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { lowlight, detect: false, ignoreMissing: true }]]}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
