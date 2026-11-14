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

// Reading text (DESIGN.md): sans, 1.7 line height, headings by size and not by weight, hairlines only.
export default function Answer({ text }) {
  return (
    <div className="prose-answer !leading-[1.7] [&_:is(h1,h2,h3)]:!font-medium [&_:is(h1,h2,h3)]:tracking-tight [&_th]:!font-mono [&_th]:!text-xs [&_th]:!font-medium [&_td]:tabular-nums">
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
