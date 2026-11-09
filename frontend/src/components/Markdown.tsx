import type { ReactNode } from 'react';
import { parseMarkdown, type BlockNode, type InlineNode } from '../utils/markdown';

function renderInline(nodes: InlineNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (node.type) {
      case 'text':
        return node.text;
      case 'bold':
        return <strong key={key}>{renderInline(node.children, key)}</strong>;
      case 'italic':
        return <em key={key}>{renderInline(node.children, key)}</em>;
      case 'code':
        return <code key={key}>{node.text}</code>;
      case 'link':
        return (
          <a key={key} href={node.href} target="_blank" rel="noreferrer">
            {node.text}
          </a>
        );
      default:
        return null;
    }
  });
}

function renderBlock(block: BlockNode, index: number): ReactNode {
  const key = `block-${index}`;
  switch (block.type) {
    case 'heading':
      if (block.level === 1) return <h3 key={key}>{renderInline(block.children, key)}</h3>;
      if (block.level === 2) return <h4 key={key}>{renderInline(block.children, key)}</h4>;
      return <h5 key={key}>{renderInline(block.children, key)}</h5>;
    case 'paragraph':
      return <p key={key}>{renderInline(block.children, key)}</p>;
    case 'code':
      return (
        <pre key={key}>
          <code>{block.text}</code>
        </pre>
      );
    case 'list': {
      const items = block.items.map((item, i) => <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>);
      return block.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>;
    }
    case 'table':
      return (
        <div key={key} className="md-table-wrap">
          <table>
            <thead>
              <tr>
                {block.header.map((cell, i) => (
                  <th key={`${key}-h${i}`} style={block.align[i] ? { textAlign: block.align[i] as 'left' | 'center' | 'right' } : undefined}>
                    {renderInline(cell, `${key}-h${i}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={`${key}-r${r}`}>
                  {row.map((cell, c) => (
                    <td key={`${key}-r${r}c${c}`} style={block.align[c] ? { textAlign: block.align[c] as 'left' | 'center' | 'right' } : undefined}>
                      {renderInline(cell, `${key}-r${r}c${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'hr':
      return <hr key={key} />;
    default:
      return null;
  }
}

/**
 * Renders an Intelligence answer as formatted Markdown. Builds React elements
 * from the parsed AST — never `dangerouslySetInnerHTML` — so raw HTML in the
 * answer renders as harmless text and React escapes every text node.
 */
export default function MarkdownText({ text }: { text: string }) {
  return <div className="md-answer">{parseMarkdown(text).map((block, i) => renderBlock(block, i))}</div>;
}
